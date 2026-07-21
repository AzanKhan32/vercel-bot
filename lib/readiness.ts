import type { BotSettings } from "@/lib/db/schema"
import { getAccountBalances, getPrice, getSymbolFilters } from "@/lib/binance"
import type { ReadinessCheck, ReadinessStatus } from "@/lib/types"

function check(
  id: string,
  label: string,
  status: ReadinessCheck["status"],
  message: string,
  blocking = status === "fail",
): ReadinessCheck {
  return { id, label, status, message, blocking }
}

function safeExchangeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Connection failed"
  if (message.includes("451")) return "Binance Testnet is unavailable from this server region."
  if (message.includes("401") || message.includes("API-key") || message.includes("Signature")) {
    return "Testnet rejected the credentials. Create a new Spot Testnet API key."
  }
  return "Could not authenticate with Binance Spot Testnet."
}

export async function getTestnetReadiness(settings: BotSettings | null): Promise<ReadinessStatus> {
  const checks: ReadinessCheck[] = []
  checks.push(check("database", "Database", settings ? "pass" : "fail", settings ? "Settings are available." : "Bot settings could not be loaded."))

  const hasCredentials = Boolean(
    process.env.BINANCE_TESTNET_API_KEY && process.env.BINANCE_TESTNET_API_SECRET,
  )
  checks.push(check(
    "credentials",
    "Testnet credentials",
    hasCredentials ? "pass" : "fail",
    hasCredentials ? "API key and secret are configured." : "Add the Binance Spot Testnet API key and secret in Vars.",
  ))

  const cronConfigured = Boolean(process.env.CRON_SECRET)
  checks.push(check(
    "cron",
    "Scheduled ticks",
    cronConfigured ? "pass" : "fail",
    cronConfigured ? "Five-minute schedule and cron protection are configured." : "Add CRON_SECRET in Vars to protect scheduled ticks.",
  ))

  if (!settings) return finish(checks)

  const riskReady = Number(settings.stopLossPct) > 0 && Number(settings.takeProfitPct) > 0 && Number(settings.dailyLossLimitUsd) > 0
  checks.push(check(
    "risk",
    "Risk controls",
    riskReady ? "pass" : "fail",
    riskReady ? "Stop loss, take profit, and daily loss limit are enabled." : "Set positive stop loss, take profit, and daily loss limit values.",
  ))

  let symbolsReady = settings.symbols.length > 0
  let largestMinimum = 0
  try {
    for (const symbol of settings.symbols) {
      const [filters, price] = await Promise.all([
        getSymbolFilters("testnet", symbol),
        getPrice("testnet", symbol),
      ])
      largestMinimum = Math.max(largestMinimum, filters.minNotional, filters.minQty * price)
      if (Number(settings.orderSizeUsd) < filters.minNotional || Number(settings.orderSizeUsd) < filters.minQty * price) {
        symbolsReady = false
      }
    }
    checks.push(check(
      "symbols",
      "Symbols and order size",
      symbolsReady ? "pass" : "fail",
      symbolsReady
        ? `${settings.symbols.length} symbol(s) support the $${Number(settings.orderSizeUsd).toFixed(2)} order size.`
        : `Increase order size to at least $${largestMinimum.toFixed(2)} for the selected symbols.`,
    ))
  } catch {
    checks.push(check("symbols", "Symbols and order size", "fail", "Could not validate one or more selected symbols."))
  }

  if (!hasCredentials) {
    checks.push(check("connection", "Binance connection", "fail", "Waiting for Testnet credentials."))
    checks.push(check("funds", "Practice funds", "fail", "Balance can be checked after credentials are added."))
    return finish(checks)
  }

  try {
    const balances = await getAccountBalances("testnet")
    checks.push(check("connection", "Binance connection", "pass", "Authenticated with Binance Spot Testnet."))
    const usdt = balances.find((balance) => balance.asset === "USDT")?.free ?? 0
    const required = Number(settings.orderSizeUsd)
    checks.push(check(
      "funds",
      "Practice funds",
      usdt >= required ? "pass" : "fail",
      usdt >= required
        ? `Available practice USDT covers a $${required.toFixed(2)} order.`
        : `Add Testnet funds; at least $${required.toFixed(2)} USDT is required.`,
    ))
  } catch (error) {
    checks.push(check("connection", "Binance connection", "fail", safeExchangeMessage(error)))
    checks.push(check("funds", "Practice funds", "fail", "Balance is unavailable until Binance connects."))
  }

  return finish(checks)
}

function finish(checks: ReadinessCheck[]): ReadinessStatus {
  return {
    ready: checks.every((item) => !item.blocking || item.status !== "fail"),
    checkedAt: new Date().toISOString(),
    checks,
  }
}
