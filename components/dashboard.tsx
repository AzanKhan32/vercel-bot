"use client"

import useSWR from "swr"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Activity, RefreshCw } from "lucide-react"
import type { StatusResponse } from "@/lib/types"
import { triggerTick } from "@/app/actions/bot"
import { Button } from "@/components/ui/button"
import { BotControls } from "@/components/bot-controls"
import { ReadinessPanel } from "@/components/readiness-panel"
import { SummaryCards } from "@/components/summary-cards"
import { PriceChart } from "@/components/price-chart"
import { BacktestPanel } from "@/components/backtest-panel"
import { StrategyConfig } from "@/components/strategy-config"
import { PositionsTable } from "@/components/positions-table"
import { TradesTable } from "@/components/trades-table"
import { ActivityLog } from "@/components/activity-log"
import { LogoutButton } from "@/components/logout-button"
import { NotificationMonitor } from "@/components/notification-monitor"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function Dashboard() {
  const { data, isLoading, mutate } = useSWR<StatusResponse>("/api/bot/status", fetcher, {
    refreshInterval: 15000,
  })
  const [isPending, startTransition] = useTransition()
  const [running, setRunning] = useState(false)
  const [refreshingReadiness, setRefreshingReadiness] = useState(false)

  const settings = data?.settings

  async function refreshReadiness() {
    setRefreshingReadiness(true)
    try {
      await mutate()
    } finally {
      setRefreshingReadiness(false)
    }
  }

  function handleTick() {
    setRunning(true)
    startTransition(async () => {
      try {
        const result = await triggerTick()
        if (result.status === "success") {
          const actions = result.outcomes.filter((o) => o.action === "bought" || o.action === "sold")
          toast.success(
            actions.length > 0
              ? `Tick complete: ${actions.map((a) => `${a.action} ${a.symbol}`).join(", ")}`
              : "Tick complete: no trades this round",
          )
        } else if (result.status === "skipped") {
          toast.info(result.message)
        } else {
          toast.error(result.message)
        }
        mutate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Tick failed")
      } finally {
        setRunning(false)
      }
    })
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-balance">MA Crossover Bot</h1>
            <p className="text-sm text-muted-foreground">Binance · SMA cross + RSI filter</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleTick} disabled={running || isPending} className="gap-2">
            <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} aria-hidden="true" />
            {running ? "Running tick..." : "Run tick now"}
          </Button>
          <NotificationMonitor
            trades={data?.trades ?? []}
            logs={data?.logs ?? []}
            balancesError={data?.balancesError ?? null}
          />
          <LogoutButton />
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <BotControls
          settings={settings}
          openCount={data?.summary?.openCount ?? 0}
          readiness={data?.readiness}
          onChange={() => mutate()}
        />
        {settings?.mode === "testnet" && (
          <ReadinessPanel
            readiness={data?.readiness}
            onRefresh={refreshReadiness}
            refreshing={refreshingReadiness}
          />
        )}
        <SummaryCards data={data} isLoading={isLoading} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <PriceChart symbols={settings?.symbols ?? ["BTCUSDT"]} activeSymbol={settings?.symbols?.[0]} />
            <BacktestPanel symbols={settings?.symbols ?? ["BTCUSDT"]} activeSymbol={settings?.symbols?.[0]} />
            <PositionsTable positions={data?.positions ?? []} />
            <TradesTable trades={data?.trades ?? []} />
          </div>
          <div className="flex flex-col gap-6">
            <StrategyConfig settings={settings} onSaved={() => mutate()} />
            <ActivityLog logs={data?.logs ?? []} />
          </div>
        </div>
      </div>
    </main>
  )
}
