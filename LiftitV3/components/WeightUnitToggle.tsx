'use client'

import React from 'react'
import { useUnit } from '@/contexts/UnitContext'
import { Button } from './ui/button'
import { Scale } from 'lucide-react'

export function WeightUnitToggle() {
  const { weightUnit, toggleWeightUnit } = useUnit()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleWeightUnit}
      className="h-9 px-3 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
      title="Toggle weight unit"
    >
      <Scale className="h-4 w-4 mr-1.5" />
      {weightUnit.toUpperCase()}
    </Button>
  )
}

