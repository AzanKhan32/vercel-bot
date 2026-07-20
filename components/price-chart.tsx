"use client"

import { useState } from "react"
import useSWR from "swr"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ChartResponse {
  symbol: string
  interval: string
  fastPeriod: number
  slowPeriod: number
  symbols: string[]
  candles: { time: number; close: number; fast: number | null; slow: number | null }[]
  error?: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function PriceChart({ symbols, activeSymbol }: { symbols: string[]; activeSymbol?: string }) {
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const symbol = selected ?? activeSymbol ?? symbols[0]

  const { data } = useSWR<ChartResponse>(
    symbol ? `/api/bot/chart?symbol=${symbol}` : null,
    fetcher,
    { refreshInterval: 30000 },
  )

  const fastPeriod = data?.fastPeriod ?? 9
  const slowPeriod = data?.slowPeriod ?? 21

  const chartConfig: ChartConfig = {
    close: { label: "Price", color: "var(--muted-foreground)" },
    fast: { label: `SMA ${fastPeriod}`, color: "var(--primary)" },
    slow: { label: `SMA ${slowPeriod}`, color: "var(--loss)" },
  }

  const candles = data?.candles ?? []

  function fmtTime(t: number) {
    const d = new Date(t)
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Price &amp; SMA Crossover</CardTitle>
          <p className="text-xs text-muted-foreground">
            {data?.interval ? `${data.interval} candles` : "Loading…"}
          </p>
        </div>
        <Select value={symbol} onValueChange={setSelected}>
          <SelectTrigger className="w-32" aria-label="Chart symbol">
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
      </CardHeader>
      <CardContent>
        {data?.error ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Unable to load chart: {data.error}</p>
        ) : candles.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No candle data yet.</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
            <LineChart data={candles} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={48}
                tickFormatter={fmtTime}
              />
              <YAxis
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={56}
                domain={["auto", "auto"]}
                tickFormatter={(v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => (payload?.[0] ? fmtTime(Number(payload[0].payload.time)) : "")}
                  />
                }
              />
              <Line dataKey="close" type="monotone" stroke="var(--color-close)" strokeWidth={1.5} dot={false} />
              <Line
                dataKey="fast"
                type="monotone"
                stroke="var(--color-fast)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                dataKey="slow"
                type="monotone"
                stroke="var(--color-slow)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
