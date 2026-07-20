"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { AlertTriangle, Pause, Play, ShieldCheck } from "lucide-react"
import type { BotSettings } from "@/lib/db/schema"
import { setEnabled, setMode } from "@/app/actions/bot"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function BotControls({
  settings,
  onChange,
}: {
  settings: BotSettings | null | undefined
  onChange: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmLive, setConfirmLive] = useState(false)

  const isLive = settings?.mode === "live"
  const enabled = settings?.enabled ?? false

  function toggleEnabled() {
    startTransition(async () => {
      await setEnabled(!enabled)
      toast[!enabled ? "success" : "info"](!enabled ? "Bot started" : "Bot paused")
      onChange()
    })
  }

  function switchMode(mode: "testnet" | "live") {
    if (mode === "live" && !confirmLive) {
      setConfirmLive(true)
      return
    }
    setConfirmLive(false)
    startTransition(async () => {
      await setMode(mode)
      toast.info(`Switched to ${mode.toUpperCase()} — bot paused for safety`)
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
            ) : (
              <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
            )}
            {isLive ? "LIVE — real funds" : "TESTNET — practice funds"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode switch */}
          <div className="flex items-center rounded-md border p-0.5">
            <button
              type="button"
              onClick={() => switchMode("testnet")}
              disabled={isPending}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                !isLive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
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
            disabled={isPending}
            variant={enabled ? "outline" : "default"}
            className="gap-2"
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
        </div>
      </CardContent>

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
