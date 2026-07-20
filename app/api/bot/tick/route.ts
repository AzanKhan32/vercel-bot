import { NextResponse } from "next/server"
import { runTick } from "@/lib/tick"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Secured endpoint for the scheduler (Vercel Cron or an external cron service).
// Requires "Authorization: Bearer <CRON_SECRET>". If CRON_SECRET is not set,
// the endpoint refuses to run rather than defaulting to open.
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get("authorization")
  return auth === `Bearer ${secret}`
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await runTick()
  return NextResponse.json(result)
}

// Vercel Cron issues GET requests; also allow POST for manual/external callers.
export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
