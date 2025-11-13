/**
 * Primary MWA hook - Combines all MWA functionality into a single interface
 * Provides a simplified API for wallet operations
 */

import { useMemo } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { useAuthorization } from '@/components/providers/AuthorizationProvider';
import { useConnection } from '@/components/providers/ConnectionProvider';
import { APP_IDENTITY, SOLANA_CLUSTER } from '@/constants/wallet';
import { Account } from './types';
import { isAuthError } from './errors';

/**
 * MWA hook return type
 */
export interface MWAHook {
  // Connection state
  publicKey: PublicKey | null;
  address: string | null;
  connected: boolean;
  accounts: Account[];
  selectedAccount: Account | null;

  // Auth methods
  connect: () => Promise<Account>;
  disconnect: () => Promise<void>;
  selectAccount: (account: Account) => void;

  // Transaction methods
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  signAndSendTransaction: (transaction: Transaction) => Promise<string>;

  // Utils
  connection: ReturnType<typeof useConnection>;
  authorization: ReturnType<typeof useAuthorization>['authorization'];
}

/**
 * useMWA - Primary hook for Mobile Wallet Adapter operations
 *
 * Combines all MWA functionality into a single, easy-to-use hook.
 * Provides wallet connection, signing, and transaction methods.
 *
 * @returns MWAHook interface with all wallet operations
 *
 * @example
 * ```tsx
 * const { publicKey, connect, signTransaction, connection } = useMWA();
 *
 * // Connect wallet
 * await connect();
 *
 * // Sign a transaction
 * const signedTx = await signTransaction(transaction);
 *
 * // Get balance
 * const balance = await connection.getBalance(publicKey);
 * ```
 */
export function useMWA(): MWAHook {
  const { authorization, authorizeSession, deauthorizeSession, onChangeAccount } =
    useAuthorization();
  const connection = useConnection();

  const selectedAccount = authorization?.selectedAccount ?? null;
  const accounts = authorization?.accounts ?? [];

  /**
   * Connect wallet - Triggers authorization flow
   */
  const connect = async (): Promise<Account> => {
    return await transact(async (wallet: Web3MobileWallet) => {
      return await authorizeSession(wallet);
    });
  };

  /**
   * Disconnect wallet - Deauthorizes and clears session
   */
  const disconnect = async (): Promise<void> => {
    await deauthorizeSession();
  };

  /**
   * Select a different account from authorized accounts
   */
  const selectAccount = (account: Account): void => {
    onChangeAccount(account);
  };

  // Memoize transaction methods
  const transactionMethods = useMemo(() => {
    if (!selectedAccount || !authorizeSession) {
      return {
        signTransaction: async () => {
          throw new Error('No wallet connected. Please connect a wallet first.');
        },
        signAllTransactions: async () => {
          throw new Error('No wallet connected. Please connect a wallet first.');
        },
        signAndSendTransaction: async () => {
          throw new Error('No wallet connected. Please connect a wallet first.');
        },
      };
    }

    return {
      /**
       * Sign a single transaction
       * Re-authorizes the session before signing
       */
      signTransaction: async (transaction: Transaction): Promise<Transaction> => {
        return await transact(async (wallet: Web3MobileWallet) => {
          await authorizeSession(wallet);

          const signedTransactions = await wallet.signTransactions({
            transactions: [transaction],
          });

          return signedTransactions[0];
        });
      },

      /**
       * Sign multiple transactions
       * Re-authorizes the session before signing
       */
      signAllTransactions: async (transactions: Transaction[]): Promise<Transaction[]> => {
        return await transact(async (wallet: Web3MobileWallet) => {
          await authorizeSession(wallet);

          const signedTransactions = await wallet.signTransactions({
            transactions,
          });

          return signedTransactions;
        });
      },

      /**
       * Sign and send a single transaction
       * Re-authorizes the session before signing and sending
       * Automatically retries with fresh auth if token expired
       * @returns Transaction signature
       */
      signAndSendTransaction: async (transaction: Transaction): Promise<string> => {
        try {
          // First attempt with existing auth token
          return await transact(async (wallet: Web3MobileWallet) => {
            await authorizeSession(wallet);

            const signedTransactions = await wallet.signAndSendTransactions({
              transactions: [transaction],
            });

            return signedTransactions[0];
          });
        } catch (error: any) {
          // Check if error is due to expired/invalid auth using centralized detection
          if (isAuthError(error)) {
            console.log('[useMWA] Auth token expired, retrying with fresh authorization...');

            // Retry with fresh authorization (no cached token)
            return await transact(async (wallet: Web3MobileWallet) => {
              await wallet.authorize({
                cluster: SOLANA_CLUSTER,
                identity: APP_IDENTITY,
              });

              const signedTransactions = await wallet.signAndSendTransactions({
                transactions: [transaction],
              });

              return signedTransactions[0];
            });
          }

          // Not an auth error, rethrow
          throw error;
        }
      },
    };
  }, [selectedAccount, authorizeSession]);

  return {
    // Connection state
    publicKey: selectedAccount?.publicKey ?? null,
    address: selectedAccount?.address ?? null,
    connected: !!selectedAccount,
    accounts,
    selectedAccount,

    // Auth methods
    connect,
    disconnect,
    selectAccount,

    // Transaction methods
    ...transactionMethods,

    // Utils
    connection,
    authorization,
  };
}
