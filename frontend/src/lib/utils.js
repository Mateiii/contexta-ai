import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Merges Tailwind class strings, letting later classes win over
// earlier conflicting ones (e.g. cn("p-2", "p-4") -> "p-4").
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
