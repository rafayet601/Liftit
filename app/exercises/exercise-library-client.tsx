'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Search, Dumbbell, Filter, PlusCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'

// Define types for the exercise data
type Exercise = {
  id: string;
  name: string;
  category: string;
  muscles: string[];
  equipment: string;
};

// Sample exercise categories - in a real app, fetch from an API
const categories = [
  "Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio", "Full Body"
];

// Sample exercise library - in a real app, fetch from an API
const exerciseLibrary: Exercise[] = [
  { id: "ex1", name: "Bench Press", category: "Chest", muscles: ["Chest", "Triceps", "Shoulders"], equipment: "Barbell" },
  { id: "ex2", name: "Squat", category: "Legs", muscles: ["Quadriceps", "Hamstrings", "Glutes"], equipment: "Barbell" },
  { id: "ex3", name: "Deadlift", category: "Back", muscles: ["Lower Back", "Hamstrings", "Glutes"], equipment: "Barbell" },
  { id: "ex4", name: "Pull-up", category: "Back", muscles: ["Lats", "Biceps"], equipment: "Bodyweight" },
  { id: "ex5", name: "Push-up", category: "Chest", muscles: ["Chest", "Triceps", "Shoulders"], equipment: "Bodyweight" },
  { id: "ex6", name: "Lateral Raise", category: "Shoulders", muscles: ["Deltoids"], equipment: "Dumbbells" },
  { id: "ex7", name: "Bicep Curl", category: "Arms", muscles: ["Biceps"], equipment: "Dumbbells" },
  { id: "ex8", name: "Plank", category: "Core", muscles: ["Abs", "Lower Back"], equipment: "Bodyweight" },
  { id: "ex9", name: "Leg Press", category: "Legs", muscles: ["Quadriceps", "Hamstrings", "Glutes"], equipment: "Machine" },
  { id: "ex10", name: "Shoulder Press", category: "Shoulders", muscles: ["Deltoids", "Triceps"], equipment: "Dumbbells" },
  { id: "ex11", name: "Romanian Deadlift", category: "Back", muscles: ["Hamstrings", "Lower Back", "Glutes"], equipment: "Barbell" },
  { id: "ex12", name: "Tricep Extension", category: "Arms", muscles: ["Triceps"], equipment: "Cable" },
  { id: "ex13", name: "Leg Curl", category: "Legs", muscles: ["Hamstrings"], equipment: "Machine" },
  { id: "ex14", name: "Calf Raise", category: "Legs", muscles: ["Calves"], equipment: "Machine" },
  { id: "ex15", name: "Lat Pulldown", category: "Back", muscles: ["Lats", "Biceps"], equipment: "Cable" },
];

export default function ExerciseLibraryClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filteredExercises, setFilteredExercises] = useState(exerciseLibrary);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("0");
  
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Apply filtering based on search term and selected category
    setFilteredExercises(
      exerciseLibrary.filter((exercise) => {
        const matchesSearch = exercise.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === '' || exercise.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
    );
  }, [searchTerm, selectedCategory]);

  const handleAddToWorkout = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setShowAddDialog(true);
  };

  const handleAddToNewWorkout = () => {
    if (!selectedExercise) return;
    
    // Create a new workout with this exercise
    const workout = {
      name: `${selectedExercise.name} Workout`,
      date: new Date().toISOString(),
      exercises: [
        {
          name: selectedExercise.name,
          sets: Array(parseInt(sets, 10)).fill(null).map(() => ({
            weight: parseFloat(weight),
            reps: parseInt(reps, 10),
            rpe: null
          }))
        }
      ]
    };

    // Call the API to create a new workout
    fetch('/api/workouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workout),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to create workout');
      }
      return response.json();
    })
    .then(data => {
      toast({
        title: "Workout Created",
        description: `New workout with ${selectedExercise.name} created successfully`,
      });
      setShowAddDialog(false);
      
      // Navigate to the dashboard to see the new workout
      router.push('/dashboard');
    })
    .catch(error => {
      console.error('Error creating workout:', error);
      toast({
        title: "Error",
        description: "Failed to create workout. Please try again.",
        variant: "destructive",
      });
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight gradient-text mb-4 sm:mb-0">
          Exercise Library
        </h1>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button asChild variant="default" className="shadow-lg shadow-primary/20">
            <Link href="/exercises/create" className="flex items-center">
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Custom Exercise
            </Link>
          </Button>
        </motion.div>
      </motion.div>

      {/* Search and Filter Section */}
      <Card className="mb-8 border-glow bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exercises..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <Button
                variant={selectedCategory === '' ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory('')}
                className="whitespace-nowrap"
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="whitespace-nowrap"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exercise Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExercises.map((exercise) => (
          <motion.div
            key={exercise.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ y: -4 }}
          >
            <Card className="h-full flex flex-col border-glow card-hover-effect">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{exercise.name}</CardTitle>
                  <span className="text-xs bg-primary/10 text-primary rounded-md px-2 py-1">
                    {exercise.category}
                  </span>
                </div>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <Dumbbell className="h-3 w-3" /> {exercise.equipment}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4 text-sm">
                <div className="flex flex-wrap gap-1 mt-1">
                  {exercise.muscles.map((muscle, index) => (
                    <span 
                      key={index} 
                      className="bg-muted text-muted-foreground text-xs rounded-md px-2 py-0.5"
                    >
                      {muscle}
                    </span>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="pt-2 mt-auto">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full"
                  onClick={() => handleAddToWorkout(exercise)}
                >
                  Add to Workout
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredExercises.length === 0 && (
        <div className="text-center py-16">
          <div className="bg-primary/10 rounded-full p-4 inline-block mb-4">
            <Search className="h-6 w-6 text-primary/80" />
          </div>
          <h3 className="text-xl font-medium mb-2">No exercises found</h3>
          <p className="text-muted-foreground mb-6">
            Try adjusting your search or filters to find what you&apos;re looking for.
          </p>
        </div>
      )}

      {/* Add to Workout Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {selectedExercise?.name} to Workout</DialogTitle>
            <DialogDescription>
              Configure sets and reps for this exercise
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label htmlFor="sets" className="text-sm font-medium">
                  Sets
                </label>
                <Input
                  id="sets"
                  type="number"
                  min="1"
                  value={sets}
                  onChange={(e) => setSets(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="reps" className="text-sm font-medium">
                  Reps
                </label>
                <Input
                  id="reps"
                  type="number"
                  min="1"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="weight" className="text-sm font-medium">
                  Weight
                </label>
                <Input
                  id="weight"
                  type="number"
                  min="0"
                  step="0.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="flex items-center"
              onClick={handleAddToNewWorkout}
            >
              Create New Workout <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 