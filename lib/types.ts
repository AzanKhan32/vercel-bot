import type { BotSettings, Position, TickLog, Trade } from "./db/schema"

export interface EnrichedPosition extends Position {
  currentPrice: number | null
  unrealizedPnl: number | null
}

export interface Balance {
  asset: string
  free: number
  locked: number
}

export interface ReadinessCheck {
  id: string
  label: string
  status: "pass" | "warning" | "fail"
  message: string
  blocking: boolean
}

export interface ReadinessStatus {
  ready: boolean
  checkedAt: string
  checks: ReadinessCheck[]
}

export interface StatusResponse {
  settings: BotSettings | null
  positions: EnrichedPosition[]
  trades: Trade[]
  logs: TickLog[]
  balances: Balance[]
  balancesError: string | null
  readiness: ReadinessStatus
  summary: {
    realizedPnl: number
    unrealizedPnl: number
    openCount: number
  }
}

export const AVAILABLE_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
] as const

export const INTERVALS = ["5m", "15m", "1h", "4h", "1d"] as const
