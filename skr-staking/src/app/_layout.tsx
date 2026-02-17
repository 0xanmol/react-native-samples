import '../global.css'

import { Slot } from 'expo-router'
import { MobileWalletProvider, createSolanaMainnet } from '@wallet-ui/react-native-kit'

const cluster = createSolanaMainnet({
  url: process.env.EXPO_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
  label: 'Solana Mainnet',
})
const identity = {
  name: 'SKR Staking Example App',
  uri: 'https://solanamobile.com/',
}

export default function Layout() {
  return (
    <MobileWalletProvider cluster={cluster} identity={identity}>
      <Slot />
    </MobileWalletProvider>
  )
}
