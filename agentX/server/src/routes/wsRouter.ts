import { FastifyPluginAsync } from "fastify";
import { SocketStream } from "@fastify/websocket";
import { InboundMessageSchema, OutboundMessage } from "../protocol/schemas";
import { agentRunner } from "../agent/AgentRunner";
import { clientRegistry } from "../ws/clientRegistry";
import { getPendingTxsWithTrigger, updateTxStatus } from "../db/alertsDb";
import { confirmTxOnChain } from "../solana/confirmTx";

const API_KEY = process.env.API_KEY ?? "change_me";

function send(stream: SocketStream, msg: OutboundMessage): void {
  const ws = stream.socket;
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

const wsRouter: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/ws",
    { websocket: true },
    async (socket, req) => {
      // Auth check on upgrade
      if (req.headers["x-api-key"] !== API_KEY) {
        socket.socket.close(1008, "Unauthorized");
        return;
      }

      console.log("[ws] client connected");
      clientRegistry.register(socket.socket);

      // Re-deliver any pending tx signing requests the client may have missed
      // (e.g. app was in background when the alert triggered).
      // We JOIN with price_alerts so the re-delivered message carries the same
      // trigger metadata the client would have seen on the original push.
      try {
        const pending = await getPendingTxsWithTrigger();
        for (const tx of pending) {
          send(socket, {
            type: "tx_signing_request",
            payload: {
              tx_id: tx.tx_id,
              from_token: tx.from_token,
              to_token: tx.to_token,
              amount: Number(tx.amount),
              serialized_tx: tx.payload,
              reason: "Pending signing request from a previous agent decision",
              trigger: {
                alert_id: Number(tx.alert_id ?? 0),
                token: tx.alert_token ?? tx.from_token,
                target_price: Number(tx.alert_target_price ?? 0),
                triggered_price: Number(tx.trigger_price ?? 0),
                direction: tx.alert_direction ?? ("below" as const),
              },
              expires_at: tx.expires_at,
            },
          });
        }
        if (pending.length > 0) {
          console.log(`[ws] Re-sent ${pending.length} pending tx(s) to reconnecting client`);
        }
      } catch (err) {
        console.error("[ws] Error fetching pending txs on connect", err);
      }

      // Forward agent events to this socket
      const onDelta = (sessionId: string, text: string) =>
        send(socket, { type: "agent_delta", payload: { session_id: sessionId, text } });
      const onDone = (sessionId: string, text: string) =>
        send(socket, { type: "agent_done", payload: { session_id: sessionId, text } });
      const onToolCall = (sessionId: string, tool: string, input: unknown) =>
        send(socket, { type: "tool_call", payload: { session_id: sessionId, tool, input } });
      const onToolResult = (sessionId: string, tool: string, output: unknown) =>
        send(socket, { type: "tool_result", payload: { session_id: sessionId, tool, output } });
      const onError = (sessionId: string, message: string) =>
        send(socket, { type: "error", payload: { session_id: sessionId, message } });

      agentRunner.on("agent_delta", onDelta);
      agentRunner.on("agent_done", onDone);
      agentRunner.on("tool_call", onToolCall);
      agentRunner.on("tool_result", onToolResult);
      agentRunner.on("error", onError);

      // SocketStream is a Duplex — use the stream `data` event for incoming messages
      socket.on("data", (raw: Buffer) => {
        const str = raw.toString().trim();
        if (!str) return;

        let parsed: unknown;
        try {
          parsed = JSON.parse(str);
        } catch {
          console.warn("[ws] non-JSON frame, ignoring:", str.slice(0, 80));
          return;
        }

        const result = InboundMessageSchema.safeParse(parsed);
        if (!result.success) {
          send(socket, {
            type: "error",
            payload: { session_id: "", message: "Unknown or malformed message type" },
          });
          return;
        }

        const msg = result.data;

        if (msg.type === "ping") {
          send(socket, { type: "pong" });
          return;
        }

        if (msg.type === "prompt") {
          const { prompt, session_id } = msg.payload;
          agentRunner.enqueue(prompt, session_id);
          return;
        }

        if (msg.type === "tx_signed") {
          const { tx_id, signature } = msg.payload;
          console.log(`[ws] tx_signed tx_id=${tx_id} sig=${signature.slice(0, 16)}…`);

          // Mark signed immediately so the UI can update
          updateTxStatus(tx_id, "signed", signature).catch((err) =>
            console.error("[ws] Failed to record tx_signed", err)
          );

          // Poll Solana RPC in the background until the tx lands on-chain or times out.
          // Broadcasts tx_confirmed / tx_failed so the mobile app can show a final status.
          confirmTxOnChain(
            signature,
            () => {
              console.log(`[ws] tx confirmed on-chain tx_id=${tx_id} sig=${signature.slice(0, 16)}…`);
              updateTxStatus(tx_id, "confirmed").catch((err) =>
                console.error("[ws] Failed to record tx confirmed", err)
              );
              clientRegistry.broadcast({
                type: "tx_confirmed",
                payload: { tx_id, signature },
              });
            },
            (reason) => {
              console.warn(`[ws] tx failed on-chain tx_id=${tx_id} reason=${reason}`);
              updateTxStatus(tx_id, "failed").catch((err) =>
                console.error("[ws] Failed to record tx failed", err)
              );
              clientRegistry.broadcast({
                type: "tx_failed",
                payload: { tx_id, reason },
              });
            }
          ).catch((err) => {
            console.error("[ws] confirmTxOnChain threw unexpectedly", err);
          });

          return;
        }

        if (msg.type === "tx_rejected") {
          const { tx_id, reason } = msg.payload;
          console.log(`[ws] tx_rejected tx_id=${tx_id} reason=${reason ?? "none"}`);
          updateTxStatus(tx_id, "rejected").catch((err) =>
            console.error("[ws] Failed to record tx_rejected", err)
          );
          return;
        }
      });

      socket.on("close", () => {
        console.log("[ws] client disconnected");
        clientRegistry.unregister(socket.socket);
        agentRunner.off("agent_delta", onDelta);
        agentRunner.off("agent_done", onDone);
        agentRunner.off("tool_call", onToolCall);
        agentRunner.off("tool_result", onToolResult);
        agentRunner.off("error", onError);
      });

      socket.on("error", (err: Error) => {
        console.error("[ws] socket error", err.message);
      });
    }
  );
};

export default wsRouter;
