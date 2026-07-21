"use client"

import { LogOut } from "lucide-react"
import { logout } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" aria-label="Sign out" title="Sign out">
        <LogOut aria-hidden="true" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </form>
  )
}
