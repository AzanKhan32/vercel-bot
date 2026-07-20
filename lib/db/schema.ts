import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  mode: text("mode").notNull().default("testnet"), // 'testnet' | 'live'
  enabled: boolean("enabled").notNull().default(false),
  symbols: jsonb("symbols").notNull().$type<string[]>().default(["BTCUSDT"]),
  candleInterval: text("candle_interval").notNull().default("15m"),
  fastPeriod: integer("fast_period").notNull().default(9),
  slowPeriod: integer("slow_period").notNull().default(21),
  rsiPeriod: integer("rsi_period").notNull().default(14),
  rsiOverbought: integer("rsi_overbought").notNull().default(70),
  rsiOversold: integer("rsi_oversold").notNull().default(30),
  orderSizeUsd: numeric("order_size_usd").notNull().default("100"),
  maxOpenPositions: integer("max_open_positions").notNull().default(3),
  // Risk controls. All in "0 = disabled" convention.
  // Stop-loss / take-profit are percentages relative to entry price.
  stopLossPct: numeric("stop_loss_pct").notNull().default("0"),
  takeProfitPct: numeric("take_profit_pct").notNull().default("0"),
  // Daily realized-loss limit in USD. When today's realized PnL drops to
  // -dailyLossLimitUsd or below, the bot stops opening new positions.
  dailyLossLimitUsd: numeric("daily_loss_limit_usd").notNull().default("0"),
  tickLock: timestamp("tick_lock", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const positions = pgTable("positions", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  quantity: numeric("quantity").notNull(),
  entryPrice: numeric("entry_price").notNull(),
  exitPrice: numeric("exit_price"),
  status: text("status").notNull().default("open"), // 'open' | 'closed'
  realizedPnl: numeric("realized_pnl"),
  mode: text("mode").notNull().default("testnet"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
})

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'BUY' | 'SELL'
  quantity: numeric("quantity").notNull(),
  price: numeric("price").notNull(),
  notional: numeric("notional").notNull(),
  orderId: text("order_id"),
  status: text("status").notNull().default("FILLED"),
  mode: text("mode").notNull().default("testnet"),
  candleOpenTime: bigint("candle_open_time", { mode: "number" }),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const tickLogs = pgTable("tick_logs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("success"), // 'success' | 'error' | 'skipped'
  mode: text("mode").notNull().default("testnet"),
  message: text("message"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type BotSettings = typeof botSettings.$inferSelect
export type Position = typeof positions.$inferSelect
export type Trade = typeof trades.$inferSelect
export type TickLog = typeof tickLogs.$inferSelect
