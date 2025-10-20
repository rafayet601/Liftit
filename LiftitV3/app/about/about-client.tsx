'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dumbbell, TrendingUp, Target, Zap, Github, Heart, Code, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: <Dumbbell className="h-6 w-6 text-primary" />,
    title: "Smart Workout Tracking",
    description: "Log exercises, sets, reps, weight, and RPE with an intuitive interface designed for speed and efficiency."
  },
  {
    icon: <TrendingUp className="h-6 w-6 text-accent" />,
    title: "Progress Visualization",
    description: "Beautiful charts and graphs to track your strength gains, workout volume, and personal records over time."
  },
  {
    icon: <Target className="h-6 w-6 text-primary" />,
    title: "Personal Records",
    description: "Automatically track and celebrate your PRs for weight, volume, and reps across all exercises."
  },
  {
    icon: <Zap className="h-6 w-6 text-accent" />,
    title: "Progressive Overload",
    description: "Get intelligent recommendations for progressive overload based on your workout history and performance."
  }
]

const techStack = [
  { name: "Next.js 14", description: "React framework with App Router" },
  { name: "TypeScript", description: "Type-safe development" },
  { name: "Prisma", description: "Modern database ORM" },
  { name: "NextAuth.js", description: "Authentication solution" },
  { name: "Tailwind CSS", description: "Utility-first styling" },
  { name: "Framer Motion", description: "Smooth animations" },
  { name: "Recharts", description: "Data visualization" },
  { name: "shadcn/ui", description: "Beautiful UI components" }
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { 
      type: "spring" as const,
      stiffness: 300,
      damping: 24
    }
  }
}

export default function AboutClient() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container mx-auto py-8 md:py-12 px-4 md:px-6"
    >
      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <motion.div variants={itemVariants} className="text-center mb-16">
          <div className="bg-gradient-to-br from-primary/20 to-accent/10 p-6 rounded-2xl inline-block mb-6">
            <Dumbbell className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 gradient-text">
            About Liftit V3
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            A modern, data-driven fitness tracking application built to help you achieve your strength training goals through intelligent tracking and beautiful visualization.
          </p>
        </motion.div>

        {/* Mission Section */}
        <motion.div variants={itemVariants} className="mb-16">
          <Card className="card-modern border-glow">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3">
                <Heart className="h-6 w-6 text-primary" />
                Our Mission
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground leading-relaxed space-y-4">
              <p>
                Liftit V3 was created with a simple goal: make fitness tracking effortless and insightful. 
                We believe that tracking your workouts shouldn't be a chore, and understanding your progress 
                shouldn't require a degree in data science.
              </p>
              <p>
                By combining modern web technologies with thoughtful UX design, we've built a platform that 
                makes it easy to log workouts on the go, visualize your progress over time, and make data-driven 
                decisions about your training.
              </p>
              <p>
                Whether you're a beginner starting your fitness journey or an experienced lifter optimizing 
                your training, Liftit V3 provides the tools you need to succeed.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Features Grid */}
        <motion.section variants={itemVariants} className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-10 gradient-text">
            Key Features
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ type: "spring" as const, stiffness: 400 }}
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

        {/* Tech Stack */}
        <motion.section variants={itemVariants} className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-10 gradient-text">
            Built With Modern Technology
          </h2>
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Code className="h-6 w-6 text-primary" />
                Technology Stack
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {techStack.map((tech, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.05 }}
                    className="p-4 rounded-lg bg-background/50 border border-border/30 hover:border-primary/30 transition-colors"
                  >
                    <div className="font-semibold text-sm mb-1">{tech.name}</div>
                    <div className="text-xs text-muted-foreground">{tech.description}</div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Open Source */}
        <motion.section variants={itemVariants} className="mb-16">
          <Card className="card-modern border-glow bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="p-8 text-center">
              <div className="bg-primary/10 rounded-full p-4 w-fit mx-auto mb-6">
                <Github className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Open Source & Customizable</h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Liftit V3 is built with modern, maintainable code that you can customize to fit your needs. 
                The codebase follows best practices and is designed to be easy to understand and extend.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="lg" asChild className="btn-glow">
                    <Link href="/dashboard">
                      <Dumbbell className="mr-2 h-5 w-5" />
                      Start Training
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* Version Info */}
        <motion.div variants={itemVariants} className="text-center text-sm text-muted-foreground">
          <p>Version 3.0 • Built with ❤️ for fitness enthusiasts</p>
          <p className="mt-2">
            © {new Date().getFullYear()} Liftit V3 • Empowering your fitness journey
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
}

