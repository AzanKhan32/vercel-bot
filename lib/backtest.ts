import type { Kline } from "./binance"
import { rsi, sma } from "./indicators"
import type { StrategyParams } from "./strategy"

export interface BacktestTrade {
  entryTime: number
  entryPrice: number
  exitTime: number
  exitPrice: number
  quantity: number
  pnl: number
  pnlPct: number
}

export interface EquityPoint {
  time: number
  equity: number
  price: number
}

export interface BacktestSummary {
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  totalPnl: number
  returnPct: number
  buyHoldReturnPct: number
  maxDrawdownPct: number
  startEquity: number
  endEquity: number
  candles: number
  fromTime: number | null
  toTime: number | null
}

export interface BacktestResult {
  summary: BacktestSummary
  trades: BacktestTrade[]
  equity: EquityPoint[]
}

// Replay the MA-crossover + RSI-filter strategy candle-by-candle over a full
// kline history. This mirrors the live logic in evaluateStrategy: a golden
// cross while RSI is below overbought opens a position; a death cross while
// RSI is above oversold closes it. A fixed USD order size is used per trade
// and PnL is realized on exit. The equity curve marks the position to market
// on every closed candle so drawdown reflects intra-trade swings.
export function runBacktest(
  klines: Kline[],
  params: StrategyParams,
  orderSizeUsd: number,
): BacktestResult {
  const startEquity = orderSizeUsd
  const emptySummary: BacktestSummary = {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalPnl: 0,
    returnPct: 0,
    buyHoldReturnPct: 0,
    maxDrawdownPct: 0,
    startEquity,
    endEquity: startEquity,
    candles: klines.length,
    fromTime: klines[0]?.openTime ?? null,
    toTime: klines[klines.length - 1]?.openTime ?? null,
  }

  // Drop the final (in-progress) candle, matching the live evaluator.
  const closed = klines.slice(0, -1)
  const minLen = Math.max(params.slowPeriod, params.rsiPeriod) + 2
  if (closed.length < minLen) {
    return { summary: emptySummary, trades: [], equity: [] }
  }

  const closes = closed.map((k) => k.close)
  const fast = sma(closes, params.fastPeriod)
  const slow = sma(closes, params.slowPeriod)
  const rsiSeries = rsi(closes, params.rsiPeriod)

  const trades: BacktestTrade[] = []
  const equity: EquityPoint[] = []

  let inPosition = false
  let entryPrice = 0
  let entryTime = 0
  let quantity = 0
  let realizedPnl = 0
  let peakEquity = startEquity
  let maxDrawdownPct = 0

  for (let i = 1; i < closes.length; i++) {
    const fastNow = fast[i]
    const fastPrev = fast[i - 1]
    const slowNow = slow[i]
    const slowPrev = slow[i - 1]
    const rsiNow = rsiSeries[i]
    const price = closes[i]
    const time = closed[i].openTime

    if (fastNow != null && fastPrev != null && slowNow != null && slowPrev != null && rsiNow != null) {
      const crossedUp = fastPrev <= slowPrev && fastNow > slowNow
      const crossedDown = fastPrev >= slowPrev && fastNow < slowNow

      if (!inPosition && crossedUp && rsiNow < params.rsiOverbought) {
        inPosition = true
        entryPrice = price
        entryTime = time
        quantity = orderSizeUsd / price
      } else if (inPosition && crossedDown && rsiNow > params.rsiOversold) {
        const pnl = (price - entryPrice) * quantity
        realizedPnl += pnl
        trades.push({
          entryTime,
          entryPrice,
          exitTime: time,
          exitPrice: price,
          quantity,
          pnl,
          pnlPct: ((price - entryPrice) / entryPrice) * 100,
        })
        inPosition = false
        quantity = 0
      }
    }

    // Mark-to-market equity for the curve and drawdown.
    const unrealized = inPosition ? (price - entryPrice) * quantity : 0
    const mark = startEquity + realizedPnl + unrealized
    equity.push({ time, equity: mark, price })
    if (mark > peakEquity) peakEquity = mark
    const dd = peakEquity > 0 ? ((peakEquity - mark) / peakEquity) * 100 : 0
    if (dd > maxDrawdownPct) maxDrawdownPct = dd
  }

  // Close any still-open position at the last close so PnL is fully realized.
  if (inPosition) {
    const lastPrice = closes[closes.length - 1]
    const lastTime = closed[closed.length - 1].openTime
    const pnl = (lastPrice - entryPrice) * quantity
    realizedPnl += pnl
    trades.push({
      entryTime,
      entryPrice,
      exitTime: lastTime,
      exitPrice: lastPrice,
      quantity,
      pnl,
      pnlPct: ((lastPrice - entryPrice) / entryPrice) * 100,
    })
  }

  const wins = trades.filter((t) => t.pnl > 0).length
  const losses = trades.filter((t) => t.pnl <= 0).length
  const endEquity = startEquity + realizedPnl
  const firstClose = closes[0]
  const lastClose = closes[closes.length - 1]

  const summary: BacktestSummary = {
    totalTrades: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    totalPnl: realizedPnl,
    returnPct: (realizedPnl / startEquity) * 100,
    buyHoldReturnPct: ((lastClose - firstClose) / firstClose) * 100,
    maxDrawdownPct,
    startEquity,
    endEquity,
    candles: closed.length,
    fromTime: closed[0].openTime,
    toTime: closed[closed.length - 1].openTime,
  }

  return { summary, trades, equity }
}
