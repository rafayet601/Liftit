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
  const totalVolume = workout.exercises.reduce((acc, ex) => 
    acc + ex.sets.reduce((setAcc, set) => setAcc + (set.weight * set.reps), 0), 0
  );

  return (
    <div className="container mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="mb-6">
        <Button variant="outline" size="sm" asChild className="mb-4">
          <Link href="/dashboard">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">{workout.name}</h1>
            <div className="flex items-center text-muted-foreground">
              <Calendar className="h-4 w-4 mr-2" />
              {formattedDate}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/workouts/${workout.id}/edit`} className="flex items-center">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
            
            <DeleteWorkoutButton workoutId={workout.id} />
          </div>
        </div>
      </div>

      {/* Workout Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="card-modern">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Exercises</div>
            <div className="text-2xl font-bold">{workout.exercises.length}</div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Total Sets</div>
            <div className="text-2xl font-bold">
              {workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="card-modern">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Total Volume</div>
            <div className="text-2xl font-bold">{Math.round(totalVolume)} kg</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Exercises Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Dumbbell className="h-6 w-6 text-primary" />
          Exercises
        </h2>
        
        {workout.exercises.length === 0 ? (
          <div className="text-center p-10 card-modern rounded-xl">
            <p className="text-muted-foreground">No exercises found for this workout.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workout.exercises.map((exercise: Exercise, exerciseIndex: number) => {
              const maxWeight = Math.max(...exercise.sets.map(s => s.weight), 0);
              const totalReps = exercise.sets.reduce((sum, set) => sum + set.reps, 0);
              const exerciseVolume = exercise.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);

              return (
                <Card key={exercise.id} className="card-modern overflow-hidden">
                  <CardHeader className="pb-3 bg-background/40">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                            {exerciseIndex + 1}
                          </span>
                          {exercise.name}
                        </CardTitle>
                        <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                          <span>{exercise.sets.length} sets</span>
                          <span>•</span>
                          <span>{totalReps} total reps</span>
                          {exerciseVolume > 0 && (
                            <>
                              <span>•</span>
                              <span>{Math.round(exerciseVolume)} kg volume</span>
                            </>
                          )}
                        </div>
                      </div>
                      {maxWeight > 0 && (
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Max Weight</div>
                          <div className="text-lg font-bold text-accent">{maxWeight} kg</div>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {exercise.sets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No sets recorded for this exercise.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/50">
                              <th className="text-left font-medium py-2 pr-4 text-muted-foreground">Set</th>
                              <th className="text-left font-medium py-2 px-4 text-muted-foreground">Weight (kg)</th>
                              <th className="text-left font-medium py-2 px-4 text-muted-foreground">Reps</th>
                              <th className="text-left font-medium py-2 px-4 text-muted-foreground">Volume (kg)</th>
                              <th className="text-left font-medium py-2 pl-4 text-muted-foreground">RPE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exercise.sets.map((set: Set, index: number) => (
                              <tr key={set.id} className="border-b border-border/30 hover:bg-background/40 transition-colors">
                                <td className="py-3 pr-4 font-medium">{index + 1}</td>
                                <td className="py-3 px-4">{set.weight}</td>
                                <td className="py-3 px-4">{set.reps}</td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  {(set.weight * set.reps).toFixed(1)}
                                </td>
                                <td className="py-3 pl-4">
                                  {set.rpe !== null ? (
                                    <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                                      {set.rpe}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

