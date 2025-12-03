import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/database'

const router = Router()

// POST /api/users/auth - Authenticate or create user with wallet
router.post('/auth', async (req: Request, res: Response) => {
  try {
    const { pubkey, address, name } = req.body

    if (!pubkey || !address) {
      res.status(400).json({ error: 'pubkey and address are required' })
      return
    }

    // Check if user already exists
    let user = await db.get<any>(
      'SELECT * FROM users WHERE pubkey = ? OR address = ?',
      [pubkey, address]
    )

    if (!user) {
      // Create new user
      const userId = uuidv4()
      const now = new Date().toISOString()

      await db.run(
        'INSERT INTO users (id, pubkey, address, name, is_profile_complete, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, pubkey, address, name || null, name ? 1 : 0, now, now]
      )

      user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId])
      console.log(`✅ Created new user: ${user.name || user.address}`)
    } else {
      console.log(`✅ User authenticated: ${user.name || user.address}`)
    }

    res.json({
      id: user.id,
      pubkey: user.pubkey,
      address: user.address,
      name: user.name,
      avatarUri: user.avatar_uri,
      isProfileComplete: user.is_profile_complete === 1,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    })
  } catch (error) {
    console.error('Error authenticating user:', error)
    res.status(500).json({ error: 'Failed to authenticate user' })
  }
})

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [id])

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({
      id: user.id,
      pubkey: user.pubkey,
      address: user.address,
      name: user.name,
      avatarUri: user.avatar_uri,
      isProfileComplete: user.is_profile_complete === 1,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// GET /api/users/by-address/:address - Get user by wallet address
router.get('/by-address/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params

    const user = await db.get<any>(
      'SELECT * FROM users WHERE address = ? OR pubkey = ?',
      [address, address]
    )

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({
      id: user.id,
      pubkey: user.pubkey,
      address: user.address,
      name: user.name,
      avatarUri: user.avatar_uri,
      isProfileComplete: user.is_profile_complete === 1,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    })
  } catch (error) {
    console.error('Error fetching user by address:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// PATCH /api/users/:id - Update user profile
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, avatarUri } = req.body

    const existingUser = await db.get('SELECT id FROM users WHERE id = ?', [id])
    if (!existingUser) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const fields: string[] = []
    const values: any[] = []

    if (name !== undefined) {
      fields.push('name = ?')
      values.push(name)
    }
    if (avatarUri !== undefined) {
      fields.push('avatar_uri = ?')
      values.push(avatarUri)
    }

    if (fields.length > 0) {
      fields.push('is_profile_complete = ?')
      values.push(1)
      fields.push('updated_at = ?')
      values.push(new Date().toISOString())
    }

    if (fields.length === 0) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    values.push(id)
    await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)

    const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [id])

    res.json({
      id: user.id,
      pubkey: user.pubkey,
      address: user.address,
      name: user.name,
      avatarUri: user.avatar_uri,
      isProfileComplete: user.is_profile_complete === 1,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    })
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// GET /api/users - Get all users (for debugging/testing)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await db.all<any>('SELECT * FROM users ORDER BY created_at DESC')

    const formattedUsers = users.map((user) => ({
      id: user.id,
      pubkey: user.pubkey,
      address: user.address,
      name: user.name,
      avatarUri: user.avatar_uri,
      isProfileComplete: user.is_profile_complete === 1,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }))

    res.json(formattedUsers)
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

export default router
