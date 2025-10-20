'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface DeleteWorkoutButtonProps {
  workoutId: string
}

export default function DeleteWorkoutButton({ workoutId }: DeleteWorkoutButtonProps) {
  const router = useRouter()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Function to open the confirmation dialog
  const openConfirmDialog = () => {
    setIsConfirmOpen(true)
  }
  
  // Function to cancel deletion
  const cancelDelete = () => {
    setIsConfirmOpen(false)
  }
  
  // Function to confirm and execute deletion
  const confirmDelete = async () => {
    try {
      setIsDeleting(true)
      
      const response = await fetch(`/api/workouts/${workoutId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error deleting workout')
      }
      
      // Navigate back to dashboard after successful deletion
      router.push('/dashboard')
      router.refresh()
      
    } catch (error) {
      console.error('Error deleting workout:', error)
      alert('Failed to delete workout. Please try again.')
    } finally {
      setIsDeleting(false)
      setIsConfirmOpen(false)
    }
  }
  
  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={openConfirmDialog}
        className="flex items-center text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
      </Button>
      
      {/* Confirmation Dialog */}
      <AnimatePresence>
        {isConfirmOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={cancelDelete}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="card-modern p-6 rounded-xl shadow-2xl max-w-md w-full border-glow"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4">
                <div className="bg-destructive/10 rounded-full p-3 w-fit mb-4">
                  <Trash2 className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-xl font-bold mb-2">Delete Workout?</h3>
                <p className="text-muted-foreground">
                  Are you sure you want to delete this workout? This action cannot be undone and all associated exercises and sets will be permanently removed.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={cancelDelete}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="min-w-[100px]"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

