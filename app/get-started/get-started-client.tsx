'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dumbbell, TrendingUp, ClipboardList, ArrowRight, Copy, CheckCircle } from 'lucide-react'
import WorkoutTemplateButton from '../../components/WorkoutTemplateButton'
import { motion } from 'framer-motion'

const sampleWorkouts = [
  {
    id: "full-body",
    name: "Full Body Strength",
    description: "Balanced workout targeting all major muscle groups.",
    exercises: [
      { name: "Bench Press", sets: [{ weight: 60, reps: 10, rpe: 7 }, { weight: 65, reps: 8, rpe: 8 }, { weight: 70, reps: 6, rpe: 9 }] },
      { name: "Squats", sets: [{ weight: 80, reps: 10, rpe: 7 }, { weight: 85, reps: 8, rpe: 8 }, { weight: 90, reps: 6, rpe: 9 }] },
      { name: "Bent Over Rows", sets: [{ weight: 50, reps: 10, rpe: 7 }, { weight: 55, reps: 8, rpe: 8 }, { weight: 60, reps: 6, rpe: 9 }] },
      { name: "Shoulder Press", sets: [{ weight: 40, reps: 10, rpe: 7 }, { weight: 45, reps: 8, rpe: 8 }, { weight: 50, reps: 6, rpe: 9 }] }
    ],
    displaySets: "3 sets × 6-10 reps"
  },
  {
    id: "upper-body",
    name: "Upper Body Power",
    description: "Focus on chest, back, and arm strength.",
    exercises: [
      { name: "Push-Ups", sets: [{ weight: 0, reps: 15, rpe: 7 }, { weight: 0, reps: 12, rpe: 8 }, { weight: 0, reps: 10, rpe: 9 }] },
      { name: "Pull-Ups", sets: [{ weight: 0, reps: 8, rpe: 7 }, { weight: 0, reps: 6, rpe: 8 }, { weight: 0, reps: 5, rpe: 9 }] },
      { name: "Dips", sets: [{ weight: 0, reps: 12, rpe: 7 }, { weight: 0, reps: 10, rpe: 8 }, { weight: 0, reps: 8, rpe: 9 }] },
      { name: "Bicep Curls", sets: [{ weight: 15, reps: 12, rpe: 7 }, { weight: 17.5, reps: 10, rpe: 8 }, { weight: 20, reps: 8, rpe: 9 }] }
    ],
    displaySets: "3 sets × reps vary"
  }
]

const features = [
  {
    icon: <ClipboardList className="h-6 w-6 text-primary" />,
    title: "Log Workouts",
    description: "Easily track exercises, sets, reps, and weights."
  },
  {
    icon: <TrendingUp className="h-6 w-6 text-primary" />,
    title: "Track Progress",
    description: "Visualize strength gains and workout volume over time."
  },
  {
    icon: <Dumbbell className="h-6 w-6 text-primary" />,
    title: "Exercise Library",
    description: "Access exercises with form guidance (coming soon)."
  }
]

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 24
    }
  }
};

export default function GetStartedClient() {
  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container mx-auto py-12 px-4 md:px-6"
    >
      <div className="max-w-4xl mx-auto">
        <motion.div 
          variants={itemVariants} 
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 gradient-text">Welcome to Liftit</h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Start tracking your fitness journey. Log workouts, monitor progress, and build strength.
          </p>
        </motion.div>

        {/* Features Section */}
        <motion.section variants={itemVariants} className="mb-20">
          <h2 className="text-3xl font-semibold text-center mb-10 gradient-text">Key Features</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                whileHover={{ y: -5 }}
                transition={{ type: "spring", stiffness: 400 }}
                className="bg-card/80 backdrop-blur-sm p-8 rounded-lg border-glow shadow-xl text-center flex flex-col items-center"
              >
                <div className="mb-4 bg-primary/10 p-4 rounded-full">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3 text-primary">{feature.title}</h3>
                <p className="text-sm text-muted-foreground flex-grow">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Sample Workouts Section */}
        <motion.section variants={itemVariants} className="mb-20">
          <h2 className="text-3xl font-semibold text-center mb-10 gradient-text">Get Started with a Template</h2>
          <div className="grid gap-8 md:grid-cols-2">
            {sampleWorkouts.map((workout, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Card className="bg-card/80 backdrop-blur-sm border-glow shadow-xl flex flex-col h-full">
                  <CardHeader>
                    <CardTitle className="text-xl text-primary">{workout.name}</CardTitle>
                    <p className="text-sm text-muted-foreground pt-1">{workout.description}</p>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <ul className="space-y-3 mb-6">
                      {workout.exercises.slice(0, 3).map((exercise, i) => (
                        <li key={i} className="flex items-center text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 mr-2 text-primary/80 flex-shrink-0" />
                          <span>{exercise.name} - {workout.displaySets}</span>
                        </li>
                      ))}
                      {workout.exercises.length > 3 && (
                        <li className="text-sm text-muted-foreground/80 pl-6">+ {workout.exercises.length - 3} more exercises</li>
                      )}
                    </ul>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <WorkoutTemplateButton 
                        workout={workout} 
                        templateId={workout.id}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Use This Template
                      </WorkoutTemplateButton>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Quick Start Guide Section */}
        <motion.section variants={itemVariants}>
          <Card className="border-glow bg-card/80 backdrop-blur-sm p-8 rounded-lg shadow-xl">
            <h2 className="text-2xl font-semibold mb-8 text-center gradient-text">Your Next Steps</h2>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <ol className="space-y-5 list-decimal list-outside ml-5 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Log your first workout:</span> Head to the Dashboard and click &ldquo;Log Workout&rdquo;.
                </li>
                <li>
                  <span className="font-medium text-foreground">Explore Progress:</span> After a few sessions, check the Progress page for insights.
                </li>
                <li>
                  <span className="font-medium text-foreground">Customize:</span> Add your own exercises and build custom routines.
                </li>
              </ol>
              <div className="text-center md:text-right">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30">
                    <Link href="/dashboard">
                      Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </motion.div>
              </div>
            </div>
          </Card>
        </motion.section>
      </div>
    </motion.div>
  )
} 