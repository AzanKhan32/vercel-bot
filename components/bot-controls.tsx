"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { AlertTriangle, FlaskConical, Pause, Play, ShieldCheck, XOctagon } from "lucide-react"
import type { BotSettings } from "@/lib/db/schema"
import type { ReadinessStatus } from "@/lib/types"
import { killAllPositions, setEnabled, setMode } from "@/app/actions/bot"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function BotControls({
  settings,
  openCount = 0,
  readiness,
  onChange,
}: {
  settings: BotSettings | null | undefined
  openCount?: number
  readiness?: ReadinessStatus
  onChange: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmLive, setConfirmLive] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)

  const mode = (settings?.mode ?? "testnet") as "testnet" | "live" | "paper"
  const isLive = mode === "live"
  const isPaper = mode === "paper"
  const enabled = settings?.enabled ?? false

  // Testnet activation is gated on readiness. Starting is blocked when not
  // ready, but pausing an already-running bot is always allowed.
  const startBlocked = mode === "testnet" && !enabled && readiness ? !readiness.ready : false
  const blockingReason =
    readiness?.checks.find((item) => item.blocking && item.status === "fail")?.message ??
    "Complete the Testnet readiness checks before starting."

  function handleKill() {
    setConfirmKill(false)
    startTransition(async () => {
      const result = await killAllPositions()
      if (result.status === "success") {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      onChange()
    })
  }

  function toggleEnabled() {
    startTransition(async () => {
      const result = await setEnabled(!enabled)
      if (result.ok) {
        toast[!enabled ? "success" : "info"](result.message)
      } else {
        toast.error(result.message)
      }
      onChange()
    })
  }

  function switchMode(next: "testnet" | "live" | "paper") {
    if (next === "live" && !confirmLive) {
      setConfirmLive(true)
      return
    }
    setConfirmLive(false)
    startTransition(async () => {
      await setMode(next)
      toast.info(`Switched to ${next.toUpperCase()} — bot paused for safety`)
      onChange()
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`relative flex size-2.5 ${enabled ? "" : "opacity-50"}`}>
              {enabled && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-profit opacity-75" />
              )}
              <span
                className={`relative inline-flex size-2.5 rounded-full ${enabled ? "bg-profit" : "bg-muted-foreground"}`}
              />
            </span>
            <span className="text-sm font-medium">{enabled ? "Running" : "Paused"}</span>
          </div>

          <Badge
            variant={isLive ? "destructive" : "secondary"}
            className={isLive ? "" : "bg-primary/10 text-primary hover:bg-primary/10"}
          >
            {isLive ? (
              <AlertTriangle className="mr-1 size-3" aria-hidden="true" />
            ) : isPaper ? (
              <FlaskConical className="mr-1 size-3" aria-hidden="true" />
            ) : (
              <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
            )}
            {isLive
              ? "LIVE — real funds"
              : isPaper
                ? "PAPER — simulated fills"
                : "TESTNET — practice funds"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode switch */}
          <div className="flex items-center rounded-md border p-0.5">
            <button
              type="button"
              onClick={() => switchMode("paper")}
              disabled={isPending}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                isPaper ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Paper
            </button>
            <button
              type="button"
              onClick={() => switchMode("testnet")}
              disabled={isPending}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                mode === "testnet"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Testnet
            </button>
            <button
              type="button"
              onClick={() => switchMode("live")}
              disabled={isPending}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                isLive ? "bg-loss text-loss-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Live
            </button>
          </div>

          <Button
            onClick={toggleEnabled}
            disabled={isPending || startBlocked}
            variant={enabled ? "outline" : "default"}
            className="gap-2"
            title={startBlocked ? blockingReason : undefined}
          >
            {enabled ? (
              <>
                <Pause className="size-4" aria-hidden="true" /> Pause
              </>
            ) : (
              <>
                <Play className="size-4" aria-hidden="true" /> Start
              </>
            )}
          </Button>

          <Button
            onClick={() => setConfirmKill(true)}
            disabled={isPending || openCount === 0}
            variant="outline"
            className="gap-2 border-loss/40 text-loss hover:bg-loss/10 hover:text-loss"
            title={openCount === 0 ? "No open positions to close" : "Close all open positions"}
          >
            <XOctagon className="size-4" aria-hidden="true" />
            {openCount > 0 ? `Close all (${openCount})` : "Close all"}
          </Button>
        </div>
      </CardContent>

      {startBlocked && (
        <CardContent className="border-t border-primary/30 bg-primary/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm text-pretty text-muted-foreground">
              <span className="font-medium text-foreground">Start blocked: </span>
              {blockingReason}
            </p>
          </div>
        </CardContent>
      )}

      {confirmKill && (
        <CardContent className="border-t border-loss/30 bg-loss/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-loss" aria-hidden="true" />
              <p className="text-sm text-pretty">
                {`This immediately market-sells all ${openCount} open position(s) and pauses the bot. This cannot be undone. Continue?`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmKill(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleKill}
                className="bg-loss text-loss-foreground hover:bg-loss/90"
              >
                Yes, close all
              </Button>
            </div>
          </div>
        </CardContent>
      )}

      {confirmLive && (
        <CardContent className="border-t border-loss/30 bg-loss/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-loss" aria-hidden="true" />
              <p className="text-sm text-pretty">
                {"Switching to LIVE mode trades with real money. Orders will use your live Binance API keys. Continue?"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmLive(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => switchMode("live")}
                className="bg-loss text-loss-foreground hover:bg-loss/90"
              >
                Yes, go live
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
