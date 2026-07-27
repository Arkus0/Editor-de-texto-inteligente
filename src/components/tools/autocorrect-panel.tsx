"use client"

import * as React from "react"
import { Plus, RotateCcw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_AUTOCORRECT_SETTINGS,
  type AutoCorrectSettings,
} from "@/types/document"

interface AutoCorrectPanelProps {
  settings: AutoCorrectSettings
  onChange: (settings: AutoCorrectSettings) => void
}

export function AutoCorrectPanel({
  settings,
  onChange,
}: AutoCorrectPanelProps) {
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")

  const update = (patch: Partial<AutoCorrectSettings>) =>
    onChange({ ...settings, ...patch })

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Autocorrección al escribir</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Funciona localmente y nunca modifica bloques de código.
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(enabled) => update({ enabled })}
          aria-label="Activar autocorrección"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={settings.capitalizeSentences}
            disabled={!settings.enabled}
            onChange={(event) =>
              update({ capitalizeSentences: event.target.checked })
            }
          />
          Mayúscula tras punto
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={settings.smartQuotes}
            disabled={!settings.enabled}
            onChange={(event) =>
              update({ smartQuotes: event.target.checked })
            }
          />
          Comillas tipográficas
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={settings.smartDashes}
            disabled={!settings.enabled}
            onChange={(event) =>
              update({ smartDashes: event.target.checked })
            }
          />
          Doble guion → raya
        </label>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Input
          value={from}
          disabled={!settings.enabled}
          maxLength={40}
          onChange={(event) => setFrom(event.target.value)}
          placeholder="Reemplazar"
          aria-label="Texto que se reemplazará"
          className="h-8"
        />
        <Input
          value={to}
          disabled={!settings.enabled}
          maxLength={100}
          onChange={(event) => setTo(event.target.value)}
          placeholder="Por"
          aria-label="Texto de sustitución"
          className="h-8"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={!settings.enabled || !from.trim()}
          aria-label="Añadir sustitución"
          onClick={() => {
            const source = from.trim()
            if (!source) return
            onChange({
              ...settings,
              replacements: [
                ...settings.replacements.filter(
                  (replacement) =>
                    replacement.from.toLocaleLowerCase() !==
                    source.toLocaleLowerCase()
                ),
                {
                  id: crypto.randomUUID(),
                  from: source,
                  to,
                  caseSensitive: false,
                },
              ].slice(-200),
            })
            setFrom("")
            setTo("")
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-h-40 space-y-1 overflow-auto">
        {settings.replacements.map((replacement) => (
          <div
            key={replacement.id}
            className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 rounded bg-muted/40 px-2 py-1 text-xs"
          >
            <span className="truncate">{replacement.from}</span>
            <span aria-hidden="true">→</span>
            <span className="truncate">{replacement.to || "(vacío)"}</span>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Eliminar sustitución ${replacement.from}`}
              onClick={() =>
                update({
                  replacements: settings.replacements.filter(
                    (candidate) => candidate.id !== replacement.id
                  ),
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="w-full"
        onClick={() =>
          onChange({
            ...DEFAULT_AUTOCORRECT_SETTINGS,
            replacements: DEFAULT_AUTOCORRECT_SETTINGS.replacements.map(
              (replacement) => ({ ...replacement })
            ),
          })
        }
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Restaurar autocorrección
      </Button>
    </section>
  )
}
