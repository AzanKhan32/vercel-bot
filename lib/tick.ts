import { and, eq, sql } from "drizzle-orm"
import { db } from "./db"
import { botSettings, positions, tickLogs, trades } from "./db/schema"
import {
  type BotMode,
  getKlines,
  getSymbolFilters,
  placeMarketOrder,
  roundStep,
} from "./binance"
import { evaluateStrategy } from "./strategy"

// How long a tick lock is considered valid before we assume the previous tick
// died mid-run and allow a new one. Keeps a crashed tick from locking forever.
const LOCK_TIMEOUT_MS = 60_000

export interface SymbolOutcome {
  symbol: string
  signal: string
  reason: string
  action: "bought" | "sold" | "skipped" | "error"
  detail?: string
}

export interface TickOutcome {
  ran: boolean
  status: "success" | "skipped" | "error"
  message: string
  mode: BotMode
  outcomes: SymbolOutcome[]
}

export async function getSettings() {
  const rows = await db.select().from(botSettings).where(eq(botSettings.id, 1)).limit(1)
  return rows[0]
}

// Try to acquire the tick lock atomically. Returns true if we got it.
async function acquireLock(): Promise<boolean> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - LOCK_TIMEOUT_MS)
  const result = await db
    .update(botSettings)
    .set({ tickLock: now })
    .where(
      and(
        eq(botSettings.id, 1),
        sql`(${botSettings.tickLock} IS NULL OR ${botSettings.tickLock} < ${cutoff.toISOString()})`,
      ),
    )
    .returning({ id: botSettings.id })
  return result.length > 0
}

async function releaseLock() {
  await db.update(botSettings).set({ tickLock: null }).where(eq(botSettings.id, 1))
}

export async function runTick(): Promise<TickOutcome> {
  const settings = await getSettings()
  if (!settings) {
    return { ran: false, status: "error", message: "No bot settings found", mode: "testnet", outcomes: [] }
  }

  const mode = settings.mode as BotMode

  if (!settings.enabled) {
    const outcome: TickOutcome = {
      ran: false,
      status: "skipped",
      message: "Bot is paused",
      mode,
      outcomes: [],
    }
    return outcome
  }

  const gotLock = await acquireLock()
  if (!gotLock) {
    return {
      ran: false,
      status: "skipped",
      message: "Another tick is already in progress",
      mode,
      outcomes: [],
    }
  }

  const outcomes: SymbolOutcome[] = []

  try {
    const symbols = settings.symbols ?? []
    const params = {
      fastPeriod: settings.fastPeriod,
      slowPeriod: settings.slowPeriod,
      rsiPeriod: settings.rsiPeriod,
      rsiOverbought: settings.rsiOverbought,
      rsiOversold: settings.rsiOversold,
    }

    // Count currently open positions to enforce max-open-positions cap.
    const openRows = await db
      .select({ symbol: positions.symbol })
      .from(positions)
      .where(and(eq(positions.status, "open"), eq(positions.mode, mode)))
    const openSymbols = new Set(openRows.map((r) => r.symbol))

    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const outcome = await processSymbol(symbol, mode, params, settings, openSymbols)
          outcomes.push(outcome)
        } catch (err) {
          outcomes.push({
            symbol,
            signal: "HOLD",
            reason: "error",
            action: "error",
            detail: err instanceof Error ? err.message : String(err),
          })
        }
      }),
    )

    await db.insert(tickLogs).values({
      status: "success",
      mode,
      message: `Evaluated ${symbols.length} symbol(s)`,
      details: outcomes,
    })

    return { ran: true, status: "success", message: "Tick complete", mode, outcomes }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.insert(tickLogs).values({ status: "error", mode, message, details: outcomes })
    return { ran: true, status: "error", message, mode, outcomes }
  } finally {
    await releaseLock()
  }
}

export interface CloseAllResult {
  status: "success" | "error"
  message: string
  closed: number
  results: { symbol: string; status: "closed" | "error"; detail: string }[]
}

