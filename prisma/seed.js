const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const demoEnabled =
    process.env.ENABLE_DEMO_LOGIN === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true'

  if (!demoEnabled) {
    console.log('Demo login disabled; skipping demo user seeding.')
    return
  }

  const id = process.env.DEMO_LOGIN_USER_ID || 'demo-1'
  const email = process.env.DEMO_LOGIN_EMAIL || 'demo@example.com'
  const name = process.env.DEMO_LOGIN_NAME || 'Demo User'
  const image =
    process.env.DEMO_LOGIN_IMAGE ||
    'https://ui-avatars.com/api/?name=Demo+User&background=0D8ABC&color=fff'

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      image,
    },
    create: {
      id,
      name,
      email,
      image,
    },
  })

  console.log(`Demo user ensured with email ${email}`)
}

main()
  .catch((error) => {
    console.error('Failed to seed demo data:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
