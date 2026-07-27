"use client"

import * as React from "react"
import {
  ArrowLeft,
  Clock3,
  Download,
  FileDown,
  FilePlus2,
  FileText,
  FolderOpen,
  HardDrive,
  History,
  Home,
  Info,
  LockKeyhole,
  Printer,
  Save,
  SaveAll,
  Settings2,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AppCommandId } from "@/components/chrome/command-search"
import type { ExportFormat } from "@/components/chrome/title-bar"
import { cn } from "@/lib/utils"

type BackstageView = "home" | "info" | "export"

interface FileBackstageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentTitle: string
  documentPath: string | null
  isDirty: boolean
  editing: boolean
  desktop: boolean
  canExport: boolean
  onCommand: (command: AppCommandId) => void
  onExport: (format: ExportFormat) => void
  onOpenVersions: () => void
  onOpenSettings: () => void
}

interface BackstageNavButtonProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function BackstageNavButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: BackstageNavButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-11 w-full items-center gap-3 px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-white/18 text-white"
          : "text-white/85 hover:bg-white/10 hover:text-white"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  action,
  actionLabel,
  disabled,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: () => void
  actionLabel: string
  disabled?: boolean
}) {
  return (
    <article className="flex min-h-40 flex-col rounded-xl border bg-card p-4 shadow-sm">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-4 self-start"
        onClick={action}
        disabled={disabled}
      >
        {actionLabel}
      </Button>
    </article>
  )
}

