"use client"

import type { Trade } from "@/lib/db/schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function num(v: string | number | null, digits = 2) {
  if (v == null) return "—"
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: digits })
}

function when(d: Date | string | null) {
  if (!d) return "—"
  const date = new Date(d)
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function TradesTable({ trades }: { trades: Trade[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Trades</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {trades.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{when(t.createdAt)}</TableCell>
                    <TableCell className="font-medium">{t.symbol}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          t.side === "BUY"
                            ? "border-profit/40 bg-profit/10 text-profit"
                            : "border-loss/40 bg-loss/10 text-loss"
                        }
                      >
                        {t.side}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{num(t.price)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">${num(t.notional)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
