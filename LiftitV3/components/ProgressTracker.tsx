'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Calendar, Activity, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

interface ExerciseProgress {
  date: string
  weight: number
  reps: number
  volume: number
  sets: number
}

interface ProgressTrackerProps {
  userId: string
  exerciseName?: string
}

export default function ProgressTracker({ userId, exerciseName }: ProgressTrackerProps) {
  const [exercises, setExercises] = useState<string[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [progressData, setProgressData] = useState<ExerciseProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeFrame, setTimeFrame] = useState<'30days' | '90days' | '365days'>('30days')
  
  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const response = await fetch(`/api/progress/exercises?userId=${userId}`)
        if (!response.ok) throw new Error('Failed to fetch exercises')
        
        const data = await response.json()
        setExercises(data)
        
        if (exerciseName && data.includes(exerciseName)) {
          setSelectedExercise(exerciseName)
        } else if (data.length > 0) {
          setSelectedExercise(data[0])
        }
      } catch (error) {
        console.error('Error fetching exercises:', error)
      }
    }
    
    fetchExercises()
  }, [userId, exerciseName])
  
  useEffect(() => {
    if (!selectedExercise) {
      setIsLoading(false)
      return
    }
    
    const fetchProgressData = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/progress/data?userId=${userId}&exercise=${encodeURIComponent(selectedExercise)}&timeFrame=${timeFrame}`
        )
        
        if (!response.ok) throw new Error('Failed to fetch progress data')
        
        const data = await response.json()
        
        const formattedData = data.map((entry: any) => ({
          date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          weight: entry.weight,
          reps: entry.reps,
          volume: entry.volume,
          sets: entry.sets
        }))
        
        setProgressData(formattedData)
      } catch (error) {
        console.error('Error fetching progress data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchProgressData()
  }, [userId, selectedExercise, timeFrame])
  
  if (exercises.length === 0) {
    return (
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Progress Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16">
            <div className="bg-primary/10 rounded-full p-6 inline-block mb-4">
              <Activity className="h-12 w-12 text-primary/80" />
            </div>
            <p className="text-muted-foreground text-lg">
              No exercise data available yet. Log some workouts to start tracking your progress!
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  const getMaxValue = (data: ExerciseProgress[], key: keyof ExerciseProgress) => {
    if (data.length === 0) return 100
    const max = Math.max(...data.map(item => Number(item[key])))
    return Math.ceil(max * 1.2)
  }

  const calculateStats = () => {
    if (progressData.length < 2) return null
    
    const first = progressData[0]
    const last = progressData[progressData.length - 1]
    
    const weightChange = last.weight - first.weight
    const volumeChange = last.volume - first.volume
    
    return {
      weightChange,
      volumeChange,
      weightChangePercent: first.weight > 0 ? Math.round((weightChange / first.weight) * 100) : 0,
      volumeChangePercent: first.volume > 0 ? Math.round((volumeChange / first.volume) * 100) : 0,
    }
  }

  const stats = calculateStats()
  
  return (
    <div className="space-y-6">
      {/* Exercise Selector */}
      <Card className="card-modern">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Select Exercise
          </CardTitle>
          <CardDescription>Choose an exercise to view progress over time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="w-full p-3 border rounded-lg bg-background/50 border-border/40 focus:border-primary/50 transition-all h-12 text-base"
          >
            {exercises.map((exercise) => (
              <option key={exercise} value={exercise}>
                {exercise}
              </option>
            ))}
          </select>
          
          <div className="flex flex-wrap gap-2">
            {(['30days', '90days', '365days'] as const).map((tf) => (
              <Button
                key={tf}
                variant={timeFrame === tf ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeFrame(tf)}
                className={timeFrame === tf ? 'btn-glow' : ''}
              >
                {tf === '30days' && '30 Days'}
                {tf === '90days' && '3 Months'}
                {tf === '365days' && '1 Year'}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      {stats && progressData.length >= 2 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Card className="card-modern stat-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Weight Progress</p>
                  <p className="text-2xl font-bold">
                    {stats.weightChange > 0 ? '+' : ''}{stats.weightChange}kg
                  </p>
                  <p className={`text-sm ${stats.weightChange >= 0 ? 'text-accent' : 'text-destructive'}`}>
                    {stats.weightChange >= 0 ? '↑' : '↓'} {Math.abs(stats.weightChangePercent)}%
                  </p>
                </div>
                <div className="bg-primary/10 p-3 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-modern stat-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Volume Progress</p>
                  <p className="text-2xl font-bold">
                    {stats.volumeChange > 0 ? '+' : ''}{Math.round(stats.volumeChange)}kg
                  </p>
                  <p className={`text-sm ${stats.volumeChange >= 0 ? 'text-accent' : 'text-destructive'}`}>
                    {stats.volumeChange >= 0 ? '↑' : '↓'} {Math.abs(stats.volumeChangePercent)}%
                  </p>
                </div>
                <div className="bg-accent/10 p-3 rounded-xl">
                  <Activity className="h-6 w-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
        
      {isLoading ? (
        <Card className="card-modern">
          <CardContent className="flex justify-center items-center h-96">
            <div className="loading-spinner h-12 w-12" />
          </CardContent>
        </Card>
      ) : progressData.length === 0 ? (
        <Card className="card-modern">
          <CardContent className="text-center py-16">
            <div className="bg-primary/10 rounded-full p-6 inline-block mb-4">
              <Calendar className="h-12 w-12 text-primary/80" />
            </div>
            <p className="text-muted-foreground text-lg">
              No data available for {selectedExercise} in the selected time period.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Weight Progress Chart */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle>Weight Progress (kg)</CardTitle>
              <CardDescription>Track your maximum weight lifted over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      domain={[0, getMaxValue(progressData, 'weight')]}
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      activeDot={{ r: 6 }} 
                      name="Weight (kg)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Volume Progress Chart */}
          <Card className="card-modern">
            <CardHeader>
              <CardTitle>Volume Progress (weight × reps)</CardTitle>
              <CardDescription>Monitor your total training volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      domain={[0, getMaxValue(progressData, 'volume')]}
                      stroke="hsl(var(--muted-foreground))"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem',
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="volume" 
                      stroke="hsl(var(--accent))" 
                      strokeWidth={2}
                      activeDot={{ r: 6 }} 
                      name="Volume"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

