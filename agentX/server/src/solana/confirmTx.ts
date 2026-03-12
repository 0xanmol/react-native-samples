import { createSolanaRpc, type Signature } from "@solana/kit";

const RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 2 * 60 * 1_000; // 2 minutes

// Singleton — one RPC client per server process
const rpc = createSolanaRpc(RPC_URL);

/**
 * Poll the Solana RPC until the transaction is confirmed on-chain or the
 * polling window times out.
 *
 * Calls onConfirmed or onFailed exactly once, then returns.
 *
 * Note: Jupiter embeds a blockhash valid for ~150 slots (~60-90s). If the user
 * took a long time to sign, the network may reject an otherwise valid-looking
 * signature — that surfaces as a non-null `err` in getSignatureStatuses.
 *
 * @param signature - Base58 transaction signature returned by MWA
 * @param onConfirmed - Called when status reaches 'confirmed' or 'finalized'
 * @param onFailed    - Called when the transaction fails on-chain or times out
 */
export async function confirmTxOnChain(
  signature: string,
  onConfirmed: () => void,
  onFailed: (reason: string) => void
): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const { value } = await rpc
        .getSignatureStatuses([signature as Signature], {
          searchTransactionHistory: false,
        })
        .send();

      const status = value[0];

      if (status === null) {
        // Not visible on-chain yet — keep polling
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      if (status.err !== null) {
        onFailed(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
        return;
      }

      if (
        status.confirmationStatus === "confirmed" ||
        status.confirmationStatus === "finalized"
      ) {
        onConfirmed();
        return;
      }

      // Still at 'processed' — keep polling until confirmed
    } catch (err) {
      console.error(
        "[confirmTx] RPC error:",
        err instanceof Error ? err.message : String(err)
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }

  onFailed("Confirmation timed out after 2 minutes");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
