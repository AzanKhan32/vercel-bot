import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { botSettings } from "@/lib/db/schema"
import { getKlines, type BotMode } from "@/lib/binance"
import { runBacktest } from "@/lib/backtest"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// Runs the strategy over historical candles for a symbol using the currently
// saved strategy settings. Read-only: it never touches balances or positions.
export async function GET(request: Request) {
  const settingsRows = await db.select().from(botSettings).where(eq(botSettings.id, 1)).limit(1)
  const settings = settingsRows[0]
  const mode = (settings?.mode ?? "testnet") as BotMode

  const symbols = (settings?.symbols ?? ["BTCUSDT"]) as string[]
  const interval = settings?.candleInterval ?? "15m"

  const url = new URL(request.url)
  const requested = url.searchParams.get("symbol")
  const symbol = requested && symbols.includes(requested) ? requested : (symbols[0] ?? "BTCUSDT")
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 1000, 100), 1000)

  const params = {
    fastPeriod: settings?.fastPeriod ?? 9,
    slowPeriod: settings?.slowPeriod ?? 21,
    rsiPeriod: settings?.rsiPeriod ?? 14,
    rsiOverbought: settings?.rsiOverbought ?? 70,
    rsiOversold: settings?.rsiOversold ?? 30,
  }
  const orderSizeUsd = Number(settings?.orderSizeUsd ?? 100)

  try {
    const klines = await getKlines(mode, symbol, interval, limit)
    const result = runBacktest(klines, params, orderSizeUsd)
    return NextResponse.json({ symbol, interval, params, orderSizeUsd, symbols, ...result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), symbol, interval, symbols },
      { status: 200 },
    )
  }
}
