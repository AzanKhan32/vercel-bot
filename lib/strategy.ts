import type { Kline } from "./binance"
import { rsi, sma } from "./indicators"

export type Signal = "BUY" | "SELL" | "HOLD"

export interface StrategyParams {
  fastPeriod: number
  slowPeriod: number
  rsiPeriod: number
  rsiOverbought: number
  rsiOversold: number
}

export interface StrategyResult {
  signal: Signal
  reason: string
  fastNow: number | null
  fastPrev: number | null
  slowNow: number | null
  slowPrev: number | null
  rsiNow: number | null
  // Open time (ms) of the most recent CLOSED candle the decision is based on.
  // Used as an idempotency key so re-running a tick on the same candle can't
  // fire the same trade twice.
  closedCandleOpenTime: number | null
  lastClose: number | null
}

// Evaluate an MA-crossover strategy with an RSI filter.
//
// Crossovers are detected between the two most recent CLOSED candles. The final
// element returned by Binance is the in-progress candle, so it is dropped
// before evaluation to avoid acting on an unconfirmed bar.
export function evaluateStrategy(klines: Kline[], params: StrategyParams): StrategyResult {
  const empty: StrategyResult = {
    signal: "HOLD",
    reason: "Not enough data",
    fastNow: null,
    fastPrev: null,
    slowNow: null,
    slowPrev: null,
    rsiNow: null,
    closedCandleOpenTime: null,
    lastClose: null,
  }

  // Drop the last (in-progress) candle; evaluate only on closed candles.
  const closed = klines.slice(0, -1)
  const minLen = Math.max(params.slowPeriod, params.rsiPeriod) + 2
  if (closed.length < minLen) return empty

  const closes = closed.map((k) => k.close)
  const fast = sma(closes, params.fastPeriod)
  const slow = sma(closes, params.slowPeriod)
  const rsiSeries = rsi(closes, params.rsiPeriod)

  const i = closes.length - 1
  const fastNow = fast[i]
  const fastPrev = fast[i - 1]
  const slowNow = slow[i]
  const slowPrev = slow[i - 1]
  const rsiNow = rsiSeries[i]
  const closedCandleOpenTime = closed[i].openTime
  const lastClose = closes[i]

  if (fastNow == null || fastPrev == null || slowNow == null || slowPrev == null || rsiNow == null) {
    return { ...empty, fastNow, fastPrev, slowNow, slowPrev, rsiNow, closedCandleOpenTime, lastClose }
  }

  const crossedUp = fastPrev <= slowPrev && fastNow > slowNow
  const crossedDown = fastPrev >= slowPrev && fastNow < slowNow

  let signal: Signal = "HOLD"
  let reason = "No crossover"

  if (crossedUp) {
    if (rsiNow < params.rsiOverbought) {
      signal = "BUY"
      reason = `Golden cross (SMA${params.fastPeriod} > SMA${params.slowPeriod}), RSI ${rsiNow.toFixed(1)} below overbought`
    } else {
      reason = `Golden cross ignored: RSI ${rsiNow.toFixed(1)} is overbought`
    }
  } else if (crossedDown) {
    if (rsiNow > params.rsiOversold) {
      signal = "SELL"
      reason = `Death cross (SMA${params.fastPeriod} < SMA${params.slowPeriod}), RSI ${rsiNow.toFixed(1)} above oversold`
    } else {
      reason = `Death cross ignored: RSI ${rsiNow.toFixed(1)} is oversold`
    }
  }

  return { signal, reason, fastNow, fastPrev, slowNow, slowPrev, rsiNow, closedCandleOpenTime, lastClose }
}
