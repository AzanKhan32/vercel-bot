"use client"

import { CheckCircle2, CircleAlert, MinusCircle } from "lucide-react"
import type { TickLog } from "@/lib/db/schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function when(d: Date | string | null) {
  if (!d) return ""
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ActivityLog({ logs }: { logs: TickLog[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity Log</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet. Run a tick to get started.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {logs.map((log) => {
              const Icon =
                log.status === "success" ? CheckCircle2 : log.status === "error" ? CircleAlert : MinusCircle
              const cls =
                log.status === "success"
                  ? "text-profit"
                  : log.status === "error"
                    ? "text-loss"
                    : "text-muted-foreground"
              return (
                <li key={log.id} className="flex gap-3 text-sm">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${cls}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-pretty">{log.message}</p>
                    <p className="text-xs text-muted-foreground">{when(log.createdAt)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
