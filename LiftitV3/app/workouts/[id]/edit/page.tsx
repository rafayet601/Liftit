import React from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import EditWorkoutForm from '@/components/EditWorkoutForm'

interface Props {
  params: {
    id: string;
  };
}

export default async function EditWorkout({ params }: Props) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user || !session.user.id) {
    redirect('/auth/signin');
  }
  
  // Fetch the workout with the given ID
  const workout = await prisma.workout.findUnique({
    where: {
      id: params.id,
      userId: session.user.id, // Ensure the workout belongs to the logged-in user
    },
    include: {
      exercises: {
        include: {
          sets: true,
        },
        orderBy: {
          createdAt: 'asc', // Order exercises by creation time
        },
      },
    },
  });
  
  // If workout doesn't exist or doesn't belong to the user, show 404
  if (!workout) {
    notFound();
  }

  // Format the workout for the client component
  const formattedWorkout = {
    id: workout.id,
    name: workout.name,
    date: workout.date.toISOString(),
    exercises: workout.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      sets: exercise.sets.map((set) => ({
        id: set.id,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe,
      })),
    })),
  };

  return (
    <div className="container mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild className="mb-4">
          <Link href={`/workouts/${params.id}`}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Workout
          </Link>
        </Button>
        
        <h1 className="text-3xl md:text-4xl font-bold gradient-text">Edit Workout</h1>
        <p className="text-muted-foreground mt-2">Make changes to your workout details</p>
      </div>
      
      <EditWorkoutForm workout={formattedWorkout} />
    </div>
  );
}