export function FileBackstage({
  open,
  onOpenChange,
  documentTitle,
  documentPath,
  isDirty,
  editing,
  desktop,
  canExport,
  onCommand,
  onExport,
  onOpenVersions,
  onOpenSettings,
}: FileBackstageProps) {
  const [view, setView] = React.useState<BackstageView>("home")

  const runCommand = (command: AppCommandId) => {
    onCommand(command)
    onOpenChange(false)
  }

  const exportAndClose = (format: ExportFormat) => {
    onExport(format)
    onOpenChange(false)
  }

  const openVersions = () => {
    onOpenVersions()
    onOpenChange(false)
  }

  const openSettings = () => {
    onOpenSettings()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!left-0 !top-0 h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 gap-0 overflow-hidden border-0 p-0 sm:!max-w-none sm:rounded-none [&>button:last-child]:hidden"
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DialogTitle className="sr-only">Archivo</DialogTitle>
        <DialogDescription className="sr-only">
          Crear, abrir, guardar, imprimir, exportar y configurar el documento.
        </DialogDescription>

        <div className="grid h-full min-h-0 grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[220px_minmax(0,1fr)]">
          <nav
            className="flex min-h-0 flex-col bg-[#185abd] text-white"
            aria-label="Archivo"
          >
            <button
              type="button"
              className="flex h-14 items-center gap-3 border-b border-white/15 px-3 text-sm font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
              onClick={() => onOpenChange(false)}
              title="Volver al documento (Esc)"
            >
              <ArrowLeft className="h-5 w-5 shrink-0" />
              <span className="hidden sm:inline">Volver</span>
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <BackstageNavButton
                icon={<Home />}
                label="Inicio"
                active={view === "home"}
                onClick={() => setView("home")}
              />
              <BackstageNavButton
                icon={<FilePlus2 />}
                label="Nuevo"
                onClick={() => runCommand("file:new")}
              />
              <BackstageNavButton
                icon={<FolderOpen />}
                label="Abrir"
                disabled={!desktop}
                onClick={() => runCommand("file:open")}
              />
              <BackstageNavButton
                icon={<Info />}
                label="Información"
                active={view === "info"}
                onClick={() => setView("info")}
              />
              <div className="my-2 border-t border-white/15" />
              <BackstageNavButton
                icon={<Save />}
                label={desktop ? "Guardar" : "Descargar Word"}
                disabled={!editing}
                onClick={() => runCommand("file:save")}
              />
              <BackstageNavButton
                icon={<SaveAll />}
                label="Guardar como"
                disabled={!desktop || !editing}
                onClick={() => runCommand("file:saveAs")}
              />
              <BackstageNavButton
                icon={<Printer />}
                label="Imprimir"
                disabled={!editing}
                onClick={() => runCommand("file:print")}
              />
              <BackstageNavButton
                icon={<Download />}
                label="Exportar"
                active={view === "export"}
                disabled={!canExport}
                onClick={() => setView("export")}
              />
            </div>
            <div className="border-t border-white/15 py-2">
              <BackstageNavButton
                icon={<Settings2 />}
                label="Opciones"
                onClick={openSettings}
              />
            </div>
          </nav>

          <main className="min-h-0 overflow-y-auto bg-background">
            <div className="mx-auto w-full max-w-6xl px-6 py-8 md:px-10 md:py-10">
              {view === "home" && (
                <div className="space-y-8">
                  <header>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                      Archivo
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                      Inicio
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                      Todo el trabajo documental permanece en tu equipo. Solo se
                      usa Internet cuando solicitas una acción de IA.
                    </p>
                  </header>

                  <section className="rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div className="flex min-w-0 items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#185abd] text-white">
                          <FileText className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-semibold">
                            {documentTitle}
                          </h2>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {documentPath ?? "Todavía no se ha elegido una ubicación"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-[11px]",
                                isDirty
                                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                                  : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                              )}
                            >
                              {isDirty ? "Cambios pendientes" : "Todo guardado"}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                              Edición offline
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={() => runCommand("file:save")}
                          disabled={!editing}
                        >
                          <Save />
                          {desktop ? "Guardar" : "Descargar Word"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={openVersions}
                          disabled={!editing}
                        >
                          <History />
                          Historial de versiones
                        </Button>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="mb-3 text-sm font-semibold">
                      Acciones rápidas
                    </h2>
                    <div className="grid gap-3 md:grid-cols-3">
                      <FeatureCard
                        icon={<FilePlus2 />}
                        title="Nuevo documento"
                        description="Empieza en blanco o elige una plantilla local desde la pantalla inicial."
                        action={() => runCommand("file:new")}
                        actionLabel="Crear"
                      />
                      <FeatureCard
                        icon={<FolderOpen />}
                        title="Abrir desde el equipo"
                        description="Importa DOCX u ODT conservando estructura, estilos y metadatos compatibles."
                        action={() => runCommand("file:open")}
                        actionLabel="Examinar"
                        disabled={!desktop}
                      />
                      <FeatureCard
                        icon={<FileDown />}
                        title="Crear una copia portable"
                        description="Exporta el documento a Word, OpenDocument, PDF, Markdown o texto sin depender de la nube."
                        action={() => setView("export")}
                        actionLabel="Ver formatos"
                        disabled={!canExport}
                      />
                    </div>
                  </section>
                </div>
              )}

              {view === "info" && (
                <div className="space-y-8">
                  <header>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                      Archivo
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                      Información
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Estado, privacidad y protección del documento actual.
                    </p>
                  </header>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FeatureCard
                      icon={<ShieldCheck />}
                      title="Recuperación local"
                      description="El editor mantiene puntos de recuperación y detecta cambios externos antes de sobrescribir un archivo."
                      action={openVersions}
                      actionLabel="Ver versiones"
                      disabled={!editing}
                    />
                    <FeatureCard
                      icon={<HardDrive />}
                      title="Ubicación"
                      description={
                        documentPath
                          ? `Guardado en ${documentPath}`
                          : "Este documento aún no tiene una ubicación permanente."
                      }
                      action={() => runCommand("file:saveAs")}
                      actionLabel="Elegir ubicación"
                      disabled={!desktop || !editing}
                    />
                    <FeatureCard
                      icon={<LockKeyhole />}
                      title="Privacidad offline"
                      description="La edición y el análisis local no envían el documento a ningún servicio. La IA solo se conecta cuando la invocas."
                      action={openSettings}
                      actionLabel="Privacidad e IA"
                    />
                    <FeatureCard
                      icon={<Clock3 />}
                      title="Historial de versiones"
                      description="Compara o restaura versiones sin depender de OneDrive ni de una cuenta."
                      action={openVersions}
                      actionLabel="Abrir historial"
                      disabled={!editing}
                    />
                  </div>
                </div>
              )}

              {view === "export" && (
                <div className="space-y-8">
                  <header>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                      Archivo
                    </p>
                    <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                      Exportar
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Crea una copia local en el formato que necesites.
                    </p>
                  </header>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <FeatureCard
                      icon={<FileText />}
                      title="Word (.docx)"
                      description="La opción más completa para intercambiar el documento con Word y LibreOffice."
                      action={() => exportAndClose("docx")}
                      actionLabel="Exportar DOCX"
                    />
                    <FeatureCard
                      icon={<FileText />}
                      title="OpenDocument (.odt)"
                      description="Formato abierto y editable para LibreOffice, OpenOffice y otras suites compatibles."
                      action={() => exportAndClose("odt")}
                      actionLabel="Exportar ODT"
                    />
                    <FeatureCard
                      icon={<Printer />}
                      title="PDF (.pdf)"
                      description="Conserva la presentación para lectura, impresión o entrega."
                      action={() => exportAndClose("pdf")}
                      actionLabel="Exportar PDF"
                    />
                    <FeatureCard
                      icon={<FileDown />}
                      title="Markdown (.md)"
                      description="Texto estructurado y portable para repositorios, web y herramientas técnicas."
                      action={() => exportAndClose("md")}
                      actionLabel="Exportar MD"
                    />
                    <FeatureCard
                      icon={<FileText />}
                      title="Texto (.txt)"
                      description="Contenido limpio sin formato para máxima compatibilidad."
                      action={() => exportAndClose("txt")}
                      actionLabel="Exportar TXT"
                    />
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
