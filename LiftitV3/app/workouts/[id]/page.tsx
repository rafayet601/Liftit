import React from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, Calendar, Dumbbell, Edit, Trash2 } from 'lucide-react'
import DeleteWorkoutButton from '@/components/DeleteWorkoutButton'
import WorkoutDetailsClient from './workout-details-client'

// Define interfaces for types
interface Set {
  id: string;
  weight: number;
  reps: number;
  rpe: number | null;
}

interface Exercise {
  id: string;
  name: string;
  sets: Set[];
}

interface Workout {
  id: string;
  name: string;
  date: Date;
  duration: number | null;
  exercises: Exercise[];
}

interface Props {
  params: {
    id: string;
  };
}

export default async function WorkoutDetails({ params }: Props) {
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
  
  // Format date for display
  const formattedDate = new Date(workout.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate total volume
  return <WorkoutDetailsClient workout={workout} />;
}

