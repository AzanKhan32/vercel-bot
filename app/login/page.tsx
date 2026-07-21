import { Activity, LockKeyhole, ShieldCheck } from "lucide-react"
import { login } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const errorMessages: Record<string, string> = {
  invalid: "That password is incorrect. Please try again.",
  configuration: "Dashboard authentication is not configured.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const errorMessage = error ? errorMessages[error] : undefined

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Activity className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-primary">Secure console</p>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">MA Crossover Bot</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Authenticate to access trading controls and account activity.
            </p>
          </div>
        </div>

        <Card className="shadow-lg shadow-foreground/5">
          <CardHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
              <LockKeyhole className="size-4" aria-hidden="true" />
            </div>
            <CardTitle>Dashboard access</CardTitle>
            <CardDescription>Enter the shared password configured for this dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={login} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? "login-error" : undefined}
                  className="h-10"
                />
                {errorMessage && (
                  <p id="login-error" role="alert" className="text-sm leading-relaxed text-destructive">
                    {errorMessage}
                  </p>
                )}
              </div>
              <Button type="submit" size="lg" className="w-full">
                Unlock dashboard
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Protected with a secure, httpOnly session
        </p>
      </div>
    </main>
  )
}
