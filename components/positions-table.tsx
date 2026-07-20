"use client"

import type { EnrichedPosition } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function num(v: string | number | null, digits = 2) {
  if (v == null) return "—"
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: digits })
}

export function PositionsTable({ positions }: { positions: EnrichedPosition[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Open Positions</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {positions.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No open positions.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Unreal. PnL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((p) => {
                  const pnl = p.unrealizedPnl
                  const cls = pnl == null ? "" : pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : ""
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.symbol}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{num(p.quantity, 6)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{num(p.entryPrice)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{num(p.currentPrice)}</TableCell>
                      <TableCell className={`text-right font-mono tabular-nums ${cls}`}>
                        {pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}${num(pnl)}`}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
