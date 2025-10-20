'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Dumbbell, Filter, Target } from 'lucide-react'
import { motion } from 'framer-motion'

interface Exercise {
  name: string
  category: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipment: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

const exerciseDatabase: Exercise[] = [
  // Chest
  { name: 'Bench Press', category: 'Chest', primaryMuscles: ['Chest'], secondaryMuscles: ['Shoulders', 'Triceps'], equipment: ['Barbell', 'Bench'], difficulty: 'intermediate' },
  { name: 'Incline Bench Press', category: 'Chest', primaryMuscles: ['Upper Chest'], secondaryMuscles: ['Shoulders', 'Triceps'], equipment: ['Barbell', 'Bench'], difficulty: 'intermediate' },
  { name: 'Dumbbell Flyes', category: 'Chest', primaryMuscles: ['Chest'], secondaryMuscles: [], equipment: ['Dumbbells', 'Bench'], difficulty: 'beginner' },
  { name: 'Push-Ups', category: 'Chest', primaryMuscles: ['Chest'], secondaryMuscles: ['Shoulders', 'Triceps'], equipment: ['Bodyweight'], difficulty: 'beginner' },
  
  // Back
  { name: 'Deadlifts', category: 'Back', primaryMuscles: ['Back', 'Lower Back'], secondaryMuscles: ['Hamstrings', 'Glutes'], equipment: ['Barbell'], difficulty: 'advanced' },
  { name: 'Pull-Ups', category: 'Back', primaryMuscles: ['Lats'], secondaryMuscles: ['Biceps'], equipment: ['Bodyweight'], difficulty: 'intermediate' },
  { name: 'Bent Over Rows', category: 'Back', primaryMuscles: ['Back'], secondaryMuscles: ['Biceps'], equipment: ['Barbell'], difficulty: 'intermediate' },
  { name: 'Lat Pulldowns', category: 'Back', primaryMuscles: ['Lats'], secondaryMuscles: ['Biceps'], equipment: ['Cable Machine'], difficulty: 'beginner' },
  
  // Legs
  { name: 'Squats', category: 'Legs', primaryMuscles: ['Quadriceps', 'Glutes'], secondaryMuscles: ['Hamstrings'], equipment: ['Barbell'], difficulty: 'intermediate' },
  { name: 'Leg Press', category: 'Legs', primaryMuscles: ['Quadriceps'], secondaryMuscles: ['Glutes'], equipment: ['Machine'], difficulty: 'beginner' },
  { name: 'Leg Curls', category: 'Legs', primaryMuscles: ['Hamstrings'], secondaryMuscles: [], equipment: ['Machine'], difficulty: 'beginner' },
  { name: 'Lunges', category: 'Legs', primaryMuscles: ['Quadriceps', 'Glutes'], secondaryMuscles: ['Hamstrings'], equipment: ['Bodyweight', 'Dumbbells'], difficulty: 'beginner' },
  
  // Shoulders
  { name: 'Shoulder Press', category: 'Shoulders', primaryMuscles: ['Shoulders'], secondaryMuscles: ['Triceps'], equipment: ['Barbell', 'Dumbbells'], difficulty: 'intermediate' },
  { name: 'Lateral Raises', category: 'Shoulders', primaryMuscles: ['Side Delts'], secondaryMuscles: [], equipment: ['Dumbbells'], difficulty: 'beginner' },
  { name: 'Front Raises', category: 'Shoulders', primaryMuscles: ['Front Delts'], secondaryMuscles: [], equipment: ['Dumbbells'], difficulty: 'beginner' },
  
  // Arms
  { name: 'Bicep Curls', category: 'Arms', primaryMuscles: ['Biceps'], secondaryMuscles: [], equipment: ['Dumbbells', 'Barbell'], difficulty: 'beginner' },
  { name: 'Tricep Dips', category: 'Arms', primaryMuscles: ['Triceps'], secondaryMuscles: ['Chest'], equipment: ['Bodyweight'], difficulty: 'intermediate' },
  { name: 'Hammer Curls', category: 'Arms', primaryMuscles: ['Biceps'], secondaryMuscles: ['Forearms'], equipment: ['Dumbbells'], difficulty: 'beginner' },
  { name: 'Tricep Extensions', category: 'Arms', primaryMuscles: ['Triceps'], secondaryMuscles: [], equipment: ['Dumbbells', 'Cable'], difficulty: 'beginner' },
]

const categories = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms']
const difficulties = ['All', 'beginner', 'intermediate', 'advanced']

export default function ExerciseLibraryClient() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedDifficulty, setSelectedDifficulty] = useState('All')

  const filteredExercises = useMemo(() => {
    return exerciseDatabase.filter(exercise => {
      const matchesSearch = exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          exercise.primaryMuscles.some(m => m.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = selectedCategory === 'All' || exercise.category === selectedCategory
      const matchesDifficulty = selectedDifficulty === 'All' || exercise.difficulty === selectedDifficulty
      
      return matchesSearch && matchesCategory && matchesDifficulty
    })
  }, [searchTerm, selectedCategory, selectedDifficulty])

  const getDifficultyColor = (difficulty: string) => {
    switch(difficulty) {
      case 'beginner': return 'text-accent'
      case 'intermediate': return 'text-primary'
      case 'advanced': return 'text-destructive'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight gradient-text mb-2">
            Exercise Library
          </h1>
          <p className="text-muted-foreground text-lg">
            Browse exercises and find new movements for your workouts
          </p>
        </div>

        {/* Filters */}
        <Card className="card-modern mb-8">
          <CardContent className="p-6 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search exercises..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
              />
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={selectedCategory === category ? 'btn-glow' : ''}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Difficulty
              </label>
              <div className="flex flex-wrap gap-2">
                {difficulties.map(difficulty => (
                  <Button
                    key={difficulty}
                    variant={selectedDifficulty === difficulty ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className={selectedDifficulty === difficulty ? 'btn-glow' : ''}
                  >
                    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}
        </div>

        {/* Exercise Grid */}
        {filteredExercises.length === 0 ? (
          <Card className="card-modern">
            <CardContent className="text-center py-16">
              <div className="bg-primary/10 rounded-full p-6 inline-block mb-4">
                <Dumbbell className="h-12 w-12 text-primary/80" />
              </div>
              <p className="text-muted-foreground text-lg">
                No exercises found matching your criteria
              </p>
            </CardContent>
          </Card>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredExercises.map((exercise, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="card-modern h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-lg">{exercise.name}</CardTitle>
                      <span className={`text-xs font-medium px-2 py-1 rounded-md bg-background/50 ${getDifficultyColor(exercise.difficulty)}`}>
                        {exercise.difficulty}
                      </span>
                    </div>
                    <CardDescription className="text-sm">
                      {exercise.category}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium mb-1 text-foreground/80">Primary Muscles</h4>
                      <div className="flex flex-wrap gap-1">
                        {exercise.primaryMuscles.map((muscle, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-md">
                            {muscle}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {exercise.secondaryMuscles.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-1 text-foreground/80">Secondary Muscles</h4>
                        <div className="flex flex-wrap gap-1">
                          {exercise.secondaryMuscles.map((muscle, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-accent/10 text-accent rounded-md">
                              {muscle}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <h4 className="text-sm font-medium mb-1 text-foreground/80">Equipment</h4>
                      <p className="text-xs text-muted-foreground">
                        {exercise.equipment.join(', ')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}

