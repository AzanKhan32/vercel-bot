import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { botSettings } from "@/lib/db/schema"
import { getKlines, type BotMode } from "@/lib/binance"
import { sma } from "@/lib/indicators"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// Returns recent candles for a symbol together with the fast/slow SMA series
// used by the strategy, so the dashboard can draw price + crossover lines.
export async function GET(request: Request) {
  const settingsRows = await db.select().from(botSettings).where(eq(botSettings.id, 1)).limit(1)
  const settings = settingsRows[0]
  const mode = (settings?.mode ?? "testnet") as BotMode

  const symbols = (settings?.symbols ?? ["BTCUSDT"]) as string[]
  const interval = settings?.candleInterval ?? "15m"
  const fastPeriod = settings?.fastPeriod ?? 9
  const slowPeriod = settings?.slowPeriod ?? 21

  const url = new URL(request.url)
  const requested = url.searchParams.get("symbol")
  const symbol = requested && symbols.includes(requested) ? requested : (symbols[0] ?? "BTCUSDT")

  try {
    const klines = await getKlines(mode, symbol, interval, 120)
    const closes = klines.map((k) => k.close)
    const fast = sma(closes, fastPeriod)
    const slow = sma(closes, slowPeriod)

    const candles = klines.map((k, i) => ({
      time: k.openTime,
      close: k.close,
      fast: fast[i],
      slow: slow[i],
    }))

    return NextResponse.json({
      symbol,
      interval,
      fastPeriod,
      slowPeriod,
      symbols,
      candles,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), symbol, interval, symbols, candles: [] },
      { status: 200 },
    )
  }
}
