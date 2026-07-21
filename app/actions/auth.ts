"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createSessionToken, isValidSession, SESSION_COOKIE } from "@/lib/auth"

export async function login(formData: FormData) {
  const submittedPassword = formData.get("password")
  const configuredPassword = process.env.DASHBOARD_PASSWORD

  if (!configuredPassword) {
    redirect("/login?error=configuration")
  }

  if (
    typeof submittedPassword !== "string" ||
    !(await isValidSession(await createSessionToken(submittedPassword)))
  ) {
    redirect("/login?error=invalid")
  }

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, await createSessionToken(configuredPassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
  redirect("/")
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  redirect("/login")
}
