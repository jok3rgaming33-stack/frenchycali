export const EUROS_PER_POINT = 1

export function computeLoyaltyPoints(total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.floor(total / EUROS_PER_POINT)
}

export type LoyaltyReward = {
  points: number
  discount: number
  minAmount: number
  label: string
}

export const LOYALTY_REWARDS: LoyaltyReward[] = [
  { points: 300, discount: 10, minAmount: 50, label: "-10€" },
  { points: 500, discount: 20, minAmount: 100, label: "-20€" },
  { points: 800, discount: 30, minAmount: 150, label: "-30€" },
]
