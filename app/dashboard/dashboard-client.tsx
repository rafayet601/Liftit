'use client'

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WorkoutForm from '@/components/WorkoutForm'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, PlusCircle, Eye, ChevronRight, Calendar, BarChart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface Set {
  id: string;
  weight: number;
  reps: number;
  rpe?: number | null;
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
  exercises: Exercise[];
}

// Animation variants for staggered children
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function DashboardClient({ workouts }: { workouts: Workout[] }) {
  const { data: session } = useSession()
  const [isFormVisible, setIsFormVisible] = useState(false)
  const router = useRouter()
  
  if (!session) {
    return null // Let the server component handle the redirect
  }

  const handleWorkoutAdded = () => {
    setIsFormVisible(false)
    router.refresh() // Refresh the page to get the latest data
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight gradient-text mb-4 sm:mb-0">
          Workout Dashboard
        </h1>
        <div className="flex flex-wrap gap-3">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button asChild variant="outline" className="border-glow shadow-sm">
              <Link href="/progress" className="flex items-center">
                <BarChart className="h-4 w-4 mr-2" />
                Progress Analytics
              </Link>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              variant="default" 
              className="flex items-center shadow-lg shadow-primary/20"
              onClick={() => setIsFormVisible(!isFormVisible)}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              {isFormVisible ? 'Hide Form' : 'Log Workout'}
            </Button>
          </motion.div>
        </div>
      </motion.div>
      
      {/* Add New Workout Form Card */}
      <AnimatePresence>
        {isFormVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3 }}
          >
            <Card className="mb-12 border-glow bg-card/80 backdrop-blur-sm shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-primary" />
                  Log a New Workout
                </CardTitle>
                <CardDescription className="text-muted-foreground pt-1">
                  Track your latest training session and monitor your progress.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkoutForm onSuccess={handleWorkoutAdded} />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Recent Workouts Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Recent Workouts</h2>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary">
            <Link href="/workouts" className="flex items-center gap-1 text-xs">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
        
        {!workouts || workouts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-16 px-6 bg-card/80 rounded-lg border-glow shadow-lg"
          >
            <div className="bg-primary/10 rounded-full p-4 inline-block mb-4">
              <Calendar className="h-8 w-8 text-primary/80" />
            </div>
            <h3 className="text-xl font-medium mb-2">No Workouts Yet!</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start logging your training sessions to track your progress and visualize your fitness journey.
            </p>
            <Button onClick={() => setIsFormVisible(true)} className="shadow-lg shadow-primary/20">
              <PlusCircle className="h-4 w-4 mr-2" />
              Log Your First Workout
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {workouts.map((workout: Workout) => (
              <motion.div key={workout.id} variants={itemVariants}>
                <Card className="bg-card/80 backdrop-blur-sm border-glow card-hover-effect flex flex-col overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-lg font-semibold text-primary leading-tight">{workout.name}</CardTitle>
                      <span className="text-xs text-muted-foreground whitespace-nowrap px-2 py-1 bg-background/50 rounded-md">
                        {new Date(workout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow pb-4">
                    <ul className="space-y-2 text-sm mb-4">
                      {workout.exercises.slice(0, 4).map((exercise: Exercise) => (
                        <li key={exercise.id} className="flex justify-between items-center text-muted-foreground">
                          <span>{exercise.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-md font-medium">{exercise.sets.length} sets</span>
                        </li>
                      ))}
                      {workout.exercises.length > 4 && (
                        <li className="text-xs text-muted-foreground/80 pt-1 text-center">+ {workout.exercises.length - 4} more exercises</li>
                      )}
                    </ul>
                  </CardContent>
                  <div className="mt-auto border-t border-border/40 bg-background/20 backdrop-blur-sm px-4 py-3">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant="ghost" size="sm" asChild className="w-full text-primary hover:text-primary hover:bg-primary/10">
                        <Link href={`/workouts/${workout.id}`} className="flex items-center justify-center">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Link>
                      </Button>
                    </motion.div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </div>
  )
} 