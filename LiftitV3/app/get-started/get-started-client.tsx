'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dumbbell, TrendingUp, ClipboardList, ArrowRight, Target, Zap, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: <ClipboardList className="h-6 w-6 text-primary" />,
    title: "Log Workouts",
    description: "Easily track exercises, sets, reps, weight, and RPE with our intuitive interface."
  },
  {
    icon: <TrendingUp className="h-6 w-6 text-accent" />,
    title: "Track Progress",
    description: "Visualize strength gains and workout volume over time with beautiful charts."
  },
  {
    icon: <Target className="h-6 w-6 text-primary" />,
    title: "Set Personal Records",
    description: "Automatically detect and celebrate your PRs for weight, volume, and reps."
  },
  {
    icon: <Dumbbell className="h-6 w-6 text-accent" />,
    title: "Exercise Library",
    description: "Access a comprehensive library of exercises with muscle targeting info."
  },
  {
    icon: <Zap className="h-6 w-6 text-primary" />,
    title: "Smart Suggestions",
    description: "Get AI-powered recommendations for progressive overload."
  },
  {
    icon: <BarChart3 className="h-6 w-6 text-accent" />,
    title: "Analytics Dashboard",
    description: "Deep dive into your training data with advanced analytics."
  }
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

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
}

export default function GetStartedClient() {
  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container mx-auto py-8 md:py-12 px-4 md:px-6"
    >
      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <motion.div 
          variants={itemVariants} 
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 gradient-text">
            Welcome to Liftit V3
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Your ultimate fitness companion. Track workouts, monitor progress, and crush your goals with data-driven insights.
          </p>
          
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center mt-10"
            variants={itemVariants}
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" asChild className="btn-glow h-12 px-8 text-base">
                <Link href="/dashboard">
                  <Dumbbell className="mr-2 h-5 w-5" />
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base border-border/50 hover:border-primary/50">
                <Link href="/progress">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  View Progress
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.section variants={itemVariants} className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-10 gradient-text">
            Everything You Need to Succeed
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Card className="card-modern h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-primary/10 p-3 rounded-xl">
                        {feature.icon}
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Quick Start Guide */}
        <motion.section variants={itemVariants}>
          <Card className="card-modern border-glow shadow-2xl">
            <CardHeader>
              <h2 className="text-2xl font-bold text-center gradient-text">
                Ready to Start?
              </h2>
              <p className="text-center text-muted-foreground pt-2">
                Follow these simple steps to begin your fitness journey
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center space-y-3">
                  <div className="bg-primary/10 text-primary text-2xl font-bold rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                    1
                  </div>
                  <h3 className="font-semibold text-lg">Log Your First Workout</h3>
                  <p className="text-sm text-muted-foreground">
                    Head to the dashboard and start tracking your exercises
                  </p>
                </div>
                
                <div className="text-center space-y-3">
                  <div className="bg-accent/10 text-accent text-2xl font-bold rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                    2
                  </div>
                  <h3 className="font-semibold text-lg">Build Consistency</h3>
                  <p className="text-sm text-muted-foreground">
                    Log workouts regularly to see meaningful progress trends
                  </p>
                </div>
                
                <div className="text-center space-y-3">
                  <div className="bg-primary/10 text-primary text-2xl font-bold rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                    3
                  </div>
                  <h3 className="font-semibold text-lg">Track & Improve</h3>
                  <p className="text-sm text-muted-foreground">
                    Use analytics to identify areas for improvement
                  </p>
                </div>
              </div>
              
              <div className="text-center pt-6">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="lg" asChild className="btn-glow">
                    <Link href="/dashboard">
                      <Dumbbell className="mr-2 h-5 w-5" />
                      Start Your First Workout
                    </Link>
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </motion.div>
  )
}

