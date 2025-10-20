const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Create demo user if it doesn't exist
  const demoEmail = 'demo@liftit.app'
  const existingUser = await prisma.user.findUnique({
    where: { email: demoEmail },
  })

  if (!existingUser) {
    const demoUser = await prisma.user.create({
      data: {
        email: demoEmail,
        name: 'Demo User',
        emailVerified: new Date(),
      },
    })
    console.log('Created demo user:', demoUser.email)

    // Create sample workouts for the demo user
    const sampleWorkout1 = await prisma.workout.create({
      data: {
        name: 'Push Day',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        userId: demoUser.id,
        duration: 60,
        exercises: {
          create: [
            {
              name: 'Bench Press',
              sets: {
                create: [
                  { weight: 60, reps: 10, rpe: 7 },
                  { weight: 65, reps: 8, rpe: 8 },
                  { weight: 70, reps: 6, rpe: 9 },
                ],
              },
            },
            {
              name: 'Shoulder Press',
              sets: {
                create: [
                  { weight: 40, reps: 10, rpe: 7 },
                  { weight: 45, reps: 8, rpe: 8 },
                  { weight: 50, reps: 6, rpe: 9 },
                ],
              },
            },
            {
              name: 'Tricep Dips',
              sets: {
                create: [
                  { weight: 0, reps: 12, rpe: 7 },
                  { weight: 0, reps: 10, rpe: 8 },
                  { weight: 0, reps: 8, rpe: 9 },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Created sample workout:', sampleWorkout1.name)

    const sampleWorkout2 = await prisma.workout.create({
      data: {
        name: 'Leg Day',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        userId: demoUser.id,
        duration: 75,
        exercises: {
          create: [
            {
              name: 'Squats',
              sets: {
                create: [
                  { weight: 80, reps: 10, rpe: 7 },
                  { weight: 85, reps: 8, rpe: 8 },
                  { weight: 90, reps: 6, rpe: 9 },
                ],
              },
            },
            {
              name: 'Leg Press',
              sets: {
                create: [
                  { weight: 120, reps: 12, rpe: 7 },
                  { weight: 140, reps: 10, rpe: 8 },
                  { weight: 160, reps: 8, rpe: 9 },
                ],
              },
            },
            {
              name: 'Leg Curls',
              sets: {
                create: [
                  { weight: 40, reps: 12, rpe: 7 },
                  { weight: 45, reps: 10, rpe: 8 },
                  { weight: 50, reps: 8, rpe: 9 },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Created sample workout:', sampleWorkout2.name)

    const sampleWorkout3 = await prisma.workout.create({
      data: {
        name: 'Pull Day',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        userId: demoUser.id,
        duration: 65,
        exercises: {
          create: [
            {
              name: 'Deadlifts',
              sets: {
                create: [
                  { weight: 100, reps: 8, rpe: 7 },
                  { weight: 110, reps: 6, rpe: 8 },
                  { weight: 120, reps: 4, rpe: 9 },
                ],
              },
            },
            {
              name: 'Pull-Ups',
              sets: {
                create: [
                  { weight: 0, reps: 10, rpe: 7 },
                  { weight: 0, reps: 8, rpe: 8 },
                  { weight: 0, reps: 6, rpe: 9 },
                ],
              },
            },
            {
              name: 'Barbell Rows',
              sets: {
                create: [
                  { weight: 60, reps: 10, rpe: 7 },
                  { weight: 65, reps: 8, rpe: 8 },
                  { weight: 70, reps: 6, rpe: 9 },
                ],
              },
            },
          ],
        },
      },
    })
    console.log('Created sample workout:', sampleWorkout3.name)
  } else {
    console.log('Demo user already exists:', existingUser.email)
  }

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

