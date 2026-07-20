import { NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { botSettings, positions, tickLogs, trades } from "@/lib/db/schema"
import { getAccountBalances, getPrice, type BotMode } from "@/lib/binance"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET() {
  const settingsRows = await db.select().from(botSettings).where(eq(botSettings.id, 1)).limit(1)
  const settings = settingsRows[0]
  const mode = (settings?.mode ?? "testnet") as BotMode

  const [openPositions, recentTrades, logs] = await Promise.all([
    db
      .select()
      .from(positions)
      .where(and(eq(positions.status, "open"), eq(positions.mode, mode)))
      .orderBy(desc(positions.openedAt)),
    db
      .select()
      .from(trades)
      .where(and(eq(trades.mode, mode), eq(trades.status, "FILLED")))
      .orderBy(desc(trades.createdAt))
      .limit(25),
    db.select().from(tickLogs).where(eq(tickLogs.mode, mode)).orderBy(desc(tickLogs.createdAt)).limit(15),
  ])

  // Closed trades for realized PnL summary.
  const closedPositions = await db
    .select()
    .from(positions)
    .where(and(eq(positions.status, "closed"), eq(positions.mode, mode)))
    .orderBy(desc(positions.closedAt))
    .limit(50)

  const realizedPnl = closedPositions.reduce((sum, p) => sum + Number(p.realizedPnl ?? 0), 0)

  // Mark open positions to market for unrealized PnL. Best-effort: if the
  // exchange call fails we still return the rest of the payload.
  let unrealizedPnl = 0
  const enrichedPositions: (typeof openPositions[number] & { currentPrice: number | null; unrealizedPnl: number | null })[] =
    []
  for (const p of openPositions) {
    let currentPrice: number | null = null
    let uPnl: number | null = null
    try {
      currentPrice = await getPrice(mode, p.symbol)
      uPnl = (currentPrice - Number(p.entryPrice)) * Number(p.quantity)
      unrealizedPnl += uPnl
    } catch {
      // ignore price fetch failures
    }
    enrichedPositions.push({ ...p, currentPrice, unrealizedPnl: uPnl })
  }

  // Balances require valid API keys; treat failure as "not configured".
  let balances: { asset: string; free: number; locked: number }[] = []
  let balancesError: string | null = null
  try {
    balances = await getAccountBalances(mode)
  } catch (err) {
    balancesError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({
    settings,
    positions: enrichedPositions,
    trades: recentTrades,
    logs,
    balances,
    balancesError,
    summary: {
      realizedPnl,
      unrealizedPnl,
      openCount: openPositions.length,
    },
  })
}
