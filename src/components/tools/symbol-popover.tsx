"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { Search, Sigma } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  EDITOR_SYMBOLS,
  isEditorSymbol,
  searchEditorSymbols,
} from "@/lib/symbols"

const RECENT_SYMBOLS_KEY = "editor-inteligente:recent-symbols"

export function SymbolPopover({ editor }: { editor: Editor }) {
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState("todos")
  const [recent, setRecent] = React.useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_SYMBOLS_KEY) ?? "[]")
      if (Array.isArray(parsed)) {
        return parsed.filter(isEditorSymbol).slice(0, 16)
      }
    } catch {
      return []
    }
    return []
  })

  const insert = (value: string) => {
    editor.chain().focus().insertContent(value).run()
    setRecent((current) => {
      const next = [value, ...current.filter((symbol) => symbol !== value)].slice(
        0,
        16
      )
      localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(next))
      return next
    })
  }

  const matches = searchEditorSymbols(query, category)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          onMouseDown={(event) => event.preventDefault()}
        >
          <Sigma />
          Símbolos
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[24rem] space-y-3" align="start">
        <div>
          <p className="text-sm font-medium">Símbolos y caracteres especiales</p>
          <p className="text-xs text-muted-foreground">
            Matemáticas, griego, flechas, monedas y signos editoriales.
          </p>
        </div>
        <div className="grid grid-cols-[1fr_8rem] gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre"
              className="h-8 pl-8"
              aria-label="Buscar símbolos"
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-8 rounded border border-input bg-background px-2 text-xs"
            aria-label="Categoría de símbolos"
          >
            <option value="todos">Todos</option>
            <option value="matemáticas">Matemáticas</option>
            <option value="griego">Griego</option>
            <option value="flechas">Flechas</option>
            <option value="monedas">Monedas</option>
            <option value="texto">Texto</option>
          </select>
        </div>

        {!query && category === "todos" && recent.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recientes
            </p>
            <div className="grid grid-cols-8 gap-1">
              {recent.map((value) => {
                const item = EDITOR_SYMBOLS.find(
                  (symbol) => symbol.value === value
                )
                return (
                  <button
                    key={value}
                    type="button"
                    title={item?.name}
                    aria-label={`Insertar ${item?.name ?? value}`}
                    className="h-9 rounded border text-lg hover:border-primary hover:bg-accent"
                    onClick={() => insert(value)}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="max-h-64 overflow-auto pr-1">
          {matches.length > 0 ? (
            <div className="grid grid-cols-8 gap-1">
              {matches.map((symbol) => (
                <button
                  key={`${symbol.category}-${symbol.value}`}
                  type="button"
                  title={symbol.name}
                  aria-label={`Insertar ${symbol.name}`}
                  className="h-9 rounded border text-lg hover:border-primary hover:bg-accent"
                  onClick={() => insert(symbol.value)}
                >
                  {symbol.value}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No hay símbolos que coincidan.
            </p>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {matches.length} símbolos · la lista de recientes solo se guarda en
          este equipo.
        </p>
      </PopoverContent>
    </Popover>
  )
}
