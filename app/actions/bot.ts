"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { botSettings } from "@/lib/db/schema"
import { closeAllPositions, runTick, type CloseAllResult, type TickOutcome } from "@/lib/tick"

export interface SettingsInput {
  mode: "testnet" | "live"
  symbols: string[]
  candleInterval: string
  fastPeriod: number
  slowPeriod: number
  rsiPeriod: number
  rsiOverbought: number
  rsiOversold: number
  orderSizeUsd: number
  maxOpenPositions: number
}

export async function updateSettings(input: SettingsInput) {
  await db
    .update(botSettings)
    .set({
      mode: input.mode,
      symbols: input.symbols,
      candleInterval: input.candleInterval,
      fastPeriod: input.fastPeriod,
      slowPeriod: input.slowPeriod,
      rsiPeriod: input.rsiPeriod,
      rsiOverbought: input.rsiOverbought,
      rsiOversold: input.rsiOversold,
      orderSizeUsd: String(input.orderSizeUsd),
      maxOpenPositions: input.maxOpenPositions,
      updatedAt: new Date(),
    })
    .where(eq(botSettings.id, 1))
  revalidatePath("/")
}

// Start/stop the bot. Switching to live is intentionally explicit and never
// implied by any other action.
export async function setEnabled(enabled: boolean) {
  await db.update(botSettings).set({ enabled, updatedAt: new Date() }).where(eq(botSettings.id, 1))
  revalidatePath("/")
}

export async function setMode(mode: "testnet" | "live") {
  // Changing mode always pauses the bot first as a safety measure.
  await db.update(botSettings).set({ mode, enabled: false, updatedAt: new Date() }).where(eq(botSettings.id, 1))
  revalidatePath("/")
}

export async function triggerTick(): Promise<TickOutcome> {
  const result = await runTick()
  revalidatePath("/")
  return result
}

// Kill switch: force-close all open positions and pause the bot.
export async function killAllPositions(): Promise<CloseAllResult> {
  const result = await closeAllPositions()
  revalidatePath("/")
  return result
}
