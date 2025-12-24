import { Keypair, PublicKey } from '@solana/web3.js'
import { create } from 'zustand'

export type Friend = {
  id: string
  publicKey: PublicKey
  address: string
  domain?: string
  displayName?: string
  addedAt: Date
}

export type Contribution = {
  id: string
  potId: string
  contributorAddress: string
  amount: number
  currency: 'SOL' | 'USDC'
  timestamp: Date
}

export type PotCategory = 'Goal' | 'Emergency' | 'Bills' | 'Events' | 'Others'

export type Pot = {
  id: string
  name: string
  description?: string
  creatorAddress: string
  potPubkey?: string
  vaultPubkey?: string
  targetAmount: number
  totalContributed?: number
  targetDate: Date
  unlockTimestamp?: number
  currency: 'SOL' | 'USDC'
  category: PotCategory
  signersRequired?: number
  signatures?: string[]
  contributors: string[]
  contributions: Contribution[]
  createdAt: Date
  isReleased: boolean
  releasedAt?: Date
  releasedBy?: string
  recipientAddress?: string
}

export type ActivityType = 'pot_created' | 'contribution' | 'release' | 'sign_release' | 'friend_added'

export type Activity = {
  id: string
  type: ActivityType
  timestamp: Date
  userId: string
  userName?: string
  potId?: string
  potName?: string
  friendId?: string
  friendAddress?: string
  amount?: number
  currency?: 'SOL' | 'USDC'
  transactionSignature?: string
}

interface AppStore {
  friends: Friend[]
  addFriend: (publicKey: PublicKey, address: string, displayName?: string, domain?: string) => void
  removeFriend: (friendId: string) => void
  getFriendByAddress: (address: string) => Friend | undefined
  setFriends: (friends: Friend[]) => void

  pots: Pot[]
  createPot: (pot: Omit<Pot, 'id' | 'createdAt' | 'contributions' | 'isReleased'> & { transactionSignature?: string }) => Promise<void>
  updatePot: (potId: string, updates: Partial<Pot>) => void
  addContributorToPot: (potId: string, contributorAddress: string) => void
  addContribution: (contribution: Omit<Contribution, 'id' | 'timestamp'> & { transactionSignature?: string }) => Promise<void>
  releasePot: (potId: string, releasedBy: string, transactionSignature?: string) => Promise<void>
  getPotById: (potId: string) => Pot | undefined
  getUserPots: (userAddress: string) => Pot[]
  setPots: (pots: Pot[]) => void
  refreshPot: (potId: string) => Promise<void>

  activities: Activity[]
  fetchActivities: (userAddress?: string) => Promise<void>
  setActivities: (activities: Activity[]) => void

  clearAll: () => void
}

