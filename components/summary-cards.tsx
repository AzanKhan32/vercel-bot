"use client"

import { Layers, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import type { StatusResponse } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"

function money(n: number) {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function pnlClass(n: number) {
  if (n > 0) return "text-profit"
  if (n < 0) return "text-loss"
  return "text-foreground"
}

export function SummaryCards({ data, isLoading }: { data: StatusResponse | undefined; isLoading: boolean }) {
  const realized = data?.summary.realizedPnl ?? 0
  const unrealized = data?.summary.unrealizedPnl ?? 0
  const openCount = data?.summary.openCount ?? 0

  const quoteBalance =
    data?.balances.find((b) => b.asset === "USDT")?.free ?? null

  const cards = [
    {
      label: "Realized PnL",
      value: money(realized),
      valueClass: pnlClass(realized),
      icon: realized >= 0 ? TrendingUp : TrendingDown,
      hint: "Closed trades",
    },
    {
      label: "Unrealized PnL",
      value: money(unrealized),
      valueClass: pnlClass(unrealized),
      icon: unrealized >= 0 ? TrendingUp : TrendingDown,
      hint: "Open positions, marked to market",
    },
    {
      label: "Open Positions",
      value: String(openCount),
      valueClass: "text-foreground",
      icon: Layers,
      hint: "Currently held",
    },
    {
      label: "USDT Balance",
      value: quoteBalance != null ? money(quoteBalance) : "—",
      valueClass: "text-foreground",
      icon: Wallet,
      hint: data?.balancesError ? "Add API keys to view" : "Available to trade",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              <c.icon className={`size-4 ${c.valueClass}`} aria-hidden="true" />
            </div>
            <span className={`font-mono text-2xl font-semibold tabular-nums ${c.valueClass}`}>
              {isLoading ? "…" : c.value}
            </span>
            <span className="text-xs text-muted-foreground">{c.hint}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
