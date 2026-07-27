"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface RibbonComboboxOption {
  id: string
  label: string
  value: string
  group?: string
  previewStyle?: React.CSSProperties
}

interface RibbonComboboxProps {
  value: string
  displayValue?: string
  placeholder: string
  options: RibbonComboboxOption[]
  groupOrder?: string[]
  groupLabels?: Record<string, string>
  onSelect: (value: string) => void
  onCommitCustom?: (value: string) => void
  ariaLabel: string
  title?: string
  widthClass?: string
  triggerStyle?: React.CSSProperties
  /** Vista previa en vivo: se llama al pasar el ratón sobre una opción, y
   * `onOptionHoverEnd` al salir de la lista sin hacer clic (para revertirla). */
  onOptionHover?: (value: string) => void
  onOptionHoverEnd?: () => void
}

/**
 * Combobox escribible al estilo del selector de fuente de Word: se puede
 * escribir para filtrar/buscar, o escribir un valor que no está en la lista
 * y aplicarlo tal cual con Enter (para fuentes instaladas que no conocemos).
 */
export function RibbonCombobox({
  value,
  displayValue,
  placeholder,
  options,
  groupOrder,
  groupLabels,
  onSelect,
  onCommitCustom,
  ariaLabel,
  title,
  widthClass,
  triggerStyle,
  onOptionHover,
  onOptionHoverEnd,
}: RibbonComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const currentOption = options.find((option) => option.value === value)
  const shownValue = displayValue ?? currentOption?.label ?? value

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => option.label.toLowerCase().includes(needle))
  }, [options, query])

  const groups = React.useMemo(() => {
    const order =
      groupOrder ?? Array.from(new Set(options.map((option) => option.group ?? "")))
    return order
      .map((group) => ({
        group,
        items: filtered.filter((option) => (option.group ?? "") === group),
      }))
      .filter((entry) => entry.items.length > 0)
  }, [filtered, groupOrder, options])

  const commitCustomValue = () => {
    const typed = query.trim()
    if (!typed) return
    const match = options.find((option) => option.label.toLowerCase() === typed.toLowerCase())
    if (match) {
      onSelect(match.value)
    } else if (onCommitCustom) {
      onCommitCustom(typed)
    } else {
      return
    }
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setQuery("")
          requestAnimationFrame(() => inputRef.current?.select())
        } else {
          onOptionHoverEnd?.()
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 items-center justify-between gap-1 truncate rounded border border-input bg-background px-2 text-xs hover:bg-accent",
            widthClass ?? "w-28"
          )}
          title={title}
          aria-label={ariaLabel}
          style={triggerStyle}
        >
          <span className="truncate">{shownValue || placeholder}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-2" align="start">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="h-8 w-full rounded border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              if (filtered.length === 1) {
                onSelect(filtered[0].value)
                setOpen(false)
                setQuery("")
              } else {
                commitCustomValue()
              }
            } else if (event.key === "Escape") {
              setOpen(false)
            }
          }}
        />
        <ScrollArea
          className="h-56 pr-2"
          onMouseLeave={() => onOptionHoverEnd?.()}
        >
          <div className="space-y-2">
            {groups.length === 0 && (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                Sin coincidencias. Pulsa Enter para usar &quot;{query}&quot;.
              </p>
            )}
            {groups.map(({ group, items }) => (
              <div key={group || "default"}>
                {group && groupLabels?.[group] && (
                  <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {groupLabels[group]}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onSelect(option.value)
                        setOpen(false)
                        setQuery("")
                      }}
                      onMouseEnter={() => onOptionHover?.(option.value)}
                      className={cn(
                        "flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                        option.value === value && "bg-accent/70 font-medium"
                      )}
                      style={option.previewStyle}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
