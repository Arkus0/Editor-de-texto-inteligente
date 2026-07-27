"use client"

import * as React from "react"
import {
  AlertTriangle,
  BookOpen,
  CheckCheck,
  CopyCheck,
  ExternalLink,
  LoaderCircle,
  Merge,
  Paperclip,
  Plus,
  Quote,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { ZoteroConnector } from "@/components/references/zotero-connector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  ACADEMIC_CSL_STYLE_PRESETS,
  CSL_LOCALE_OPTIONS,
  citationDisplayCode,
  createCitationSource,
  deduplicateCitationSources,
  findBestDuplicate,
  findDuplicateGroups,
  formatBibliographyEntry,
  mergeCitationSources,
  type CitationCluster,
  type CitationClusterItem,
  type CitationLocatorLabel,
  type CitationMode,
  type CitationSource,
  type CitationStyle,
  type DocumentBibliography,
  type DuplicateCandidate,
} from "@/types/citation"

interface CitationSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bibliography: DocumentBibliography
  onBibliographyChange: (
    bibliography: DocumentBibliography,
    replacements?: Record<string, string>
  ) => void
  onInsertCitation: (cluster: CitationCluster, fallbackLabel: string) => void
  onInsertBibliography: (
    heading: string,
    entries: string[],
    style: CitationStyle
  ) => void
}

const emptyForm = {
  author: "",
  title: "",
  year: "",
  publisher: "",
  url: "",
  doi: "",
  isbn: "",
}

interface PendingDuplicate {
  incoming: CitationSource
  candidate: DuplicateCandidate
}

function sourceSummary(source: CitationSource) {
  return [source.author, source.year, source.publisher]
    .filter(Boolean)
    .join(" · ")
}

