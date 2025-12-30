import { clusterApiUrl } from '@solana/web3.js'
import { SolanaClusterId } from '@wallet-ui/core'

export class AppConfig {
  static name = '.skr address resolution'
  static uri = 'https://skrdemo.app'
  static network: { id: SolanaClusterId; endpoint: string } = {
    id: 'solana:mainnet',
    endpoint: clusterApiUrl('mainnet-beta'),
  }
}
