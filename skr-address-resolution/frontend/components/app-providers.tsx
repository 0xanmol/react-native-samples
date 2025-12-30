import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PropsWithChildren } from 'react'
import { MobileWalletProvider } from '@wallet-ui/react-native-web3js'
import { AppTheme } from '@/components/app-theme'
import { AppConfig } from '@/constants/app-config'

const queryClient = new QueryClient()

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppTheme>
      <QueryClientProvider client={queryClient}>
        <MobileWalletProvider
          chain={AppConfig.network.id}
          endpoint={AppConfig.network.endpoint}
          identity={{ name: AppConfig.name }}
        >
          {children}
        </MobileWalletProvider>
      </QueryClientProvider>
    </AppTheme>
  )
}
