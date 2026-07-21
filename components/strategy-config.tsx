"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Settings2, ShieldAlert } from "lucide-react"
import type { BotSettings } from "@/lib/db/schema"
import { AVAILABLE_SYMBOLS, INTERVALS } from "@/lib/types"
import { updateSettings } from "@/app/actions/bot"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function StrategyConfig({
  settings,
  onSaved,
}: {
  settings: BotSettings | null | undefined
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [symbols, setSymbols] = useState<string[]>([])
  const [interval, setInterval] = useState("15m")
  const [fast, setFast] = useState(9)
  const [slow, setSlow] = useState(21)
  const [rsiPeriod, setRsiPeriod] = useState(14)
  const [rsiOb, setRsiOb] = useState(70)
  const [rsiOs, setRsiOs] = useState(30)
  const [orderSize, setOrderSize] = useState(100)
  const [maxPos, setMaxPos] = useState(3)
  const [stopLoss, setStopLoss] = useState(0)
  const [takeProfit, setTakeProfit] = useState(0)
  const [dailyLossLimit, setDailyLossLimit] = useState(0)
  const [feeRate, setFeeRate] = useState(0.1)

  // Sync form when server settings load/change.
  useEffect(() => {
    if (!settings) return
    setSymbols(settings.symbols ?? [])
    setInterval(settings.candleInterval)
    setFast(settings.fastPeriod)
    setSlow(settings.slowPeriod)
    setRsiPeriod(settings.rsiPeriod)
    setRsiOb(settings.rsiOverbought)
    setRsiOs(settings.rsiOversold)
    setOrderSize(Number(settings.orderSizeUsd))
    setMaxPos(settings.maxOpenPositions)
    setStopLoss(Number(settings.stopLossPct))
    setTakeProfit(Number(settings.takeProfitPct))
    setDailyLossLimit(Number(settings.dailyLossLimitUsd))
    setFeeRate(Number(settings.feeRatePct))
  }, [settings])

  function toggleSymbol(s: string) {
    setSymbols((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  function save() {
    if (symbols.length === 0) {
      toast.error("Select at least one trading pair")
      return
    }
    if (fast >= slow) {
      toast.error("Fast period must be less than slow period")
      return
    }
    startTransition(async () => {
      await updateSettings({
        mode: (settings?.mode as "testnet" | "live" | "paper") ?? "testnet",
        symbols,
        candleInterval: interval,
        fastPeriod: fast,
        slowPeriod: slow,
        rsiPeriod,
        rsiOverbought: rsiOb,
        rsiOversold: rsiOs,
        orderSizeUsd: orderSize,
        maxOpenPositions: maxPos,
        stopLossPct: stopLoss,
        takeProfitPct: takeProfit,
        dailyLossLimitUsd: dailyLossLimit,
        feeRatePct: feeRate,
      })
      toast.success("Strategy settings saved")
      onSaved()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="size-4" aria-hidden="true" />
          Strategy
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label>Trading pairs</Label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_SYMBOLS.map((s) => {
              const active = symbols.includes(s)
              return (
                <button key={s} type="button" onClick={() => toggleSymbol(s)}>
                  <Badge
                    variant={active ? "default" : "outline"}
                    className={active ? "" : "text-muted-foreground"}
                  >
                    {s.replace("USDT", "")}
                  </Badge>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="interval">Candle interval</Label>
            <Select value={interval} onValueChange={(v) => v && setInterval(v)}>
              <SelectTrigger id="interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVALS.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumberField id="orderSize" label="Order size (USDT)" value={orderSize} onChange={setOrderSize} min={10} />
          <NumberField id="fast" label="Fast SMA" value={fast} onChange={setFast} min={2} />
          <NumberField id="slow" label="Slow SMA" value={slow} onChange={setSlow} min={3} />
          <NumberField id="rsiPeriod" label="RSI period" value={rsiPeriod} onChange={setRsiPeriod} min={2} />
          <NumberField id="maxPos" label="Max positions" value={maxPos} onChange={setMaxPos} min={1} />
          <NumberField id="rsiOb" label="RSI overbought" value={rsiOb} onChange={setRsiOb} min={50} max={100} />
          <NumberField id="rsiOs" label="RSI oversold" value={rsiOs} onChange={setRsiOs} min={0} max={50} />
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />
            <Label className="text-sm font-medium">Risk controls</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {"Set to 0 to disable. Stop-loss and take-profit are % from entry price."}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="stopLoss"
              label="Stop-loss (%)"
              value={stopLoss}
              onChange={setStopLoss}
              min={0}
              max={100}
            />
            <NumberField
              id="takeProfit"
              label="Take-profit (%)"
              value={takeProfit}
              onChange={setTakeProfit}
              min={0}
              max={1000}
            />
            <NumberField
              id="dailyLossLimit"
              label="Daily loss limit (USDT)"
              value={dailyLossLimit}
              onChange={setDailyLossLimit}
              min={0}
            />
            <NumberField
              id="feeRate"
              label="Fee per side (%)"
              value={feeRate}
              onChange={setFeeRate}
              min={0}
              max={5}
              step={0.01}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {"Trading fee charged on entry and exit. Binance spot is ~0.1%. Applied to live PnL and backtests."}
          </p>
        </div>

        <Button onClick={save} disabled={isPending} className="w-full">
          {isPending ? "Saving..." : "Save strategy"}
        </Button>
      </CardContent>
    </Card>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  id: string
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="font-mono tabular-nums"
      />
    </div>
  )
}
