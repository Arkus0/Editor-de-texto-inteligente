"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { BookOpenText, Loader2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  decodeMyThes,
  parseMyThesText,
  thesaurusFilename,
  type ThesaurusLookupResult,
} from "@/lib/thesaurus"

interface ThesaurusPanelProps {
  editor: Editor | null
  language: string
}

interface WordRange {
  from: number
  to: number
  word: string
}

const browserThesaurusCache = new Map<string, Promise<string>>()
const WORD_CHARACTER = /[\p{L}\p{M}'’\-]/u

function selectedWordRange(editor: Editor): WordRange | null {
  const { from, to } = editor.state.selection
  if (from !== to) {
    const word = editor.state.doc.textBetween(from, to, " ").trim()
    return word && word.length <= 80 && !/\s/.test(word)
      ? { from, to, word }
      : null
  }

  const $from = editor.state.doc.resolve(from)
  if (!$from.parent.isTextblock) return null
  const text = $from.parent.textContent
  let start = $from.parentOffset
  let end = $from.parentOffset
  while (start > 0 && WORD_CHARACTER.test(text[start - 1] ?? "")) start -= 1
  while (end < text.length && WORD_CHARACTER.test(text[end] ?? "")) end += 1
  const word = text.slice(start, end)
  return word
    ? {
        from: $from.start() + start,
        to: $from.start() + end,
        word,
      }
    : null
}

function preserveCase(source: string, replacement: string, language: string) {
  if (source === source.toLocaleUpperCase(language)) {
    return replacement.toLocaleUpperCase(language)
  }
  const first = source[0]
  if (first && first === first.toLocaleUpperCase(language)) {
    return (
      replacement[0]?.toLocaleUpperCase(language) + replacement.slice(1)
    )
  }
  return replacement
}

async function lookupInBrowser(word: string, language: string) {
  const filename = thesaurusFilename(language)
  if (!filename) {
    return {
      word,
      language,
      source: "libreoffice-mythes",
      available: false,
      meanings: [],
    } satisfies ThesaurusLookupResult
  }
  let pending = browserThesaurusCache.get(filename)
  if (!pending) {
    pending = fetch(`/dictionaries/${filename}`)
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo abrir el tesauro local.")
        return response.arrayBuffer()
      })
      .then(decodeMyThes)
    browserThesaurusCache.set(filename, pending)
  }
  return parseMyThesText(await pending, word, language)
}

export function ThesaurusPanel({
  editor,
  language,
}: ThesaurusPanelProps) {
  const [query, setQuery] = React.useState("")
  const [target, setTarget] = React.useState<WordRange | null>(null)
  const [result, setResult] =
    React.useState<ThesaurusLookupResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (!editor) return
    const syncSelection = () => {
      const nextTarget = selectedWordRange(editor)
      setTarget(nextTarget)
      if (nextTarget) setQuery(nextTarget.word)
    }
    syncSelection()
    editor.on("selectionUpdate", syncSelection)
    return () => {
      editor.off("selectionUpdate", syncSelection)
    }
  }, [editor])

  const lookup = async () => {
    const word = query.trim()
    if (!word || loading) return
    setLoading(true)
    setError("")
    try {
      const nextResult = window.editorDesktop
        ? await window.editorDesktop.dictionary.lookupSynonyms({
            word,
            language,
          })
        : await lookupInBrowser(word, language)
      setResult(nextResult)
    } catch (lookupError) {
      setResult(null)
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "No se pudo consultar el tesauro local."
      )
    } finally {
      setLoading(false)
    }
  }

  const canReplace =
    Boolean(editor && target) &&
    target?.word.toLocaleLowerCase(language) ===
      query.trim().toLocaleLowerCase(language)

  return (
    <section className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <BookOpenText className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-medium">Sinónimos sin conexión</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tesauros completos de LibreOffice para español e inglés. Coloca el
            cursor sobre una palabra o selecciónala.
          </p>
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void lookup()
        }}
      >
        <Input
          value={query}
          maxLength={80}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Palabra"
          aria-label="Palabra para buscar sinónimos"
          className="h-8"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={!query.trim() || loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          Buscar
        </Button>
      </form>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : result && !result.available ? (
        <p className="text-xs text-muted-foreground">
          Aún no hay un tesauro local para {language}.
        </p>
      ) : result && result.meanings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No se encontraron equivalentes para «{result.word}».
        </p>
      ) : null}

      {result?.meanings.map((meaning, meaningIndex) => (
        <div
          key={`${meaning.label}-${meaningIndex}`}
          className="space-y-1.5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {meaning.label}
          </p>
          <div className="flex flex-wrap gap-1">
            {meaning.synonyms.map((synonym) => (
              <button
                key={synonym}
                type="button"
                disabled={!canReplace}
                title={
                  canReplace
                    ? `Sustituir «${target?.word}» por «${synonym}»`
                    : "Selecciona la palabra buscada para sustituirla"
                }
                className="rounded-full border bg-background px-2 py-1 text-xs hover:border-primary hover:text-primary disabled:cursor-default disabled:opacity-70"
                onClick={() => {
                  if (!editor || !target || !canReplace) return
                  editor
                    .chain()
                    .focus()
                    .insertContentAt(
                      { from: target.from, to: target.to },
                      preserveCase(target.word, synonym, language)
                    )
                    .run()
                }}
              >
                {synonym}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
