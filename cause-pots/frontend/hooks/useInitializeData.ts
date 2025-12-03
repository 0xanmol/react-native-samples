import { useEffect, useState } from 'react'
import { getAllPots } from '@/api/pots'
import { getFriends } from '@/api/friends'
import { getActivitiesForUser } from '@/api/activities'

/**
 * Hook to initialize app data from the backend API
 * Call this in your root component (e.g., app layout or main screen)
 * @param userAddress - The wallet address of the current user (required after authentication)
 */
export function useInitializeData(userAddress?: string) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Skip loading if no user address (not authenticated yet)
    if (!userAddress) {
      setIsLoading(false)
      return
    }

    let isMounted = true

    async function loadData() {
      try {
        setIsLoading(true)
        setError(null)

        // Load data in parallel for better performance
        await Promise.all([
          getAllPots().catch((err) => {
            console.error('Failed to load pots:', err)
            throw err
          }),
          getFriends(userAddress).catch((err) => {
            console.error('Failed to load friends:', err)
            throw err
          }),
          getActivitiesForUser(userAddress).catch((err) => {
            console.error('Failed to load activities:', err)
            throw err
          }),
        ])

        if (isMounted) {
          setIsLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load data'))
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [userAddress])

  return { isLoading, error }
}
