/**
 * Auth token caching utilities for MWA
 * Centralizes AsyncStorage operations for wallet authorization
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Authorization } from './types';
import { PublicKey } from '@solana/web3.js';

// Storage keys
const AUTH_TOKEN_KEY = 'wallet_auth_token';
const WALLET_ADDRESS_KEY = 'wallet_address';
const WALLET_AUTHORIZATION_KEY = 'wallet_authorization';

/**
 * Auth cache utilities
 * Provides methods to store and retrieve wallet authorization data
 */
export const AuthCache = {
  /**
   * Get cached auth token
   * @returns Auth token string or null if not cached
   */
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('[AuthCache] Failed to get token:', error);
      return null;
    }
  },

  /**
   * Save auth token to cache
   * @param token - Auth token to cache
   */
  async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    } catch (error) {
      console.error('[AuthCache] Failed to set token:', error);
      throw error;
    }
  },

  /**
   * Get cached wallet address
   * @returns Wallet address string or null if not cached
   */
  async getAddress(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(WALLET_ADDRESS_KEY);
    } catch (error) {
      console.error('[AuthCache] Failed to get address:', error);
      return null;
    }
  },

  /**
   * Save wallet address to cache
   * @param address - Wallet address to cache
   */
  async setAddress(address: string): Promise<void> {
    try {
      await AsyncStorage.setItem(WALLET_ADDRESS_KEY, address);
    } catch (error) {
      console.error('[AuthCache] Failed to set address:', error);
      throw error;
    }
  },

  /**
   * Get full authorization state from cache
   * Reconstructs PublicKey objects from stored JSON
   * @returns Authorization object or null if not cached
   */
  async getAuthorization(): Promise<Authorization | null> {
    try {
      const stored = await AsyncStorage.getItem(WALLET_AUTHORIZATION_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);

      // Validate required fields
      if (!parsed.selectedAccount || !parsed.accounts || !Array.isArray(parsed.accounts)) {
        console.warn('[AuthCache] Invalid authorization data, clearing cache');
        await this.clear();
        return null;
      }

      // Reconstruct PublicKey objects (they're not preserved in JSON)
      const authorization: Authorization = {
        ...parsed,
        accounts: parsed.accounts.map((acc: any) => ({
          ...acc,
          publicKey: new PublicKey(acc.address),
        })),
        selectedAccount: {
          ...parsed.selectedAccount,
          publicKey: new PublicKey(parsed.selectedAccount.address),
        },
      };

      return authorization;
    } catch (error) {
      console.error('[AuthCache] Failed to get authorization:', error);
      return null;
    }
  },

  /**
   * Save full authorization state to cache
   * @param authorization - Authorization object to cache
   */
  async setAuthorization(authorization: Authorization): Promise<void> {
    try {
      await AsyncStorage.setItem(WALLET_AUTHORIZATION_KEY, JSON.stringify(authorization));
    } catch (error) {
      console.error('[AuthCache] Failed to set authorization:', error);
      throw error;
    }
  },

  /**
   * Store wallet auth data (token + address) in one operation
   * @param authToken - Auth token to cache
   * @param address - Wallet address to cache
   */
  async storeWalletAuth(authToken: string, address: string): Promise<void> {
    try {
      await AsyncStorage.multiSet([
        [AUTH_TOKEN_KEY, authToken],
        [WALLET_ADDRESS_KEY, address],
      ]);
    } catch (error) {
      console.error('[AuthCache] Failed to store wallet auth:', error);
      throw error;
    }
  },

  /**
   * Get stored wallet auth data (token + address)
   * @returns Object with authToken and address, or null if not found
   */
  async getStoredWalletAuth(): Promise<{ authToken: string; address: string } | null> {
    try {
      const [[, authToken], [, address]] = await AsyncStorage.multiGet([
        AUTH_TOKEN_KEY,
        WALLET_ADDRESS_KEY,
      ]);

      if (authToken && address) {
        return { authToken, address };
      }

      return null;
    } catch (error) {
      console.error('[AuthCache] Failed to get stored wallet auth:', error);
      return null;
    }
  },

  /**
   * Clear all auth data from cache
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, WALLET_ADDRESS_KEY, WALLET_AUTHORIZATION_KEY]);
    } catch (error) {
      console.error('[AuthCache] Failed to clear cache:', error);
    }
  },

  /**
   * Clear wallet auth data (token + address) but keep full authorization
   */
  async clearWalletAuth(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, WALLET_ADDRESS_KEY]);
    } catch (error) {
      console.error('[AuthCache] Failed to clear wallet auth:', error);
    }
  },
};