// Kill switch: immediately market-sell every open position for the current
// mode and pause the bot. Each close is independent so one failure does not
// block the others. Uses a unique candleOpenTime (now, in ms) per SELL so the
// manual close never collides with the strategy's per-candle idempotency lock.
export async function closeAllPositions(): Promise<CloseAllResult> {
  const settings = await getSettings()
  if (!settings) {
    return { status: "error", message: "No bot settings found", closed: 0, results: [] }
  }
  const mode = settings.mode as BotMode

  // Pause the bot so no new tick can open positions while we unwind.
  await db.update(botSettings).set({ enabled: false, updatedAt: new Date() }).where(eq(botSettings.id, 1))

  const openPositions = await db
    .select()
    .from(positions)
    .where(and(eq(positions.status, "open"), eq(positions.mode, mode)))

  if (openPositions.length === 0) {
    return { status: "success", message: "No open positions to close", closed: 0, results: [] }
  }

  const results: CloseAllResult["results"] = []
  let closed = 0

  await Promise.all(
    openPositions.map(async (pos) => {
      try {
        const filters = await getSymbolFilters(mode, pos.symbol)
        const qty = roundStep(Number(pos.quantity), filters.stepSize)
        const order = await placeMarketOrder(mode, pos.symbol, "SELL", qty)
        const fillQty = order.executedQty || qty
        const fillPrice = order.price || (await getKlines(mode, pos.symbol, settings.candleInterval, 1))[0].close
        const entryPrice = Number(pos.entryPrice)
        const pnl = (fillPrice - entryPrice) * fillQty

        await db.insert(trades).values({
          symbol: pos.symbol,
          side: "SELL",
          quantity: String(fillQty),
          price: String(fillPrice),
          notional: String(fillQty * fillPrice),
          orderId: String(order.orderId),
          status: order.status,
          mode,
          candleOpenTime: Date.now(),
          reason: "kill switch",
        })

        await db
          .update(positions)
          .set({
            status: "closed",
            exitPrice: String(fillPrice),
            realizedPnl: String(pnl),
            closedAt: new Date(),
          })
          .where(eq(positions.id, pos.id))

        closed += 1
        results.push({
          symbol: pos.symbol,
          status: "closed",
          detail: `Sold ${fillQty} @ ${fillPrice}, PnL ${pnl.toFixed(2)}`,
        })
      } catch (err) {
        results.push({
          symbol: pos.symbol,
          status: "error",
          detail: err instanceof Error ? err.message : String(err),
        })
      }
    }),
  )

  const failed = results.filter((r) => r.status === "error").length
  await db.insert(tickLogs).values({
    status: failed > 0 ? "error" : "success",
    mode,
    message: `Kill switch: closed ${closed}/${openPositions.length} position(s)`,
    details: results,
  })

  return {
    status: failed > 0 ? "error" : "success",
    message: `Closed ${closed} of ${openPositions.length} position(s)`,
    closed,
    results,
  }
}

