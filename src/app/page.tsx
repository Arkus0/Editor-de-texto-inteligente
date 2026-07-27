"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

const AppShell = dynamic(
  () =>
    import("@/components/app-shell").then((module) => module.AppShell),
  {
    ssr: false,
    loading: () => (
      <main
        className="flex min-h-screen items-center justify-center bg-background"
        aria-label="Cargando el editor"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    ),
  }
)

export default function Home() {
  return <AppShell />
}
