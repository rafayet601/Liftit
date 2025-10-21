'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { WeightUnit, getWeightUnitPreference, setWeightUnitPreference } from '@/lib/unitConversion'

interface UnitContextType {
  weightUnit: WeightUnit
  setWeightUnit: (unit: WeightUnit) => void
  toggleWeightUnit: () => void
}

const UnitContext = createContext<UnitContextType | undefined>(undefined)

export function UnitProvider({ children }: { children: ReactNode }) {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('kg')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const preference = getWeightUnitPreference()
    setWeightUnitState(preference)
  }, [])

  const setWeightUnit = (unit: WeightUnit) => {
    setWeightUnitState(unit)
    setWeightUnitPreference(unit)
  }

  const toggleWeightUnit = () => {
    const newUnit: WeightUnit = weightUnit === 'kg' ? 'lbs' : 'kg'
    setWeightUnit(newUnit)
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <UnitContext.Provider value={{ weightUnit, setWeightUnit, toggleWeightUnit }}>
      {children}
    </UnitContext.Provider>
  )
}

export function useUnit() {
  const context = useContext(UnitContext)
  if (context === undefined) {
    throw new Error('useUnit must be used within a UnitProvider')
  }
  return context
}

