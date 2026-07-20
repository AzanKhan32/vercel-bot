// Pure technical-indicator helpers. All functions operate on arrays of closing
// prices ordered oldest -> newest, and return arrays aligned to the input
// (values that cannot be computed yet are `null`).

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

// Wilder's RSI. Returns values aligned to the input array.
export function rsi(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length <= period) return out

  let gainSum = 0
  let lossSum = 0
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1]
    if (change >= 0) gainSum += change
    else lossSum -= change
  }
  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  out[period] = computeRsi(avgGain, avgLoss)

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    const gain = change >= 0 ? change : 0
    const loss = change < 0 ? -change : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = computeRsi(avgGain, avgLoss)
  }
  return out
}

function computeRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}