async function processSymbol(
  symbol: string,
  mode: BotMode,
  params: {
    fastPeriod: number
    slowPeriod: number
    rsiPeriod: number
    rsiOverbought: number
    rsiOversold: number
  },
  settings: NonNullable<Awaited<ReturnType<typeof getSettings>>>,
  openSymbols: Set<string>,
): Promise<SymbolOutcome> {
  const klines = await getKlines(mode, symbol, settings.candleInterval, 200)
  const result = evaluateStrategy(klines, params)

  const base: SymbolOutcome = {
    symbol,
    signal: result.signal,
    reason: result.reason,
    action: "skipped",
  }

  if (result.signal === "HOLD" || result.closedCandleOpenTime == null) {
    return base
  }

  const hasOpenPosition = openSymbols.has(symbol)

  // Only BUY if we don't already hold this symbol and we're under the cap.
  if (result.signal === "BUY") {
    if (hasOpenPosition) {
      return { ...base, action: "skipped", detail: "Already holding a position" }
    }
    if (openSymbols.size >= settings.maxOpenPositions) {
      return { ...base, action: "skipped", detail: "Max open positions reached" }
    }
  }

  // Only SELL if we actually hold this symbol.
  if (result.signal === "SELL" && !hasOpenPosition) {
    return { ...base, action: "skipped", detail: "No open position to sell" }
  }

  // Idempotency guard: reserve this (symbol, side, candle) before ordering.
  const side = result.signal as "BUY" | "SELL"
  const reserved = await reserveTrade(symbol, side, result.closedCandleOpenTime)
  if (!reserved) {
    return { ...base, action: "skipped", detail: "Already traded on this candle" }
  }

  const filters = await getSymbolFilters(mode, symbol)
  const price = result.lastClose ?? 0

  try {
    if (side === "BUY") {
      const orderSizeUsd = Number(settings.orderSizeUsd)
      if (orderSizeUsd < filters.minNotional) {
        await deleteReservation(symbol, side, result.closedCandleOpenTime)
        return {
          ...base,
          action: "skipped",
          detail: `Order size $${orderSizeUsd} is below exchange minimum $${filters.minNotional}`,
        }
      }
      let qty = roundStep(orderSizeUsd / price, filters.stepSize)
      if (qty < filters.minQty || qty <= 0) {
        await deleteReservation(symbol, side, result.closedCandleOpenTime)
        return { ...base, action: "skipped", detail: "Computed quantity below minimum" }
      }

      const order = await placeMarketOrder(mode, symbol, "BUY", qty)
      const fillQty = order.executedQty || qty
      const fillPrice = order.price || price

      await finalizeTrade(symbol, side, result.closedCandleOpenTime, {
        quantity: fillQty,
        price: fillPrice,
        notional: fillQty * fillPrice,
        orderId: String(order.orderId),
        status: order.status,
        mode,
        reason: result.reason,
      })

      await db.insert(positions).values({
        symbol,
        quantity: String(fillQty),
        entryPrice: String(fillPrice),
        status: "open",
        mode,
      })
      openSymbols.add(symbol)

      return { ...base, action: "bought", detail: `Bought ${fillQty} @ ${fillPrice}` }
    } else {
      // SELL: close the open position for this symbol.
      const openPos = await db
        .select()
        .from(positions)
        .where(and(eq(positions.symbol, symbol), eq(positions.status, "open"), eq(positions.mode, mode)))
        .limit(1)

      if (openPos.length === 0) {
        await deleteReservation(symbol, side, result.closedCandleOpenTime)
        return { ...base, action: "skipped", detail: "No open position to sell" }
      }

      const pos = openPos[0]
      const qty = roundStep(Number(pos.quantity), filters.stepSize)
      const order = await placeMarketOrder(mode, symbol, "SELL", qty)
      const fillQty = order.executedQty || qty
      const fillPrice = order.price || price
      const entryPrice = Number(pos.entryPrice)
      const pnl = (fillPrice - entryPrice) * fillQty

      await finalizeTrade(symbol, side, result.closedCandleOpenTime, {
        quantity: fillQty,
        price: fillPrice,
        notional: fillQty * fillPrice,
        orderId: String(order.orderId),
        status: order.status,
        mode,
        reason: result.reason,
      })

      await db
        .update(positions)
        .set({
          status: "closed",
          exitPrice: String(fillPrice),
          realizedPnl: String(pnl),
          closedAt: new Date(),
        })
        .where(eq(positions.id, pos.id))
      openSymbols.delete(symbol)

      return { ...base, action: "sold", detail: `Sold ${fillQty} @ ${fillPrice}, PnL ${pnl.toFixed(2)}` }
    }
  } catch (err) {
    // Order failed: release the reservation so a later tick can retry.
    await deleteReservation(symbol, side, result.closedCandleOpenTime)
    throw err
  }
}

// Insert a placeholder trade row to atomically claim (symbol, side, candle).
// The unique index makes a duplicate insert fail, which is our idempotency lock.
async function reserveTrade(symbol: string, side: "BUY" | "SELL", candleOpenTime: number): Promise<boolean> {
  const inserted = await db
    .insert(trades)
    .values({
      symbol,
      side,
      quantity: "0",
      price: "0",
      notional: "0",
      status: "PENDING",
      candleOpenTime,
    })
    .onConflictDoNothing()
    .returning({ id: trades.id })
  return inserted.length > 0
}

async function finalizeTrade(
  symbol: string,
  side: "BUY" | "SELL",
  candleOpenTime: number,
  data: {
    quantity: number
    price: number
    notional: number
    orderId: string
    status: string
    mode: BotMode
    reason: string
  },
) {
  await db
    .update(trades)
    .set({
      quantity: String(data.quantity),
      price: String(data.price),
      notional: String(data.notional),
      orderId: data.orderId,
      status: data.status,
      mode: data.mode,
      reason: data.reason,
    })
    .where(
      and(
        eq(trades.symbol, symbol),
        eq(trades.side, side),
        eq(trades.candleOpenTime, candleOpenTime),
      ),
    )
}

async function deleteReservation(symbol: string, side: "BUY" | "SELL", candleOpenTime: number) {
  await db
    .delete(trades)
    .where(
      and(
        eq(trades.symbol, symbol),
        eq(trades.side, side),
        eq(trades.candleOpenTime, candleOpenTime),
        eq(trades.status, "PENDING"),
      ),
    )
}
