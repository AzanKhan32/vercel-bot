"use client"

import { AlertCircle, CheckCircle2, Clock3, RefreshCw, ShieldCheck } from "lucide-react"
import type { ReadinessStatus } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function ReadinessPanel({ readiness, onRefresh, refreshing }: {
  readiness: ReadinessStatus | undefined
  onRefresh: () => void
  refreshing: boolean
}) {
  const ready = readiness?.ready ?? false

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <CardTitle>Testnet readiness</CardTitle>
        </div>
        <CardDescription>
          Read-only safety checks. No orders are placed during this test.
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Badge variant={ready ? "default" : "secondary"}>{ready ? "Ready" : "Setup needed"}</Badge>
          <Button variant="ghost" size="icon-sm" onClick={onRefresh} disabled={refreshing} aria-label="Refresh readiness checks">
            <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Testnet readiness checks">
          {(readiness?.checks ?? []).map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              {item.status === "pass" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-profit" aria-hidden="true" />
              ) : item.status === "warning" ? (
                <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-loss" aria-hidden="true" />
              )}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{item.message}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