// Mock data removed - now using backend API
/* const createMockData = () => {
  const mockAddresses = [
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM94',
    'GjJyeC1rB1p4xYWbXqM6zJY1ZJ8KJ8KJ8KJ8KJ8KJ8KJ8',
    'H6ARHf6YXhGYeQfUzQNGk6rDNnlbQPH1i6XBLBwX3L1e',
  ]

  const mockFriendNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']

  const mockFriends: Friend[] = mockAddresses.map((address, index) => {
    try {
      return {
        id: `friend-mock-${index}`,
        publicKey: new PublicKey(address),
        address,
        displayName: mockFriendNames[index],
        addedAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
      }
    } catch {
      const fallbackKey = Keypair.generate().publicKey
      return {
        id: `friend-mock-${index}`,
        publicKey: fallbackKey,
        address: fallbackKey.toString(),
        displayName: mockFriendNames[index],
        addedAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000),
      }
    }
  })

  const now = new Date()
  const mockPots: Pot[] = [
    {
      id: 'pot-mock-1',
      name: 'Trip to Japan',
      description: 'Saving up for our dream vacation to Tokyo and Kyoto',
      creatorAddress: mockAddresses[0],
      targetAmount: 50,
      targetDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      currency: 'SOL',
      category: 'Goal',
      contributors: [mockAddresses[0], mockAddresses[1], mockAddresses[2]],
      contributions: [
        {
          id: 'cont-1',
          potId: 'pot-mock-1',
          contributorAddress: mockAddresses[0],
          amount: 10,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-2',
          potId: 'pot-mock-1',
          contributorAddress: mockAddresses[1],
          amount: 8,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-3',
          potId: 'pot-mock-1',
          contributorAddress: mockAddresses[2],
          amount: 7,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      isReleased: false,
    },
    {
      id: 'pot-mock-2',
      name: 'Gaming Setup Fund',
      description: 'Saving for a high-end gaming PC and accessories',
      creatorAddress: mockAddresses[4],
      targetAmount: 75,
      targetDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000),
      currency: 'SOL',
      category: 'Goal',
      contributors: [mockAddresses[4], mockAddresses[0], mockAddresses[1]],
      contributions: [
        {
          id: 'cont-4',
          potId: 'pot-mock-2',
          contributorAddress: mockAddresses[4],
          amount: 15,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      isReleased: false,
    },
    {
      id: 'pot-mock-3',
      name: 'Emergency Fund',
      description: 'Building an emergency fund together',
      creatorAddress: mockAddresses[3],
      targetAmount: 1000,
      targetDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      currency: 'USDC',
      category: 'Emergency',
      contributors: [mockAddresses[3], mockAddresses[1], mockAddresses[2]],
      contributions: [
        {
          id: 'cont-5',
          potId: 'pot-mock-3',
          contributorAddress: mockAddresses[3],
          amount: 400,
          currency: 'USDC',
          timestamp: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-6',
          potId: 'pot-mock-3',
          contributorAddress: mockAddresses[1],
          amount: 300,
          currency: 'USDC',
          timestamp: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-7',
          potId: 'pot-mock-3',
          contributorAddress: mockAddresses[2],
          amount: 300,
          currency: 'USDC',
          timestamp: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
      isReleased: true,
      releasedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      releasedBy: mockAddresses[3],
    },
    {
      id: 'pot-mock-4',
      name: 'Medical Emergency Fund',
      description: 'Covering unexpected medical expenses',
      creatorAddress: mockAddresses[0],
      targetAmount: 500,
      targetDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
      currency: 'USDC',
      category: 'Emergency',
      contributors: [mockAddresses[0], mockAddresses[2], mockAddresses[4]],
      contributions: [
        {
          id: 'cont-8',
          potId: 'pot-mock-4',
          contributorAddress: mockAddresses[0],
          amount: 150,
          currency: 'USDC',
          timestamp: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-9',
          potId: 'pot-mock-4',
          contributorAddress: mockAddresses[2],
          amount: 100,
          currency: 'USDC',
          timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      isReleased: false,
    },
    {
      id: 'pot-mock-5',
      name: 'Family Cabin Refresh',
      description: 'Upgrading the lakeside cabin before summer',
      creatorAddress: mockAddresses[3],
      targetAmount: 250,
      targetDate: new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000),
      currency: 'USDC',
      category: 'Bills',
      contributors: [mockAddresses[3], mockAddresses[0], mockAddresses[4]],
      contributions: [
        {
          id: 'cont-10',
          potId: 'pot-mock-5',
          contributorAddress: mockAddresses[3],
          amount: 60,
          currency: 'USDC',
          timestamp: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-11',
          potId: 'pot-mock-5',
          contributorAddress: mockAddresses[0],
          amount: 40,
          currency: 'USDC',
          timestamp: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      isReleased: false,
    },
    {
      id: 'pot-mock-6',
      name: 'Monthly Rent Pool',
      description: 'Shared apartment rent and utilities',
      creatorAddress: mockAddresses[1],
      targetAmount: 800,
      targetDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      currency: 'USDC',
      category: 'Bills',
      contributors: [mockAddresses[1], mockAddresses[2], mockAddresses[3]],
      contributions: [
        {
          id: 'cont-12',
          potId: 'pot-mock-6',
          contributorAddress: mockAddresses[1],
          amount: 300,
          currency: 'USDC',
          timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-13',
          potId: 'pot-mock-6',
          contributorAddress: mockAddresses[2],
          amount: 250,
          currency: 'USDC',
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      isReleased: false,
    },
    {
      id: 'pot-mock-7',
      name: 'Wedding Gift Fund',
      description: 'Group gift for Sarah and Mike\'s wedding',
      creatorAddress: mockAddresses[1],
      targetAmount: 5,
      targetDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      currency: 'SOL',
      category: 'Events',
      contributors: [mockAddresses[1], mockAddresses[3], mockAddresses[4]],
      contributions: [
        {
          id: 'cont-14',
          potId: 'pot-mock-7',
          contributorAddress: mockAddresses[1],
          amount: 2,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-15',
          potId: 'pot-mock-7',
          contributorAddress: mockAddresses[3],
          amount: 1.5,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-16',
          potId: 'pot-mock-7',
          contributorAddress: mockAddresses[4],
          amount: 1.5,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      isReleased: false,
    },
    {
      id: 'pot-mock-8',
      name: 'Birthday Party Fund',
      description: 'Throwing a surprise party for our friend',
      creatorAddress: mockAddresses[0],
      targetAmount: 2,
      targetDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      currency: 'SOL',
      category: 'Events',
      contributors: [mockAddresses[0], mockAddresses[1], mockAddresses[2], mockAddresses[3], mockAddresses[4]],
      contributions: [
        {
          id: 'cont-17',
          potId: 'pot-mock-8',
          contributorAddress: mockAddresses[0],
          amount: 0.5,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-18',
          potId: 'pot-mock-8',
          contributorAddress: mockAddresses[1],
          amount: 0.4,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-19',
          potId: 'pot-mock-8',
          contributorAddress: mockAddresses[2],
          amount: 0.3,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-20',
          potId: 'pot-mock-8',
          contributorAddress: mockAddresses[3],
          amount: 0.3,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      isReleased: false,
    },
    {
      id: 'pot-mock-9',
      name: 'Art Residency Fund',
      description: "Covering flights, stay, and studio time for Ava's Lisbon residency",
      creatorAddress: mockAddresses[2],
      targetAmount: 18,
      targetDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
      currency: 'SOL',
      category: 'Others',
      contributors: [mockAddresses[2], mockAddresses[3]],
      contributions: [
        {
          id: 'cont-21',
          potId: 'pot-mock-9',
          contributorAddress: mockAddresses[2],
          amount: 3.4,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      isReleased: false,
    },
    {
      id: 'pot-mock-10',
      name: 'Community Garden Project',
      description: 'Funding a shared community garden space',
      creatorAddress: mockAddresses[4],
      targetAmount: 30,
      targetDate: new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000),
      currency: 'SOL',
      category: 'Others',
      contributors: [mockAddresses[4], mockAddresses[0], mockAddresses[1], mockAddresses[2]],
      contributions: [
        {
          id: 'cont-22',
          potId: 'pot-mock-10',
          contributorAddress: mockAddresses[4],
          amount: 8,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'cont-23',
          potId: 'pot-mock-10',
          contributorAddress: mockAddresses[0],
          amount: 5,
          currency: 'SOL',
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        },
      ],
      createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      isReleased: false,
    },
  ]

  const mockActivities: Activity[] = [
    {
      id: 'act-1',
      type: 'pot_created',
      timestamp: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      userId: mockAddresses[0],
      potId: 'pot-mock-1',
      potName: 'Trip to Japan',
    },
    {
      id: 'act-2',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      userId: mockAddresses[0],
      potId: 'pot-mock-1',
      potName: 'Trip to Japan',
      amount: 10,
      currency: 'SOL',
    },
    {
      id: 'act-3',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      userId: mockAddresses[1],
      potId: 'pot-mock-1',
      potName: 'Trip to Japan',
      amount: 8,
      currency: 'SOL',
    },
    {
      id: 'act-4',
      type: 'pot_created',
      timestamp: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      userId: mockAddresses[1],
      potId: 'pot-mock-7',
      potName: 'Wedding Gift Fund',
    },
    {
      id: 'act-5',
      type: 'release',
      timestamp: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      userId: mockAddresses[3],
      potId: 'pot-mock-3',
      potName: 'Emergency Fund',
    },
    {
      id: 'act-6',
      type: 'friend_added',
      timestamp: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      userId: mockAddresses[0],
      friendId: 'friend-mock-1',
      friendAddress: mockAddresses[1],
    },
    {
      id: 'act-7',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      userId: mockAddresses[2],
      potId: 'pot-mock-2',
      potName: 'Gaming Setup Fund',
      amount: 15,
      currency: 'SOL',
    },
    {
      id: 'act-8',
      type: 'pot_created',
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      userId: mockAddresses[4],
      potId: 'pot-mock-2',
      potName: 'Gaming Setup Fund',
    },
    // Today's activities
    {
      id: 'act-9',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
      userId: mockAddresses[0],
      potId: 'pot-mock-1',
      potName: 'Trip to Japan',
      amount: 15,
      currency: 'SOL',
    },
    {
      id: 'act-10',
      type: 'friend_added',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      userId: mockAddresses[2],
      friendId: 'friend-mock-4',
      friendAddress: mockAddresses[4],
    },
    {
      id: 'act-11',
      type: 'pot_created',
      timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
      userId: mockAddresses[1],
      potId: 'pot-mock-6',
      potName: 'Monthly Rent Pool',
    },
    {
      id: 'act-12',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000), // 8 hours ago
      userId: mockAddresses[3],
      potId: 'pot-mock-7',
      potName: 'Wedding Gift Fund',
      amount: 1.5,
      currency: 'SOL',
    },
    // Yesterday's activities
    {
      id: 'act-13',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 26 * 60 * 60 * 1000), // Yesterday
      userId: mockAddresses[1],
      potId: 'pot-mock-1',
      potName: 'Trip to Japan',
      amount: 12.5,
      currency: 'SOL',
    },
    {
      id: 'act-14',
      type: 'release',
      timestamp: new Date(now.getTime() - 28 * 60 * 60 * 1000), // Yesterday
      userId: mockAddresses[0],
      potId: 'pot-mock-3',
      potName: 'Emergency Fund',
    },
    {
      id: 'act-15',
      type: 'pot_created',
      timestamp: new Date(now.getTime() - 30 * 60 * 60 * 1000), // Yesterday
      userId: mockAddresses[4],
      potId: 'pot-mock-7',
      potName: 'Wedding Gift Fund',
    },
    {
      id: 'act-16',
      type: 'friend_added',
      timestamp: new Date(now.getTime() - 22 * 60 * 60 * 1000), // Yesterday
      userId: mockAddresses[0],
      friendId: 'friend-mock-2',
      friendAddress: mockAddresses[2],
    },
    // This week's activities
    {
      id: 'act-17',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      userId: mockAddresses[2],
      potId: 'pot-mock-1',
      potName: 'Trip to Japan',
      amount: 20,
      currency: 'SOL',
    },
    {
      id: 'act-18',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      userId: mockAddresses[4],
      potId: 'pot-mock-5',
      potName: 'Family Cabin Refresh',
      amount: 40,
      currency: 'USDC',
    },
    {
      id: 'act-19',
      type: 'pot_created',
      timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      userId: mockAddresses[3],
      potId: 'pot-mock-8',
      potName: 'Birthday Party Fund',
    },
    {
      id: 'act-20',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      userId: mockAddresses[1],
      potId: 'pot-mock-6',
      potName: 'Monthly Rent Pool',
      amount: 300,
      currency: 'USDC',
    },
    // Older activities
    {
      id: 'act-21',
      type: 'friend_added',
      timestamp: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
      userId: mockAddresses[3],
      friendId: 'friend-mock-3',
      friendAddress: mockAddresses[0],
    },
    {
      id: 'act-22',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000), // 18 days ago
      userId: mockAddresses[0],
      potId: 'pot-mock-7',
      potName: 'Wedding Gift Fund',
      amount: 1.5,
      currency: 'SOL',
    },
    {
      id: 'act-23',
      type: 'release',
      timestamp: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000), // 22 days ago
      userId: mockAddresses[2],
      potId: 'pot-mock-7',
      potName: 'Wedding Gift Fund',
    },
    {
      id: 'act-24',
      type: 'pot_created',
      timestamp: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      userId: mockAddresses[1],
      potId: 'pot-mock-9',
      potName: 'Retirement Savings',
    },
    {
      id: 'act-25',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
      userId: mockAddresses[4],
      potId: 'pot-mock-1',
      potName: 'Trip to Japan',
      amount: 18.75,
      currency: 'SOL',
    },
    {
      id: 'act-26',
      type: 'friend_added',
      timestamp: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
      userId: mockAddresses[1],
      friendId: 'friend-mock-0',
      friendAddress: mockAddresses[0],
    },
    {
      id: 'act-27',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      userId: mockAddresses[3],
      potId: 'pot-mock-5',
      potName: 'Family Cabin Refresh',
      amount: 60,
      currency: 'USDC',
    },
    {
      id: 'act-28',
      type: 'pot_created',
      timestamp: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000), // 50 days ago
      userId: mockAddresses[0],
      potId: 'pot-mock-10',
      potName: 'Charity Donation Fund',
    },
    // Extra vivid demo activity feed
    {
      id: 'act-29',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 12 * 60 * 1000), // 12 minutes ago
      userId: mockAddresses[4],
      potId: 'pot-mock-10',
      potName: 'Community Garden Project',
      amount: 5,
      currency: 'SOL',
    },
    {
      id: 'act-30',
      type: 'release',
      timestamp: new Date(now.getTime() - 90 * 60 * 1000), // 1.5 hours ago
      userId: mockAddresses[1],
      potId: 'pot-mock-8',
      potName: 'Birthday Party Fund',
    },
    {
      id: 'act-31',
      type: 'pot_created',
      timestamp: new Date(now.getTime() - 18 * 60 * 60 * 1000), // earlier today
      userId: mockAddresses[2],
      potId: 'pot-mock-9',
      potName: 'Art Residency Fund',
    },
    {
      id: 'act-32',
      type: 'friend_added',
      timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      userId: mockAddresses[4],
      friendId: 'friend-mock-3',
      friendAddress: mockAddresses[0],
    },
    {
      id: 'act-33',
      type: 'contribution',
      timestamp: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000), // last week
      userId: mockAddresses[3],
      potId: 'pot-mock-4',
      potName: 'Medical Emergency Fund',
      amount: 100,
      currency: 'USDC',
    },
    {
      id: 'act-34',
      type: 'pot_created',
      timestamp: new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000), // 65 days ago
      userId: mockAddresses[2],
      potId: 'pot-mock-5',
      potName: 'Family Cabin Refresh',
    },
  ]

  return { mockFriends, mockPots, mockActivities }
} */

