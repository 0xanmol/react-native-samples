// Values are read from mobile/.env (EXPO_PUBLIC_* vars are inlined at build time).
// Copy .env.example → .env and set the correct server address before building.
//
// EXPO_PUBLIC_API_URL options:
//   Android emulator  → http://10.0.2.2:8080
//   Physical device   → http://<your-LAN-IP>:8080
//   Production        → https://your-server.example.com
export const AgentConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080',
  wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? 'ws://10.0.2.2:8080/ws',
  apiKey: process.env.EXPO_PUBLIC_API_KEY ?? 'helloworld',
}
