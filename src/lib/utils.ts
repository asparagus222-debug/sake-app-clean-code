import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSakeDisplayName(brandName?: string | null, subBrand?: string | null) {
  const mainName = brandName?.trim() || ''
  const secondaryName = subBrand?.trim() || ''

  if (!mainName) return secondaryName
  if (!secondaryName) return mainName

  const normalizedMain = mainName.replace(/\s+/g, ' ')
  const normalizedSecondary = secondaryName.replace(/\s+/g, ' ')

  if (normalizedMain === normalizedSecondary || normalizedMain.includes(normalizedSecondary)) {
    return mainName
  }

  return `${mainName} ${secondaryName}`
}
