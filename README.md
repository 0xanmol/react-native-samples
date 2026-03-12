# Solana Mobile React Native Samples

A collection of sample Android React Native applications demonstrating best practices and common patterns for Solana Mobile development. 

For feedback and suggestions, please open an issue on this repository.

## 📱 Samples

| Sample | Description |
| ------ | ----------- |
| **Settle** <br><br>[> Browse](/settle) | Expenses splitting app showcasing functionality to connect wallet and repay debts with transfer transactions <br><br>• Beginner friendly<br>• Connect wallet<br>• Send and View Transactions|
| **skr address resolution** <br><br>[> Browse](/skr-address-resolution) | Application to showcase bidirectional domain lookup <br><br>• Beginner friendly<br>• Connect wallet<br>• Domain to address lookup aka example.skr → wallet address<br>• Address to domain reverse lookup aka wallet address → example.skr|
| **Cause Pots** <br><br>[> Browse](/cause-pots) | Decentralized group savings application built on Solana demonstrating Anchor smart contracts with custom PDAs <br><br>• Intermediate level<br>• Integrate Smart Contract<br>• Create and Sign custom Tx/ix<br>• Friend management with .skr domain resolution|
| **StakeSKR** <br><br>[> Browse](/skr-staking) | SKR token staking app demonstrating Codama client generation and the full staking lifecycle on Solana mainnet <br><br>• Intermediate level<br>• Codama-generated TypeScript clients from Anchor IDL<br>• Stake, Unstake, Cancel Unstake, and Withdraw<br>• Solana Web3.js v2 (`@solana/kit`)|
| **agentX** <br><br>[> Browse](/agentX) | Demo app showcasing real-time communication between an Android app and an autonomous LLM trading agent performing mainnet swaps <br><br>• Intermediate level<br>• LLM agent with tool-calling (price fetch, alert creation, swap building)<br>• Real-time WebSocket streaming — token-by-token agent reasoning<br>• Jupiter v6 swap transactions signed via Mobile Wallet Adapter<br>• Background push notifications via Expo/FCM|


## 🛠️ Prerequisites

Before trying out any of the apps, ensure you have the following:

- Any Android device or emulator (Solana Mobile devices are not necessary!)
- React Native development environment ([setup guide](https://docs.expo.dev/get-started/set-up-your-environment/?mode=development-build&buildEnv=local))
- Node.js and npm/yarn
- Android Studio (Recommended)
- [Mock MWA Wallet](https://docs.solanamobile.com/react-native/test-with-any-android-device#mock-mwa-wallet) - Required for testing wallet connections and transactions similar to how it takes place on Seeker. Follow the setup instructions on their github and test out the wallet authentication prior to proceeding with development.

Each sample includes its own detailed setup instructions.


## 📖 Resources

- [Solana Mobile React Native Documentation](https://docs.solanamobile.com/react-native/overview)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Documentation](https://react.dev/)
