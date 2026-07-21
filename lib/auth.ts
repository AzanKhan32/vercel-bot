const SESSION_COOKIE = "dashboard_session"
const SESSION_MESSAGE = "vercel-bot-dashboard-access"

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function createSessionToken(password: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(SESSION_MESSAGE))
  return toHex(signature)
}

export async function isValidSession(token: string | undefined) {
  const password = process.env.DASHBOARD_PASSWORD
  if (!password || !token) return false

  const expected = await createSessionToken(password)
  if (token.length !== expected.length) return false

  let mismatch = 0
  for (let index = 0; index < token.length; index += 1) {
    mismatch |= token.charCodeAt(index) ^ expected.charCodeAt(index)
  }
  return mismatch === 0
}

export { SESSION_COOKIE }
