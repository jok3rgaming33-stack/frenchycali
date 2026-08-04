"use server"

export type ProfitSummary = {
  totalRevenue: number
  totalCost: number
  totalProfit: number
  orderCount: number
  byProduct: { title: string; revenue: number; cost: number; profit: number }[]
}

export async function getProfitSummary(): Promise<ProfitSummary> {
  // Stub — will be extended
  return { totalRevenue: 0, totalCost: 0, totalProfit: 0, orderCount: 0, byProduct: [] }
}
