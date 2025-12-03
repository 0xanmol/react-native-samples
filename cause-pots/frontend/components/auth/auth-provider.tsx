import React, { createContext, PropsWithChildren, useContext, useState, useCallback, useEffect } from 'react'
import { useWalletUi } from '@/components/solana/use-wallet-ui'
import { useWalletAuth } from '@/hooks/useWalletAuth'
import type { User } from '@/api/types'

export interface AuthProviderState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthProviderState>({} as AuthProviderState)

export function AuthProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(false)
  const { account, connect, disconnect } = useWalletUi()
  const { user, authenticate, restoreUser, logout } = useWalletAuth()

  // Restore user session on mount
  useEffect(() => {
    restoreUser()
  }, [restoreUser])

  // Authenticate with backend when wallet connects
  useEffect(() => {
    if (account?.publicKey) {
      const authenticateUser = async () => {
        try {
          await authenticate({
            pubkey: account.publicKey.toString(),
            address: account.publicKey.toString(),
          })
        } catch (error) {
          console.error('Failed to authenticate user with backend:', error)
        }
      }
      authenticateUser()
    }
  }, [account, authenticate])

  const signIn = useCallback(async () => {
    setIsLoading(true)
    try {
      await connect()
    } catch (error) {
      console.error('Sign in error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [connect])

  const signOut = useCallback(async () => {
    setIsLoading(true)
    try {
      await disconnect()
      await logout()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [disconnect, logout])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!account && !!user,
        isLoading,
        user,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthProviderState {
  return useContext(AuthContext)
}
