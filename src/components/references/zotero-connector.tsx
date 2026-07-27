"use client"

import * as React from "react"
import {
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  FolderTree,
  KeyRound,
  LoaderCircle,
  Monitor,
  Paperclip,
  RefreshCw,
  Search,
  Tags,
  Unplug,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { createCitationSource, type CitationSource } from "@/types/citation"
import type {
  ZoteroConnectionInfo,
  ZoteroAttachment,
  ZoteroCollection,
  ZoteroItem,
  ZoteroLibrary,
} from "@/types/desktop"
import type { ZoteroLibrarySyncState } from "@/types/citation"

interface ZoteroConnectorProps {
  onImport: (sources: CitationSource[]) => {
    added: number
    merged: number
    flagged: number
  }
  syncState?: Record<string, ZoteroLibrarySyncState>
  onSync: (
    sources: CitationSource[],
    deletedKeys: string[],
    state: ZoteroLibrarySyncState
  ) => void
}

function creatorName(creator: ZoteroItem["creators"][number]) {
  if (creator.name?.trim()) return creator.name.trim()
  return [creator.lastName, creator.firstName].filter(Boolean).join(", ")
}

function itemToCitationSource(
  item: ZoteroItem,
  mode: "local" | "web",
  attachments: ZoteroAttachment[] = []
): CitationSource {
  const authors = item.creators
    .filter(
      (creator) =>
        !creator.creatorType ||
        creator.creatorType === "author" ||
        creator.creatorType === "editor"
    )
    .map(creatorName)
    .filter(Boolean)
    .join("; ")
  const stableKey = `${item.libraryType}:${item.libraryId}:${item.key}`
  return createCitationSource(
    {
      author: authors,
      title: item.title,
      year: item.date.match(/\b\d{4}\b/)?.[0] ?? item.date,
      publisher: item.publisher || item.publicationTitle,
      url: item.url,
      doi: item.DOI,
      isbn: item.ISBN,
      zoteroKeys: [stableKey],
      zoteroLinks: [
        {
          mode,
          libraryType: item.libraryType,
          libraryId: item.libraryId,
          itemKey: item.key,
          version: item.version,
          dateModified: item.dateModified,
        },
      ],
      itemType: item.itemType,
      abstract: item.abstract,
      volume: item.volume,
      issue: item.issue,
      pages: item.pages,
      edition: item.edition,
      language: item.language,
      collections: item.collections,
      tags: item.tags,
      attachments: attachments
        .filter((entry) => entry.parentItem === item.key)
        .map((entry) => ({ ...entry })),
    },
    `zotero-${item.libraryType}-${item.libraryId}-${item.key}`
  )
}

export function ZoteroConnector({
  onImport,
  syncState = {},
  onSync,
}: ZoteroConnectorProps) {
  const [connection, setConnection] =
    React.useState<ZoteroConnectionInfo | null>(null)
  const [selectedLibraryValue, setSelectedLibraryValue] = React.useState("")
  const [items, setItems] = React.useState<ZoteroItem[]>([])
  const [collections, setCollections] = React.useState<ZoteroCollection[]>([])
  const [collectionKey, setCollectionKey] = React.useState("")
  const [tagFilter, setTagFilter] = React.useState("")
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set())
  const [query, setQuery] = React.useState("")
  const [apiKeyDraft, setApiKeyDraft] = React.useState("")
  const [hasWebKey, setHasWebKey] = React.useState(false)
  const [busy, setBusy] = React.useState<
    "local" | "web" | "items" | "import" | "sync" | null
  >(null)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.editorDesktop) return
    void window.editorDesktop.secrets
      .hasZoteroKey()
      .then(setHasWebKey)
      .catch(() => setHasWebKey(false))
  }, [])

  const applyConnection = (next: ZoteroConnectionInfo) => {
    setConnection(next)
    const firstLibrary = next.libraries[0]
    setSelectedLibraryValue(
      firstLibrary ? `${firstLibrary.type}:${firstLibrary.id}` : ""
    )
    setItems([])
    setCollections([])
    setCollectionKey("")
    setSelectedKeys(new Set())
    setError("")
  }

  const connectLocal = async () => {
    if (!window.editorDesktop) return
    setBusy("local")
    setError("")
    try {
      applyConnection(await window.editorDesktop.zotero.connectLocal())
      toast.success("Zotero Desktop conectado")
    } catch (connectionError) {
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "No se pudo conectar con Zotero Desktop."
      )
    } finally {
      setBusy(null)
    }
  }

  const connectWeb = async (saveKey: boolean) => {
    if (!window.editorDesktop) return
    setBusy("web")
    setError("")
    try {
      if (saveKey) {
        await window.editorDesktop.secrets.setZoteroKey(apiKeyDraft.trim())
      }
      const next = await window.editorDesktop.zotero.connectWeb()
      setHasWebKey(true)
      setApiKeyDraft("")
      applyConnection(next)
      toast.success("Cuenta de Zotero conectada")
    } catch (connectionError) {
      if (saveKey) {
        await window.editorDesktop.secrets.clearZoteroKey()
        setHasWebKey(false)
      }
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "No se pudo conectar con Zotero.org."
      )
    } finally {
      setBusy(null)
    }
  }

  const selectedLibrary = React.useMemo<ZoteroLibrary | undefined>(() => {
    const [type, id] = selectedLibraryValue.split(":")
    return connection?.libraries.find(
      (library) => library.type === type && library.id === id
    )
  }, [connection?.libraries, selectedLibraryValue])

  React.useEffect(() => {
    if (!window.editorDesktop || !connection || !selectedLibrary) return
    void window.editorDesktop.zotero
      .fetchCollections({
        mode: connection.mode,
        libraryType: selectedLibrary.type,
        libraryId: selectedLibrary.id,
        limit: 1000,
      })
      .then(setCollections)
      .catch(() => setCollections([]))
  }, [connection, selectedLibrary])

  const fetchItems = async () => {
    if (!window.editorDesktop || !connection || !selectedLibrary) return
    setBusy("items")
    setError("")
    try {
      const nextItems = await window.editorDesktop.zotero.fetchItems({
        mode: connection.mode,
        libraryType: selectedLibrary.type,
        libraryId: selectedLibrary.id,
        query: query.trim() || undefined,
        collectionKey: collectionKey || undefined,
        limit: query.trim() ? 200 : 300,
      })
      const filteredItems = tagFilter
        ? nextItems.filter((item) =>
            item.tags.some(
              (tag) =>
                tag.localeCompare(tagFilter, "es", {
                  sensitivity: "base",
                }) === 0
            )
          )
        : nextItems
      setItems(filteredItems)
      setSelectedKeys(new Set(filteredItems.map((item) => item.key)))
      if (filteredItems.length === 0) {
        toast.info("Zotero no devolvió referencias para esta búsqueda")
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron leer las referencias."
      )
    } finally {
      setBusy(null)
    }
  }

  const importSelected = async () => {
    if (!window.editorDesktop || !connection || !selectedLibrary) return
    const selected = items.filter((item) => selectedKeys.has(item.key))
    if (selected.length === 0) return
    setBusy("import")
    try {
      const attachments = await window.editorDesktop.zotero.fetchAttachments({
        mode: connection.mode,
        libraryType: selectedLibrary.type,
        libraryId: selectedLibrary.id,
        parentKeys: selected.map((item) => item.key),
      })
      const sources = selected.map((item) =>
        itemToCitationSource(item, connection.mode, attachments)
      )
      const result = onImport(sources)
      toast.success(
        `${result.added} nuevas · ${result.merged} fusionadas · ${result.flagged} para revisar`
      )
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "No se pudieron importar las referencias."
      )
    } finally {
      setBusy(null)
    }
  }

  const synchronizeLibrary = async () => {
    if (!window.editorDesktop || !connection || !selectedLibrary) return
    const syncKey = `${connection.mode}:${selectedLibrary.type}:${selectedLibrary.id}`
    const previousVersion = syncState[syncKey]?.libraryVersion ?? 0
    setBusy("sync")
    setError("")
    try {
      const result = await window.editorDesktop.zotero.sync({
        mode: connection.mode,
        libraryType: selectedLibrary.type,
        libraryId: selectedLibrary.id,
        since: previousVersion,
        limit: 1000,
      })
      const changedKeys = result.items.map((item) => item.key)
      const missingAttachmentKeys = changedKeys.filter(
        (key) =>
          !result.attachments.some((attachment) => attachment.parentItem === key)
      )
      const extraAttachments = missingAttachmentKeys.length
        ? await window.editorDesktop.zotero.fetchAttachments({
            mode: connection.mode,
            libraryType: selectedLibrary.type,
            libraryId: selectedLibrary.id,
            parentKeys: missingAttachmentKeys,
          })
        : []
      const attachments = [...result.attachments, ...extraAttachments]
      onSync(
        result.items.map((item) =>
          itemToCitationSource(item, connection.mode, attachments)
        ),
        result.deletedItemKeys,
        {
          mode: connection.mode,
          libraryType: selectedLibrary.type,
          libraryId: selectedLibrary.id,
          libraryVersion: result.libraryVersion,
          lastSyncedAt: new Date().toISOString(),
        }
      )
      toast.success("Biblioteca sincronizada", {
        description: `${result.items.length} cambios · ${result.deletedItemKeys.length} eliminaciones`,
      })
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "No se pudo sincronizar la biblioteca."
      )
    } finally {
      setBusy(null)
    }
  }

  const openZoteroKeys = () => {
    void window.editorDesktop?.windows.openExternal(
      "https://www.zotero.org/settings/keys/new"
    )
  }

  const forgetWebKey = async () => {
    if (!window.editorDesktop) return
    await window.editorDesktop.secrets.clearZoteroKey()
    setHasWebKey(false)
    setConnection(null)
    setItems([])
    setSelectedKeys(new Set())
    toast.success("Clave de Zotero eliminada de este equipo")
  }

  if (typeof window === "undefined" || !window.editorDesktop) {
    return (
      <section className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        La conexión directa con Zotero está disponible en la aplicación de
        Windows.
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600 font-serif text-sm font-bold text-white">
            Z
          </span>
          Conectar con Zotero
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Importa la biblioteca local o Zotero.org. Antes de guardar, todas las
          referencias pasan por el detector de duplicados.
        </p>
      </div>

      {!connection ? (
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => void connectLocal()}
            disabled={busy !== null}
          >
            {busy === "local" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Monitor />
            )}
            Detectar Zotero Desktop
          </Button>

          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Separator className="flex-1" />
            o sincronizar la nube
            <Separator className="flex-1" />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openZoteroKeys}
          >
            <ExternalLink />
            Crear API Key en Zotero
          </Button>
          <div className="space-y-2">
            <Label htmlFor="zotero-api-key">API Key de Zotero</Label>
            <Input
              id="zotero-api-key"
              type="password"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              placeholder={
                hasWebKey
                  ? "Clave guardada; conecta o pega otra"
                  : "Pega la clave privada de Zotero"
              }
              autoComplete="off"
            />
            <Button
              type="button"
              className="w-full"
              onClick={() =>
                void connectWeb(Boolean(apiKeyDraft.trim()))
              }
              disabled={
                busy !== null || (!apiKeyDraft.trim() && !hasWebKey)
              }
            >
              {busy === "web" ? (
                <LoaderCircle className="animate-spin" />
              ) : apiKeyDraft.trim() ? (
                <KeyRound />
              ) : (
                <Cloud />
              )}
              {apiKeyDraft.trim()
                ? "Guardar y conectar"
                : "Conectar Zotero.org"}
            </Button>
            {hasWebKey && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => void forgetWebKey()}
                disabled={busy !== null}
              >
                Olvidar la clave guardada
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border bg-background p-2.5">
            <span className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              {connection.mode === "local"
                ? "Zotero Desktop"
                : connection.username || "Zotero.org"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setConnection(null)
                setItems([])
                setCollections([])
                setCollectionKey("")
                setSelectedKeys(new Set())
              }}
            >
              <Unplug />
              Desconectar
            </Button>
          </div>

          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Biblioteca</span>
            <select
              value={selectedLibraryValue}
              onChange={(event) => {
                setSelectedLibraryValue(event.target.value)
                setItems([])
                setCollectionKey("")
                setCollections([])
                setSelectedKeys(new Set())
              }}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {connection.libraries.map((library) => (
                <option
                  key={`${library.type}:${library.id}`}
                  value={`${library.type}:${library.id}`}
                >
                  {library.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <FolderTree className="h-3.5 w-3.5" />
                Colección
              </span>
              <select
                value={collectionKey}
                onChange={(event) => setCollectionKey(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Toda la biblioteca</option>
                {collections.map((collection) => (
                  <option key={collection.key} value={collection.key}>
                    {collection.name}
                    {collection.itemCount ? ` (${collection.itemCount})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Tags className="h-3.5 w-3.5" />
                Etiqueta exacta
              </span>
              <Input
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                placeholder="p. ej. tesis"
                className="h-9 text-xs"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título, autor o año"
              onKeyDown={(event) => {
                if (event.key === "Enter") void fetchItems()
              }}
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void fetchItems()}
              disabled={busy !== null || !selectedLibrary}
              aria-label="Buscar en Zotero"
            >
              {busy === "items" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Search />
              )}
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void synchronizeLibrary()}
            disabled={busy !== null || !selectedLibrary}
          >
            {busy === "sync" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Sincronizar cambios desde la última versión
          </Button>

          {items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={() =>
                    setSelectedKeys(
                      selectedKeys.size === items.length
                        ? new Set()
                        : new Set(items.map((item) => item.key))
                    )
                  }
                >
                  {selectedKeys.size === items.length
                    ? "Deseleccionar todo"
                    : "Seleccionar todo"}
                </button>
                <span className="text-muted-foreground">
                  {selectedKeys.size} de {items.length}
                </span>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border bg-background p-1.5">
                {items.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer gap-2 rounded-md p-2 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(item.key)}
                      onChange={(event) => {
                        setSelectedKeys((current) => {
                          const next = new Set(current)
                          if (event.target.checked) next.add(item.key)
                          else next.delete(item.key)
                          return next
                        })
                      }}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-xs font-medium">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {[
                          item.creators.map(creatorName).filter(Boolean).join("; "),
                          item.date.match(/\d{4}/)?.[0],
                          item.publicationTitle || item.publisher,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {(item.tags.length > 0 || item.collections.length > 0) && (
                        <span className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {item.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tags className="h-3 w-3" />
                              {item.tags.slice(0, 3).join(", ")}
                            </span>
                          )}
                          <span className="flex items-center gap-1" title="Los adjuntos se importarán al vínculo">
                            <Paperclip className="h-3 w-3" />
                            adjuntos
                          </span>
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={() => void importSelected()}
                disabled={selectedKeys.size === 0 || busy !== null}
              >
                <Download />
                Importar {selectedKeys.size} referencias sin duplicados
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </section>
  )
}