export const useAppStore = create<AppStore>((set, get) => {
  return {
    // Friends
    friends: [],
  addFriend: (publicKey, address, displayName, domain) => {
    const friend: Friend = {
      id: `friend-${Date.now()}-${Math.random()}`,
      publicKey,
      address,
      displayName,
      domain,
      addedAt: new Date(),
    }
    set((state) => ({
      friends: [...state.friends, friend],
    }))
  },
  removeFriend: (friendId) => {
    set((state) => ({
      friends: state.friends.filter((f) => f.id !== friendId),
    }))
  },
  getFriendByAddress: (address) => {
    return get().friends.find((f) => f.address === address)
  },
  setFriends: (friends) => {
    set({ friends })
  },

  // Pots
  pots: [],
  createPot: async (potData) => {
    try {
      // Call backend API to create pot
      const createdPot = await import('../api/pots').then(api =>
        api.createPot({
          name: potData.name,
          description: potData.description,
          creatorAddress: potData.creatorAddress,
          potPubkey: potData.potPubkey,
          vaultPubkey: potData.vaultPubkey,
          targetAmount: potData.targetAmount,
          targetDate: potData.targetDate.toISOString(),
          unlockTimestamp: potData.unlockTimestamp,
          currency: potData.currency,
          category: potData.category,
          signersRequired: potData.signersRequired,
          recipientAddress: potData.recipientAddress,
          contributors: potData.contributors,
          transactionSignature: potData.transactionSignature,
        })
      )

      // Convert API response (string dates) to local format (Date objects)
      const pot: Pot = {
        ...createdPot,
        targetDate: new Date(createdPot.targetDate),
        createdAt: new Date(createdPot.createdAt),
        releasedAt: createdPot.releasedAt ? new Date(createdPot.releasedAt) : undefined,
        contributions: createdPot.contributions.map(c => ({
          ...c,
          timestamp: new Date(c.timestamp),
        })),
      }

      set((state) => ({
        pots: [...state.pots, pot],
      }))
    } catch (error) {
      console.error('Failed to create pot in database:', error)
      throw error
    }
  },
  updatePot: (potId, updates) => {
    set((state) => ({
      pots: state.pots.map((pot) => (pot.id === potId ? { ...pot, ...updates } : pot)),
    }))
  },
  addContributorToPot: (potId, contributorAddress) => {
    set((state) => {
      const updatedPots = state.pots.map((pot) =>
        pot.id === potId && !pot.contributors.includes(contributorAddress)
          ? { ...pot, contributors: [...pot.contributors, contributorAddress] }
          : pot
      )

      const isAlreadyFriend = state.friends.some((f) => f.address === contributorAddress)
      let updatedFriends = state.friends
      if (!isAlreadyFriend) {
        try {
          const publicKey = new PublicKey(contributorAddress)
          updatedFriends = [
            ...state.friends,
            {
              id: `friend-${contributorAddress.slice(0, 8)}`,
              publicKey,
              address: contributorAddress,
              addedAt: new Date(),
            },
          ]
        } catch {}
      }

      return {
        pots: updatedPots,
        friends: updatedFriends,
      }
    })
  },
  addContribution: async (contributionData) => {
    try {
      // Call backend API to add contribution
      await import('../api/pots').then(api =>
        api.addContribution({
          potId: contributionData.potId,
          contributorAddress: contributionData.contributorAddress,
          amount: contributionData.amount,
          currency: contributionData.currency,
          transactionSignature: contributionData.transactionSignature,
        })
      )

      // Update local state
      const contribution: Contribution = {
        ...contributionData,
        id: `contribution-${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
      }
      set((state) => ({
        pots: state.pots.map((pot) =>
          pot.id === contribution.potId
            ? { ...pot, contributions: [...pot.contributions, contribution] }
            : pot
        ),
      }))
    } catch (error) {
      console.error('Failed to add contribution to database:', error)
      throw error
    }
  },
  releasePot: async (potId, releasedBy, transactionSignature) => {
    try {
      // Call backend API to release pot
      await import('../api/pots').then(api =>
        api.releasePot(potId, releasedBy, transactionSignature)
      )

      // Update local state
      set((state) => ({
        pots: state.pots.map((pot) =>
          pot.id === potId
            ? { ...pot, isReleased: true, releasedAt: new Date(), releasedBy }
            : pot
        ),
      }))
    } catch (error) {
      console.error('Failed to release pot in database:', error)
      throw error
    }
  },
  getPotById: (potId) => {
    return get().pots.find((p) => p.id === potId)
  },
  getUserPots: (userAddress) => {
    return get().pots.filter(
      (pot) => pot.creatorAddress === userAddress || pot.contributors.includes(userAddress)
    )
  },
  setPots: (pots) => {
    set({ pots })
  },
  refreshPot: async (potId: string) => {
    try {
      const potData = await import('../api/pots').then(api =>
        api.getPotById(potId)
      )

      if (!potData) {
        throw new Error('Pot not found in backend')
      }

      // Convert API response (string dates) to local format (Date objects)
      const pot: Pot = {
        ...potData,
        targetDate: new Date(potData.targetDate),
        createdAt: new Date(potData.createdAt),
        releasedAt: potData.releasedAt ? new Date(potData.releasedAt) : undefined,
        contributions: potData.contributions.map(c => ({
          ...c,
          timestamp: new Date(c.timestamp),
        })),
      }

      // Update the pot in the store
      set((state) => ({
        pots: state.pots.map((p) => (p.id === potId ? pot : p)),
      }))
    } catch (error) {
      console.error('Failed to refresh pot from backend:', error)
      throw error
    }
  },

  // Activity
  activities: [],
  fetchActivities: async (userAddress) => {
    try {
      const activities = await import('../api/activities').then(api =>
        userAddress ? api.getActivitiesForUser(userAddress) : api.getAllActivities()
      )

      // Convert API response (string dates) to local format (Date objects)
      const activitiesWithDates = activities.map(a => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }))

      set({ activities: activitiesWithDates })
    } catch (error) {
      console.error('Failed to fetch activities:', error)
      throw error
    }
  },
  setActivities: (activities) => {
    set({ activities })
  },

  clearAll: () => {
    set({
      friends: [],
      pots: [],
      activities: [],
    })
  },
  }
})

