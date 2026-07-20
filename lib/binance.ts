import crypto from "crypto"

// Binance REST client with HMAC-SHA256 request signing, no SDK dependency.
// Testnet and live use different base URLs and different API key pairs.

export type BotMode = "testnet" | "live"

const BASE_URLS: Record<BotMode, string> = {
  testnet: "https://testnet.binance.vision",
  live: "https://api.binance.com",
}

// Public market-data mirror. Binance's primary hosts (api.binance.com and
// testnet.binance.vision) are geo-restricted (HTTP 451) from many server
// regions, but data-api.binance.vision serves the same public endpoints
// (klines, ticker, exchangeInfo) without that restriction. All unsigned
// GETs go here; signed order/account requests still use BASE_URLS.
const PUBLIC_DATA_URL = "https://data-api.binance.vision"

export interface Kline {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
}

export interface SymbolFilters {
  // step size for quantity (LOT_SIZE)
  stepSize: number
  minQty: number
  // tick size for price (PRICE_FILTER)
  tickSize: number
  // minimum order value (MIN_NOTIONAL / NOTIONAL)
  minNotional: number
}

export interface OrderResult {
  orderId: number
  status: string
  executedQty: number
  cummulativeQuoteQty: number
  price: number
  side: string
}

function credentials(mode: BotMode): { key: string; secret: string } {
  if (mode === "live") {
    const key = process.env.BINANCE_API_KEY
    const secret = process.env.BINANCE_API_SECRET
    if (!key || !secret) {
      throw new Error("Live trading requires BINANCE_API_KEY and BINANCE_API_SECRET to be set.")
    }
    return { key, secret }
  }
  const key = process.env.BINANCE_TESTNET_API_KEY
  const secret = process.env.BINANCE_TESTNET_API_SECRET
  if (!key || !secret) {
    throw new Error("Testnet trading requires BINANCE_TESTNET_API_KEY and BINANCE_TESTNET_API_SECRET to be set.")
  }
  return { key, secret }
}

function sign(query: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(query).digest("hex")
}

async function publicGet<T>(mode: BotMode, path: string, params: Record<string, string | number>): Promise<T> {
  // mode is intentionally unused for public data: the unrestricted mirror
  // serves the same live market data for both testnet and live modes.
  void mode
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString()
  const url = `${PUBLIC_DATA_URL}${path}${qs ? `?${qs}` : ""}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Binance GET ${path} failed (${res.status}): ${body}`)
  }
  return res.json() as Promise<T>
}

async function signedRequest<T>(
  mode: BotMode,
  method: "GET" | "POST",
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const { key, secret } = credentials(mode)
  const timestamp = Date.now()
  const query = new URLSearchParams(
    Object.entries({ ...params, timestamp, recvWindow: 10000 }).map(([k, v]) => [k, String(v)]),
  ).toString()
  const signature = sign(query, secret)
  const url = `${BASE_URLS[mode]}${path}?${query}&signature=${signature}`
  const res = await fetch(url, {
    method,
    headers: { "X-MBX-APIKEY": key },
    cache: "no-store",
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Binance ${method} ${path} failed (${res.status}): ${text}`)
  }
  return JSON.parse(text) as T
}

export async function getKlines(
  mode: BotMode,
  symbol: string,
  interval: string,
  limit = 100,
): Promise<Kline[]> {
  const raw = await publicGet<unknown[][]>(mode, "/api/v3/klines", { symbol, interval, limit })
  return raw.map((k) => ({
    openTime: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    closeTime: Number(k[6]),
  }))
}

export async function getPrice(mode: BotMode, symbol: string): Promise<number> {
  const data = await publicGet<{ price: string }>(mode, "/api/v3/ticker/price", { symbol })
  return Number(data.price)
}

const filtersCache = new Map<string, SymbolFilters>()

export async function getSymbolFilters(mode: BotMode, symbol: string): Promise<SymbolFilters> {
  const cacheKey = `${mode}:${symbol}`
  const cached = filtersCache.get(cacheKey)
  if (cached) return cached

  const info = await publicGet<{
    symbols: { symbol: string; filters: Record<string, string>[] }[]
  }>(mode, "/api/v3/exchangeInfo", { symbol })

  const sym = info.symbols.find((s) => s.symbol === symbol)
  if (!sym) throw new Error(`Symbol ${symbol} not found on Binance ${mode}.`)

  let stepSize = 0.00000001
  let minQty = 0
  let tickSize = 0.01
  let minNotional = 0
  for (const f of sym.filters) {
    if (f.filterType === "LOT_SIZE") {
      stepSize = Number(f.stepSize)
      minQty = Number(f.minQty)
    } else if (f.filterType === "PRICE_FILTER") {
      tickSize = Number(f.tickSize)
    } else if (f.filterType === "MIN_NOTIONAL" || f.filterType === "NOTIONAL") {
      minNotional = Number(f.minNotional)
    }
  }
  const filters: SymbolFilters = { stepSize, minQty, tickSize, minNotional }
  filtersCache.set(cacheKey, filters)
  return filters
}

export async function getAccountBalances(mode: BotMode): Promise<{ asset: string; free: number; locked: number }[]> {
  const data = await signedRequest<{ balances: { asset: string; free: string; locked: string }[] }>(
    mode,
    "GET",
    "/api/v3/account",
  )
  return data.balances
    .map((b) => ({ asset: b.asset, free: Number(b.free), locked: Number(b.locked) }))
    .filter((b) => b.free > 0 || b.locked > 0)
}

// Round a quantity down to the exchange step size.
export function roundStep(quantity: number, stepSize: number): number {
  if (stepSize <= 0) return quantity
  const precision = Math.max(0, Math.round(-Math.log10(stepSize)))
  const rounded = Math.floor(quantity / stepSize) * stepSize
  return Number(rounded.toFixed(precision))
}

export async function placeMarketOrder(
  mode: BotMode,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: number,
): Promise<OrderResult> {
  const data = await signedRequest<{
    orderId: number
    status: string
    executedQty: string
    cummulativeQuoteQty: string
    fills?: { price: string }[]
  }>(mode, "POST", "/api/v3/order", {
    symbol,
    side,
    type: "MARKET",
    quantity,
  })

  const executedQty = Number(data.executedQty)
  const quote = Number(data.cummulativeQuoteQty)
  const avgPrice = executedQty > 0 ? quote / executedQty : Number(data.fills?.[0]?.price ?? 0)

  return {
    orderId: data.orderId,
    status: data.status,
    executedQty,
    cummulativeQuoteQty: quote,
    price: avgPrice,
    side,
  }
}
