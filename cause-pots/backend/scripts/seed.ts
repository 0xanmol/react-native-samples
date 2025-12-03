import { db } from '../src/db/database'
import { v4 as uuidv4 } from 'uuid'
import dotenv from 'dotenv'

dotenv.config()

const dummyUsersData = [
  { pubkey: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', name: 'Bob' },
  { pubkey: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM94', name: 'Charlie' },
  { pubkey: 'GjJyeC1rB1p4xYWbXqM6zJY1ZJ8KJ8KJ8KJ8KJ8KJ8KJ8', name: 'Diana' },
  { pubkey: 'H6ARHf6YXhGYeQfUzQNGk6rDNnlbQPH1i6XBLBwX3L1e', name: 'Eve' },
  { pubkey: 'F4k3AdDr3ssF0rT3st1ngPurp0s3sOnly1234567890', name: 'Frank' },
  { pubkey: 'Gr8tS0m3Addr3ss1234567890ABCDEFGHIJKLMNoPQR', name: 'Grace' },
]

async function seedDatabase() {
  try {
    await db.connect()
    console.log('\n🌱 Seeding database with dummy users...\n')

    // Create dummy users
    console.log('Creating dummy users...')
    const users: Array<{ id: string; pubkey: string; address: string; name: string }> = []
    const now = new Date().toISOString()

    for (const userData of dummyUsersData) {
      // Check if user already exists
      const existingUser = await db.get<any>(
        'SELECT * FROM users WHERE pubkey = ? OR address = ?',
        [userData.pubkey, userData.pubkey]
      )

      if (existingUser) {
        console.log(`   ⏭️  User "${userData.name}" already exists, skipping...`)
        users.push(existingUser)
        continue
      }

      const userId = uuidv4()
      await db.run(
        'INSERT INTO users (id, pubkey, address, name, is_profile_complete, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, userData.pubkey, userData.pubkey, userData.name, 1, now, now]
      )

      users.push({ id: userId, pubkey: userData.pubkey, address: userData.pubkey, name: userData.name })
      console.log(`   ✅ Created user "${userData.name}"`)
    }

    console.log(`\n✅ Database seeding complete! 🎉\n`)
    console.log('Summary:')
    console.log(`- ${users.length} users in database`)
    console.log('\nYou can now use these dummy users to:')
    console.log('- Add them as friends in the app')
    console.log('- Create pots and add them as contributors')
    console.log('- Test the social features\n')

  } catch (error) {
    console.error('\n❌ Error seeding database:', error)
    process.exit(1)
  } finally {
    await db.close()
  }
}

seedDatabase()
