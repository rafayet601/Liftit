/**
 * Unit conversion utilities for weight
 */

export type WeightUnit = 'kg' | 'lbs'

const KG_TO_LBS = 2.20462
const LBS_TO_KG = 0.453592

/**
 * Convert weight from kg to lbs
 */
export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 10) / 10
}

/**
 * Convert weight from lbs to kg
 */
export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 10) / 10
}

/**
 * Convert weight from storage format (kg) to display format
 */
export function convertWeight(kgValue: number, targetUnit: WeightUnit): number {
  if (targetUnit === 'lbs') {
    return kgToLbs(kgValue)
  }
  return kgValue
}

/**
 * Convert weight from display format to storage format (kg)
 */
export function convertToKg(value: number, sourceUnit: WeightUnit): number {
  if (sourceUnit === 'lbs') {
    return lbsToKg(value)
  }
  return value
}

/**
 * Format weight with unit label
 */
export function formatWeight(kgValue: number, unit: WeightUnit): string {
  const weight = convertWeight(kgValue, unit)
  return `${weight}${unit}`
}

/**
 * Get weight unit preference from localStorage
 */
export function getWeightUnitPreference(): WeightUnit {
  if (typeof window === 'undefined') return 'kg'
  
  const stored = localStorage.getItem('weightUnit')
  return (stored === 'lbs' || stored === 'kg') ? stored : 'kg'
}

/**
 * Set weight unit preference in localStorage
 */
export function setWeightUnitPreference(unit: WeightUnit): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('weightUnit', unit)
}

