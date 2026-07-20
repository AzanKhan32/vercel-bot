"use client"

import { useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { FlaskConical, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface BacktestResponse {
  symbol: string
  interval: string
  orderSizeUsd: number
  symbols: string[]
  summary?: {
    totalTrades: number
    wins: number
    losses: number
    winRate: number
    totalPnl: number
    returnPct: number
    buyHoldReturnPct: number
    maxDrawdownPct: number
    startEquity: number
    endEquity: number
    candles: number
    fromTime: number | null
    toTime: number | null
  }
  equity?: { time: number; equity: number; price: number }[]
  error?: string
}

const chartConfig: ChartConfig = {
  equity: { label: "Equity", color: "var(--primary)" },
}

function fmtUsd(n: number) {
  const sign = n < 0 ? "-" : ""
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function fmtDate(t: number) {
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function BacktestPanel({ symbols, activeSymbol }: { symbols: string[]; activeSymbol?: string }) {
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<BacktestResponse | null>(null)
  const symbol = selected ?? activeSymbol ?? symbols[0]

  async function run() {
    setLoading(true)
    try {
      const res = await fetch(`/api/bot/backtest?symbol=${symbol}`)
      const json = (await res.json()) as BacktestResponse
      setData(json)
    } catch {
      setData({ symbol, interval: "", orderSizeUsd: 0, symbols, error: "Request failed" })
    } finally {
      setLoading(false)
    }
  }

  const summary = data?.summary
  const positive = (summary?.returnPct ?? 0) >= 0
  const beatsHold = (summary?.returnPct ?? 0) >= (summary?.buyHoldReturnPct ?? 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Backtest</CardTitle>
          <p className="text-xs text-muted-foreground">Replays current strategy on historical candles</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={symbol} onValueChange={setSelected}>
            <SelectTrigger className="w-28" aria-label="Backtest symbol">
              <SelectValue placeholder="Symbol" />
            </SelectTrigger>
            <SelectContent>
              {symbols.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={run} disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FlaskConical className="size-4" aria-hidden="true" />
            )}
            {loading ? "Running..." : "Run"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!data && !loading && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Run a backtest to see how the strategy would have performed.
          </p>
        )}
        {data?.error && (
          <p className="py-8 text-center text-sm text-muted-foreground">Unable to run backtest: {data.error}</p>
        )}
        {summary && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric
                label="Strategy return"
                value={`${summary.returnPct >= 0 ? "+" : ""}${summary.returnPct.toFixed(2)}%`}
                sub={fmtUsd(summary.totalPnl)}
                tone={positive ? "profit" : "loss"}
              />
              <Metric
                label="Buy & hold"
                value={`${summary.buyHoldReturnPct >= 0 ? "+" : ""}${summary.buyHoldReturnPct.toFixed(2)}%`}
                sub={beatsHold ? "strategy ahead" : "hold ahead"}
              />
              <Metric
                label="Win rate"
                value={`${summary.winRate.toFixed(0)}%`}
                sub={`${summary.wins}W / ${summary.losses}L`}
              />
              <Metric
                label="Max drawdown"
                value={`-${summary.maxDrawdownPct.toFixed(2)}%`}
                sub={`${summary.totalTrades} trades`}
                tone="loss"
              />
            </div>

            {data.equity && data.equity.length > 1 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Equity curve · {summary.candles} candles
                  {summary.fromTime ? ` · ${fmtDate(summary.fromTime)} – ${fmtDate(summary.toTime ?? 0)}` : ""}
                </p>
                <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full">
                  <AreaChart data={data.equity} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-equity)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-equity)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={56}
                      tickFormatter={fmtDate}
                    />
                    <YAxis
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={56}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => fmtUsd(Number(v))}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_, payload) =>
                            payload?.[0] ? fmtDate(Number(payload[0].payload.time)) : ""
                          }
                          formatter={(value) => [fmtUsd(Number(value)), " Equity"]}
                        />
                      }
                    />
                    <Area
                      dataKey="equity"
                      type="monotone"
                      stroke="var(--color-equity)"
                      strokeWidth={2}
                      fill="url(#equityFill)"
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            )}

            {summary.totalTrades === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                No crossovers triggered on this history. Try a different symbol or interval.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: "profit" | "loss"
}) {
  const toneClass = tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-foreground"
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