export function CitationSidebar({
  open,
  onOpenChange,
  bibliography,
  onBibliographyChange,
  onInsertCitation,
  onInsertBibliography,
}: CitationSidebarProps) {
  const [form, setForm] = React.useState(emptyForm)
  const [pendingDuplicate, setPendingDuplicate] =
    React.useState<PendingDuplicate | null>(null)
  const [fieldChoices, setFieldChoices] = React.useState<
    Partial<Record<keyof CitationSource, "canonical" | "duplicate">>
  >({})
  const [selectedCitationIds, setSelectedCitationIds] = React.useState<
    Set<string>
  >(new Set())
  const [citationMode, setCitationMode] =
    React.useState<CitationMode>("parenthetical")
  const [locator, setLocator] = React.useState("")
  const [locatorLabel, setLocatorLabel] =
    React.useState<CitationLocatorLabel>("page")
  const [citationPrefix, setCitationPrefix] = React.useState("")
  const [citationSuffix, setCitationSuffix] = React.useState("")
  const [styleQuery, setStyleQuery] = React.useState("")
  const [styleResults, setStyleResults] = React.useState<
    Array<{ id: string; title: string; class: "in-text" | "note" }>
  >([])
  const [styleBusy, setStyleBusy] = React.useState(false)
  const importRef = React.useRef<HTMLInputElement>(null)

  const style = bibliography.style
  const sources = bibliography.sources
  const duplicateGroups = React.useMemo(
    () => findDuplicateGroups(sources, 72),
    [sources]
  )
  const duplicateCount = duplicateGroups.reduce(
    (total, group) => total + group.duplicates.length,
    0
  )

  const commitNewSource = (source: CitationSource) => {
    onBibliographyChange({
      ...bibliography,
      sources: [...sources, source],
    })
    setForm(emptyForm)
  }

  const handleAdd = () => {
    if (!form.title.trim()) {
      toast.error("La fuente necesita al menos un título.")
      return
    }
    const incoming = createCitationSource(form)
    const candidate = findBestDuplicate(sources, incoming, 72)
    if (candidate) {
      setPendingDuplicate({ incoming, candidate })
      return
    }
    commitNewSource(incoming)
    toast.success("Fuente añadida con identidad única")
  }

  const mergeExistingSources = async (
    canonical: CitationSource,
    duplicate: CitationSource,
    choices: Partial<
      Record<keyof CitationSource, "canonical" | "duplicate">
    > = {}
  ) => {
    const canonicalWebLink = canonical.zoteroLinks?.find(
      (link) => link.mode === "web"
    )
    const duplicateWebLink = duplicate.zoteroLinks?.find(
      (link) =>
        link.mode === "web" &&
        canonicalWebLink &&
        link.libraryType === canonicalWebLink.libraryType &&
        link.libraryId === canonicalWebLink.libraryId
    )
    if (
      canonicalWebLink &&
      duplicateWebLink &&
      window.editorDesktop &&
      window.confirm(
        "Esta fusión también modificará Zotero.org: conservará el registro elegido, trasladará sus adjuntos y eliminará el duplicado. ¿Continuar?"
      )
    ) {
      try {
        await window.editorDesktop.zotero.mergeItems({
          libraryType: canonicalWebLink.libraryType,
          libraryId: canonicalWebLink.libraryId,
          canonicalKey: canonicalWebLink.itemKey,
          duplicateKey: duplicateWebLink.itemKey,
          fieldChoices: choices as Record<string, "canonical" | "duplicate">,
        })
        toast.success("Duplicado fusionado también en Zotero.org")
      } catch (error) {
        toast.error("Zotero no aceptó la fusión", {
          description:
            error instanceof Error ? error.message : "Error desconocido",
        })
        return
      }
    }
    const merged = mergeCitationSources(canonical, duplicate, choices)
    onBibliographyChange(
      {
        ...bibliography,
        sources: sources
          .filter((source) => source.id !== duplicate.id)
          .map((source) => (source.id === canonical.id ? merged : source)),
      },
      { [duplicate.id]: canonical.id }
    )
    toast.success("Referencias fusionadas", {
      description: "Todas sus citas utilizan ahora el mismo identificador.",
    })
  }

  const handleZoteroSync = (
    changedSources: CitationSource[],
    deletedKeys: string[],
    state: NonNullable<DocumentBibliography["zoteroSync"]>[string]
  ) => {
    const changedById = new Map(changedSources.map((source) => [source.id, source]))
    const deleted = new Set(
      deletedKeys.map(
        (key) => `${state.libraryType}:${state.libraryId}:${key}`
      )
    )
    const updatedExisting = sources.map((source) => {
      const changed = changedById.get(source.id)
      if (changed) {
        changedById.delete(source.id)
        return mergeCitationSources(source, changed)
      }
      const sourceWasDeleted = source.zoteroKeys?.some((key) => deleted.has(key))
      return sourceWasDeleted ? { ...source, zoteroDeleted: true } : source
    })
    const syncKey = `${state.mode}:${state.libraryType}:${state.libraryId}`
    onBibliographyChange({
      ...bibliography,
      sources: [...updatedExisting, ...changedById.values()],
      zoteroSync: {
        ...(bibliography.zoteroSync ?? {}),
        [syncKey]: state,
      },
    })
  }

  const searchStyles = async () => {
    if (!window.editorDesktop) {
      toast.info("El catálogo CSL está disponible en la aplicación de Windows")
      return
    }
    setStyleBusy(true)
    try {
      setStyleResults(
        await window.editorDesktop.csl.searchStyles(styleQuery.trim())
      )
    } catch (error) {
      toast.error("No se pudo consultar el catálogo CSL", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setStyleBusy(false)
    }
  }

  const selectStyle = async (styleId: string) => {
    if (!window.editorDesktop) return
    setStyleBusy(true)
    try {
      const selected = await window.editorDesktop.csl.fetchStyle(styleId)
      onBibliographyChange({
        ...bibliography,
        style: selected.id,
        styleTitle: selected.title,
        styleClass: selected.class,
        cslXml: selected.xml,
        locale: bibliography.locale ?? "es-ES",
      })
      setStyleResults([])
      setStyleQuery("")
      toast.success(`Estilo aplicado: ${selected.title}`)
    } catch (error) {
      toast.error("No se pudo cargar el estilo CSL", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setStyleBusy(false)
    }
  }

  const insertSelectedCitation = () => {
    const selected = sources.filter((source) =>
      selectedCitationIds.has(source.id)
    )
    if (selected.length === 0) {
      toast.info("Selecciona al menos una fuente")
      return
    }
    const items: CitationClusterItem[] = selected.map((source, index) => ({
      sourceId: source.id,
      locator: index === 0 ? locator.trim() || undefined : undefined,
      label: index === 0 && locator.trim() ? locatorLabel : undefined,
      prefix: index === 0 ? citationPrefix.trim() || undefined : undefined,
      suffix:
        index === selected.length - 1
          ? citationSuffix.trim() || undefined
          : undefined,
    }))
    const fallbackLabel = selected
      .map((source) => formatBibliographyEntry(source, style))
      .join("; ")
    onInsertCitation(
      {
        id: crypto.randomUUID(),
        mode: citationMode,
        items,
      },
      fallbackLabel
    )
    setSelectedCitationIds(new Set())
    setLocator("")
    setCitationPrefix("")
    setCitationSuffix("")
  }

  const mergeSafeDuplicates = () => {
    const result = deduplicateCitationSources(sources, 92)
    if (result.mergedCount === 0) {
      toast.info("No hay coincidencias seguras para fusionar automáticamente")
      return
    }
    onBibliographyChange(
      { ...bibliography, sources: result.sources },
      result.replacements
    )
    toast.success(
      `${result.mergedCount} ${result.mergedCount === 1 ? "duplicado fusionado" : "duplicados fusionados"}`
    )
  }

  const importSources = (incomingSources: CitationSource[]) => {
    const result = deduplicateCitationSources(
      [...sources, ...incomingSources],
      92
    )
    const importedIds = new Set(incomingSources.map((source) => source.id))
    const added = result.sources.filter(
      (source) =>
        importedIds.has(source.id) &&
        !sources.some((existing) => existing.id === source.id)
    )
      .length
    const flagged = findDuplicateGroups(result.sources, 72).reduce(
      (total, group) => total + group.duplicates.length,
      0
    )
    onBibliographyChange(
      { ...bibliography, sources: result.sources },
      result.replacements
    )
    return {
      added,
      merged: result.mergedCount,
      flagged,
    }
  }

  const importBibliographyFile = async (file: File) => {
    const text = await file.text()
    const parsedSources: CitationSource[] = []
    if (file.name.toLowerCase().endsWith(".bib") || text.includes("@")) {
      for (const entry of text.split(/(?=@[a-zA-Z]+\s*\{)/g)) {
        const field = (name: string) => {
          const match = entry.match(
            new RegExp(`${name}\\s*=\\s*[{"']([^}"']+)`, "i")
          )
          return match?.[1]?.trim() ?? ""
        }
        const title = field("title")
        if (!title) continue
        parsedSources.push(
          createCitationSource({
            author: field("author").replace(/\s+and\s+/gi, "; "),
            title,
            year: field("year"),
            publisher: field("publisher") || field("journal"),
            url: field("url"),
            doi: field("doi"),
            isbn: field("isbn"),
          })
        )
      }
    } else {
      for (const entry of text.split(/\r?\nER\s*-\s*/)) {
        const values = new Map<string, string[]>()
        for (const line of entry.split(/\r?\n/)) {
          const match = line.match(/^([A-Z0-9]{2})\s*-\s*(.+)$/)
          if (!match) continue
          values.set(match[1], [
            ...(values.get(match[1]) ?? []),
            match[2].trim(),
          ])
        }
        const title = values.get("TI")?.[0] || values.get("T1")?.[0]
        if (!title) continue
        parsedSources.push(
          createCitationSource({
            author: (values.get("AU") ?? []).join("; "),
            title,
            year: values.get("PY")?.[0]?.slice(0, 4) ?? "",
            publisher:
              values.get("PB")?.[0] || values.get("JO")?.[0] || "",
            url: values.get("UR")?.[0] ?? "",
            doi: values.get("DO")?.[0] ?? "",
            isbn: values.get("SN")?.[0] ?? "",
          })
        )
      }
    }
    const result = importSources(parsedSources)
    toast.success(
      `${result.added} nuevas · ${result.merged} duplicadas fusionadas · ${result.flagged} para revisar`
    )
  }

  const removeSource = (sourceId: string) => {
    onBibliographyChange({
      ...bibliography,
      sources: sources.filter((source) => source.id !== sourceId),
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Referencias sin duplicados
          </SheetTitle>
          <SheetDescription>
            Una identidad por obra. Si se fusionan dos registros, todas sus
            citas y la bibliografía se actualizan automáticamente.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="-mx-6 mt-5 flex-1 px-6">
          <div className="space-y-5 pb-8">
            <ZoteroConnector
              onImport={importSources}
              syncState={bibliography.zoteroSync}
              onSync={handleZoteroSync}
            />

            <Separator />

            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="citation-style-search">
                Estilo bibliográfico CSL
              </Label>
              <p className="text-xs text-muted-foreground">
                Activo: {bibliography.styleTitle ?? style} ·{" "}
                {bibliography.styleClass === "note"
                  ? "notas"
                  : "citas en el texto"}
              </p>
              <div className="flex gap-2">
                <Input
                  id="citation-style-search"
                  value={styleQuery}
                  onChange={(event) => setStyleQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void searchStyles()
                  }}
                  placeholder="Buscar APA, Vancouver, IEEE, Nature…"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => void searchStyles()}
                  disabled={styleBusy}
                  aria-label="Buscar estilos CSL"
                >
                  {styleBusy ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Search />
                  )}
                </Button>
              </div>
              {styleResults.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border bg-background p-1">
                  {styleResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded p-2 text-left text-xs hover:bg-muted"
                      onClick={() => void selectStyle(result.id)}
                    >
                      <span>{result.title}</span>
                      <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                        {result.class === "note" ? "notas" : "en texto"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <label className="grid w-full gap-1 text-xs">
                  <span className="text-muted-foreground">
                    Estilos académicos principales
                  </span>
                  <select
                    value={
                      ACADEMIC_CSL_STYLE_PRESETS.some(
                        (preset) => preset.id === style
                      )
                        ? style
                        : ""
                    }
                    onChange={(event) => {
                      if (event.target.value) {
                        void selectStyle(event.target.value)
                      }
                    }}
                    disabled={
                      styleBusy ||
                      typeof window === "undefined" ||
                      !window.editorDesktop
                    }
                    className="h-9 rounded-md border border-input bg-background px-3"
                  >
                    <option value="">Buscar otro estilo arriba…</option>
                    {[
                      "Humanidades y sociales",
                      "Ciencias y salud",
                      "Derecho y normas",
                    ].map((group) => (
                      <optgroup key={group} label={group}>
                        {ACADEMIC_CSL_STYLE_PRESETS.filter(
                          (preset) => preset.group === group
                        ).map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="grid w-full gap-1 text-xs">
                  <span className="text-muted-foreground">
                    Idioma de citas y bibliografía
                  </span>
                  <select
                    value={bibliography.locale ?? "es-ES"}
                    onChange={(event) =>
                      onBibliographyChange({
                        ...bibliography,
                        locale: event.target.value,
                      })
                    }
                    className="h-9 rounded-md border border-input bg-background px-3"
                  >
                    {CSL_LOCALE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {duplicateCount > 0 ? (
              <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      {duplicateCount}{" "}
                      {duplicateCount === 1
                        ? "posible duplicado"
                        : "posibles duplicados"}
                    </p>
                    <p className="text-xs opacity-80">
                      No se borrará nada sin conservar el registro más completo.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={mergeSafeDuplicates}
                >
                  <CheckCheck />
                  Fusionar coincidencias seguras
                </Button>
                {duplicateGroups.slice(0, 4).map((group) =>
                  group.duplicates.slice(0, 2).map((duplicate) => (
                    <article
                      key={`${group.canonical.id}:${duplicate.source.id}`}
                      className="rounded-lg border border-amber-300/60 bg-background/80 p-2.5 text-foreground"
                    >
                      <p className="line-clamp-2 text-xs font-semibold">
                        {group.canonical.title}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {duplicate.score}% · {duplicate.reasons.join(" · ")}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="mt-1 h-7"
                        onClick={() =>
                          void mergeExistingSources(
                            group.canonical,
                            duplicate.source
                          )
                        }
                      >
                        <Merge />
                        Fusionar estos registros
                      </Button>
                    </article>
                  ))
                )}
              </section>
            ) : sources.length > 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                No se detectan referencias duplicadas.
              </div>
            ) : null}

            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm font-semibold">Añadir fuente</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={form.author}
                  onChange={(event) =>
                    setForm({ ...form, author: event.target.value })
                  }
                  placeholder="Autor o autores"
                  className="col-span-2"
                />
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="Título"
                  className="col-span-2"
                />
                <Input
                  value={form.year}
                  onChange={(event) =>
                    setForm({ ...form, year: event.target.value })
                  }
                  placeholder="Año"
                />
                <Input
                  value={form.publisher}
                  onChange={(event) =>
                    setForm({ ...form, publisher: event.target.value })
                  }
                  placeholder="Editorial o revista"
                />
                <Input
                  value={form.doi}
                  onChange={(event) =>
                    setForm({ ...form, doi: event.target.value })
                  }
                  placeholder="DOI"
                />
                <Input
                  value={form.isbn}
                  onChange={(event) =>
                    setForm({ ...form, isbn: event.target.value })
                  }
                  placeholder="ISBN"
                />
                <Input
                  value={form.url}
                  onChange={(event) =>
                    setForm({ ...form, url: event.target.value })
                  }
                  placeholder="URL"
                  className="col-span-2"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                className="w-full"
              >
                <Plus />
                Comprobar y añadir
              </Button>
            </div>

            {pendingDuplicate && (
              <section className="space-y-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                <div className="flex items-start gap-2">
                  <CopyCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      Esta obra parece estar ya registrada
                    </p>
                    <p className="text-xs opacity-80">
                      Coincidencia del {pendingDuplicate.candidate.score}%:{" "}
                      {pendingDuplicate.candidate.reasons.join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-lg border bg-background/80 p-2 text-foreground">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Existente
                    </span>
                    <p className="mt-1 font-medium">
                      {pendingDuplicate.candidate.source.title}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {sourceSummary(pendingDuplicate.candidate.source)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background/80 p-2 text-foreground">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Nueva
                    </span>
                    <p className="mt-1 font-medium">
                      {pendingDuplicate.incoming.title}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {sourceSummary(pendingDuplicate.incoming)}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 rounded-lg border bg-background/80 p-2 text-foreground">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Elegir valor cuando difieren
                  </p>
                  {(
                    [
                      ["author", "Autor"],
                      ["title", "Título"],
                      ["year", "Año"],
                      ["publisher", "Editorial/revista"],
                      ["doi", "DOI"],
                      ["isbn", "ISBN"],
                      ["url", "URL"],
                    ] as Array<[keyof CitationSource, string]>
                  ).map(([field, label]) => {
                    const existingValue = String(
                      pendingDuplicate.candidate.source[field] ?? ""
                    )
                    const incomingValue = String(
                      pendingDuplicate.incoming[field] ?? ""
                    )
                    if (existingValue === incomingValue) return null
                    return (
                      <label
                        key={field}
                        className="grid grid-cols-[5rem_1fr] items-center gap-2 text-[11px]"
                      >
                        <span className="font-medium">{label}</span>
                        <select
                          value={fieldChoices[field] ?? "canonical"}
                          onChange={(event) =>
                            setFieldChoices((current) => ({
                              ...current,
                              [field]: event.target.value as
                                | "canonical"
                                | "duplicate",
                            }))
                          }
                          className="h-8 min-w-0 rounded border bg-background px-2"
                        >
                          <option value="canonical">
                            Existente: {existingValue || "vacío"}
                          </option>
                          <option value="duplicate">
                            Nueva: {incomingValue || "vacío"}
                          </option>
                        </select>
                      </label>
                    )
                  })}
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    const canonical = pendingDuplicate.candidate.source
                    const merged = mergeCitationSources(
                      canonical,
                      pendingDuplicate.incoming,
                      fieldChoices
                    )
                    onBibliographyChange({
                      ...bibliography,
                      sources: sources.map((source) =>
                        source.id === canonical.id ? merged : source
                      ),
                    })
                    setPendingDuplicate(null)
                    setFieldChoices({})
                    setForm(emptyForm)
                    toast.success(
                      "Registro fusionado sin crear una referencia duplicada"
                    )
                  }}
                >
                  <Merge />
                  Fusionar con la referencia existente
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPendingDuplicate(null)}
                  >
                    Volver y corregir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      commitNewSource(pendingDuplicate.incoming)
                      setPendingDuplicate(null)
                      toast.info(
                        "Se mantuvieron como obras distintas por decisión del usuario"
                      )
                    }}
                  >
                    Mantener separadas
                  </Button>
                </div>
              </section>
            )}

            {sources.length > 0 && (
              <section className="space-y-3 rounded-xl border-2 border-primary/25 bg-primary/5 p-3">
                <div>
                  <p className="text-sm font-semibold">Componer cita</p>
                  <p className="text-xs text-muted-foreground">
                    Admite varias obras, localizador, prefijo, sufijo y estilos
                    de nota.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs">
                    <span>Forma</span>
                    <select
                      value={citationMode}
                      onChange={(event) =>
                        setCitationMode(event.target.value as CitationMode)
                      }
                      className="h-9 w-full rounded border bg-background px-2"
                    >
                      <option value="parenthetical">Entre paréntesis</option>
                      <option value="narrative">Narrativa</option>
                      <option value="note">Nota al pie</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs">
                    <span>Localizador</span>
                    <div className="flex">
                      <select
                        value={locatorLabel}
                        onChange={(event) =>
                          setLocatorLabel(
                            event.target.value as CitationLocatorLabel
                          )
                        }
                        className="h-9 w-24 rounded-l border bg-background px-1"
                      >
                        <option value="page">página</option>
                        <option value="chapter">capítulo</option>
                        <option value="section">sección</option>
                        <option value="paragraph">párrafo</option>
                        <option value="figure">figura</option>
                        <option value="table">tabla</option>
                        <option value="volume">volumen</option>
                        <option value="issue">número</option>
                        <option value="line">línea</option>
                      </select>
                      <Input
                        value={locator}
                        onChange={(event) => setLocator(event.target.value)}
                        placeholder="23–25"
                        className="rounded-l-none"
                      />
                    </div>
                  </label>
                  <Input
                    value={citationPrefix}
                    onChange={(event) => setCitationPrefix(event.target.value)}
                    placeholder="Prefijo: véase"
                  />
                  <Input
                    value={citationSuffix}
                    onChange={(event) => setCitationSuffix(event.target.value)}
                    placeholder="Sufijo"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  disabled={selectedCitationIds.size === 0}
                  onClick={insertSelectedCitation}
                >
                  <Quote />
                  Insertar cita con {selectedCitationIds.size}{" "}
                  {selectedCitationIds.size === 1 ? "fuente" : "fuentes"}
                </Button>
              </section>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  Fuentes únicas ({sources.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <input
                    ref={importRef}
                    type="file"
                    accept=".bib,.ris,.txt"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void importBibliographyFile(file)
                      event.target.value = ""
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload />
                    BibTeX/RIS
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={sources.length === 0}
                    onClick={() =>
                      onInsertBibliography(
                        "Bibliografía",
                        sources.map((source) =>
                          formatBibliographyEntry(source, style)
                        ),
                        style
                      )
                    }
                  >
                    Generar bibliografía
                  </Button>
                </div>
              </div>
              {sources.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  Conecta Zotero, importa BibTeX/RIS o añade una fuente
                  manualmente.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sources.map((source) => (
                    <li
                      key={source.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCitationIds.has(source.id)}
                          onChange={(event) =>
                            setSelectedCitationIds((current) => {
                              const next = new Set(current)
                              if (event.target.checked) next.add(source.id)
                              else next.delete(source.id)
                              return next
                            })
                          }
                          className="mt-1 h-4 w-4 shrink-0"
                          aria-label={`Seleccionar ${source.title} para la cita`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{source.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {sourceSummary(source)}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          title="Identificador bibliográfico estable"
                        >
                          {citationDisplayCode(source)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {formatBibliographyEntry(source, style)}
                      </p>
                      {source.zoteroKeys && source.zoteroKeys.length > 0 && (
                        <p className="mt-1 text-[10px] font-medium text-red-700 dark:text-red-300">
                          Vinculada con Zotero
                          {source.zoteroDeleted
                            ? " · eliminada en la biblioteca remota"
                            : ""}
                        </p>
                      )}
                      {source.attachments && source.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {source.attachments.map((attachment) => {
                            const link = source.zoteroLinks?.[0]
                            return (
                              <Button
                                key={attachment.key}
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px]"
                                disabled={!link || !window.editorDesktop}
                                onClick={() => {
                                  if (!link || !window.editorDesktop) return
                                  void window.editorDesktop.zotero
                                    .openAttachment({
                                      mode: link.mode,
                                      libraryType: link.libraryType,
                                      libraryId: link.libraryId,
                                      attachment: {
                                        ...attachment,
                                        version: attachment.version ?? 0,
                                      },
                                    })
                                    .catch((error) =>
                                      toast.error("No se pudo abrir el adjunto", {
                                        description:
                                          error instanceof Error
                                            ? error.message
                                            : undefined,
                                      })
                                    )
                                }}
                              >
                                <Paperclip className="h-3 w-3" />
                                {attachment.filename ||
                                  attachment.title ||
                                  "Adjunto"}
                              </Button>
                            )
                          })}
                        </div>
                      )}
                      <div className="mt-2 flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setSelectedCitationIds(new Set([source.id]))
                            onInsertCitation(
                              {
                                id: crypto.randomUUID(),
                                mode: "parenthetical",
                                items: [{ sourceId: source.id }],
                              },
                              formatBibliographyEntry(source, style)
                            )
                          }}
                        >
                          <Quote className="h-3 w-3" />
                          Insertar cita vinculada
                        </Button>
                        {source.url && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() =>
                              void window.editorDesktop?.windows.openExternal(
                                source.url
                              )
                            }
                            aria-label="Abrir fuente"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="ml-auto h-7 w-7 text-destructive"
                          onClick={() => removeSource(source.id)}
                          aria-label={`Eliminar ${source.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
