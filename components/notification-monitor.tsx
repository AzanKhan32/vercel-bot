"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, BellRing } from "lucide-react"
import { toast } from "sonner"
import type { TickLog, Trade } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"

function formatTrade(trade: Trade) {
  const value = Number(trade.notional).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
  return `${trade.side} ${trade.symbol} for ${value}`
}

function sendBrowserNotification(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body, tag: `${title}-${body}` })
  }
}

export function NotificationMonitor({
  trades,
  logs,
  balancesError,
}: {
  trades: Trade[]
  logs: TickLog[]
  balancesError: string | null
}) {
  const initialized = useRef(false)
  const latestTradeId = useRef(0)
  const latestErrorId = useRef(0)
  const lastBalanceError = useRef<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")

  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission)
  }, [])

  useEffect(() => {
    const newestTradeId = trades.reduce((latest, trade) => Math.max(latest, trade.id), 0)
    const errorLogs = logs.filter((log) => log.status === "error")
    const newestErrorId = errorLogs.reduce((latest, log) => Math.max(latest, log.id), 0)

    if (!initialized.current) {
      initialized.current = true
      latestTradeId.current = newestTradeId
      latestErrorId.current = newestErrorId
      lastBalanceError.current = balancesError
      return
    }

    trades
      .filter((trade) => trade.id > latestTradeId.current)
      .sort((a, b) => a.id - b.id)
      .forEach((trade) => {
        const message = formatTrade(trade)
        toast.success("Trade executed", { description: message })
        sendBrowserNotification("Trade executed", message)
      })

    errorLogs
      .filter((log) => log.id > latestErrorId.current)
      .sort((a, b) => a.id - b.id)
      .forEach((log) => {
        toast.error("Bot error", { description: log.message })
        sendBrowserNotification("Bot error", log.message)
      })

    if (balancesError && balancesError !== lastBalanceError.current) {
      toast.error("Balance connection error", { description: balancesError })
      sendBrowserNotification("Balance connection error", balancesError)
    }

    latestTradeId.current = Math.max(latestTradeId.current, newestTradeId)
    latestErrorId.current = Math.max(latestErrorId.current, newestErrorId)
    lastBalanceError.current = balancesError
  }, [trades, logs, balancesError])

  async function enableBrowserNotifications() {
    if (typeof Notification === "undefined") return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === "granted") {
      toast.success("Browser notifications enabled")
      sendBrowserNotification("Notifications enabled", "Trade and bot error alerts are now active.")
    } else {
      toast.info("Browser notifications were not enabled")
    }
  }

  if (permission === "unsupported") return null

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={enableBrowserNotifications}
      disabled={permission === "denied"}
      aria-label={permission === "granted" ? "Browser notifications enabled" : "Enable browser notifications"}
      title={permission === "denied" ? "Browser notifications are blocked" : undefined}
    >
      {permission === "granted" ? <BellRing aria-hidden="true" /> : <Bell aria-hidden="true" />}
      <span className="hidden md:inline">
        {permission === "granted" ? "Alerts on" : permission === "denied" ? "Alerts blocked" : "Enable alerts"}
      </span>
    </Button>
  )
}
