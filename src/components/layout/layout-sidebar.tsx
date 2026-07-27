"use client"

import * as React from "react"
import {
  Columns3,
  FilePlus2,
  GraduationCap,
  LayoutPanelTop,
  Pilcrow,
} from "lucide-react"

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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type {
  DocumentSection,
  DocumentWorkspaceState,
  LineNumberRestartMode,
  PageBorderStyle,
  PageNumberFormat,
  PageNumberPosition,
  SectionBreakType,
} from "@/types/document"

export type LayoutFocusSection =
  | "page"
  | "borders"
  | "watermark"
  | "headerFooter"
  | "pageNumber"

interface LayoutSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: DocumentWorkspaceState
  activeSectionId: string
  onChange: (state: DocumentWorkspaceState) => void
  onInsertSectionBreak: (type: SectionBreakType) => void
  onCreateThesisStructure: () => void
  focusSection?: LayoutFocusSection
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 240,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) =>
          onChange(
            Math.min(max, Math.max(min, Number(event.target.value) || min))
          )
        }
        className="h-8"
      />
    </label>
  )
}

export function LayoutSidebar({
  open,
  onOpenChange,
  state,
  activeSectionId,
  onChange,
  onInsertSectionBreak,
  onCreateThesisStructure,
  focusSection,
}: LayoutSidebarProps) {
  const [selectedSectionId, setSelectedSectionId] = React.useState(
    activeSectionId || state.sections[0]?.id || ""
  )
  const sectionAnchorRefs = React.useRef<
    Partial<Record<LayoutFocusSection, HTMLElement | null>>
  >({})

  React.useEffect(() => {
    if (!open || !focusSection) return
    // El Sheet tarda ~500ms en deslizarse (ver sheet.tsx, duration-500):
    // hay que esperar a que termine antes de medir/scrollear, si no
    // scrollIntoView calcula la posición a mitad de la animación.
    const timeout = setTimeout(() => {
      const target = sectionAnchorRefs.current[focusSection]
      if (!target) return
      target.scrollIntoView({ behavior: "smooth", block: "center" })
      target
        .querySelector<HTMLElement>("input, select, textarea, button")
        ?.focus({ preventScroll: true })
    }, 550)
    return () => clearTimeout(timeout)
  }, [open, focusSection])
  const section =
    state.sections.find((candidate) => candidate.id === selectedSectionId) ??
    state.sections[0]

  if (!section) return null

  const updateSection = (next: DocumentSection) => {
    const sections = state.sections.map((candidate) =>
      candidate.id === next.id ? next : candidate
    )
    onChange({
      ...state,
      sections,
      layout: sections[0]?.layout ?? state.layout,
    })
  }

  const updateMargins = (
    key: keyof DocumentSection["layout"]["margins"],
    value: number
  ) => {
    const margins = { ...section.layout.margins, [key]: value }
    updateSection({
      ...section,
      layout: {
        ...section.layout,
        margin:
          margins.top === margins.right &&
          margins.top === margins.bottom &&
          margins.top === margins.left
            ? margins.top
            : section.layout.margin,
        margins,
      },
    })
  }

  const updatePageAppearance = (
    patch: Partial<DocumentWorkspaceState["pageAppearance"]>
  ) => {
    onChange({
      ...state,
      pageAppearance: { ...state.pageAppearance, ...patch },
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutPanelTop className="h-5 w-5" />
            Diseño, secciones y páginas
          </SheetTitle>
          <SheetDescription>
            Configura cada sección como en Word. Los cambios se guardan en el DOCX.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="-mx-6 mt-4 flex-1 px-6">
          <div className="space-y-6 pb-8">
            <section className="space-y-3">
              <Label htmlFor="section-picker">Sección activa</Label>
              <select
                id="section-picker"
                value={section.id}
                onChange={(event) => setSelectedSectionId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {state.sections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <Input
                value={section.name}
                onChange={(event) =>
                  updateSection({ ...section, name: event.target.value })
                }
                aria-label="Nombre de la sección"
                className="h-9"
              />
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <GraduationCap className="h-4 w-4" />
                Estructura académica
              </h3>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">Preliminares + cuerpo</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Coloca el cursor donde empieza el cuerpo. La sección actual
                  usará i, ii, iii y se creará el cuerpo desde la página 1.
                </p>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  onClick={onCreateThesisStructure}
                >
                  <GraduationCap />
                  Crear estructura de tesis
                </Button>
              </div>
            </section>

            <Separator />

            <section
              className="space-y-3"
              ref={(node) => {
                sectionAnchorRefs.current.page = node
              }}
            >
              <h3 className="text-sm font-semibold">Página</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Tamaño</span>
                  <select
                    value={section.layout.pageSize}
                    onChange={(event) =>
                      updateSection({
                        ...section,
                        layout: {
                          ...section.layout,
                          pageSize: event.target.value as "a4" | "letter",
                        },
                      })
                    }
                    className="h-8 w-full rounded border border-input bg-background px-2"
                  >
                    <option value="a4">A4</option>
                    <option value="letter">Carta</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Orientación</span>
                  <select
                    value={section.layout.orientation}
                    onChange={(event) =>
                      updateSection({
                        ...section,
                        layout: {
                          ...section.layout,
                          orientation: event.target.value as
                            | "portrait"
                            | "landscape",
                        },
                      })
                    }
                    className="h-8 w-full rounded border border-input bg-background px-2"
                  >
                    <option value="portrait">Vertical</option>
                    <option value="landscape">Horizontal</option>
                  </select>
                </label>
              </div>
              <div
                className="space-y-3 rounded-lg border bg-muted/30 p-3"
                ref={(node) => {
                  sectionAnchorRefs.current.borders = node
                }}
              >
                <div>
                  <p className="text-sm font-medium">Fondo y borde de página</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    La apariencia se aplica a todo el documento y se conserva al
                    exportar a DOCX, PDF y ODT cuando el formato lo admite.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs">
                    <span className="text-muted-foreground">
                      Color de página
                    </span>
                    <Input
                      type="color"
                      value={state.pageAppearance.color}
                      onChange={(event) =>
                        updatePageAppearance({ color: event.target.value })
                      }
                      className="h-8 w-full p-1"
                      aria-label="Color de página"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-muted-foreground">Tipo de borde</span>
                    <select
                      value={state.pageAppearance.borderStyle}
                      onChange={(event) =>
                        updatePageAppearance({
                          borderStyle: event.target.value as PageBorderStyle,
                        })
                      }
                      className="h-8 w-full rounded border border-input bg-background px-2"
                      aria-label="Tipo de borde de página"
                    >
                      <option value="none">Sin borde</option>
                      <option value="solid">Línea</option>
                      <option value="double">Doble</option>
                      <option value="dashed">Discontinua</option>
                    </select>
                  </label>
                </div>
                {state.pageAppearance.borderStyle !== "none" && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-xs">
                      <span className="text-muted-foreground">
                        Color del borde
                      </span>
                      <Input
                        type="color"
                        value={state.pageAppearance.borderColor}
                        onChange={(event) =>
                          updatePageAppearance({
                            borderColor: event.target.value,
                          })
                        }
                        className="h-8 w-full p-1"
                        aria-label="Color del borde de página"
                      />
                    </label>
                    <NumberField
                      label="Grosor (px)"
                      value={state.pageAppearance.borderWidth}
                      min={0.5}
                      max={8}
                      onChange={(borderWidth) =>
                        updatePageAppearance({ borderWidth })
                      }
                    />
                  </div>
                )}
              </div>
              <div
                className="space-y-3 rounded-lg border bg-muted/30 p-3"
                ref={(node) => {
                  sectionAnchorRefs.current.watermark = node
                }}
              >
                <div>
                  <p className="text-sm font-medium">Marca de agua</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Déjala vacía para desactivarla. PDF conserva texto, color,
                    transparencia y ángulo.
                  </p>
                </div>
                <Input
                  value={state.pageAppearance.watermarkText}
                  onChange={(event) =>
                    updatePageAppearance({
                      watermarkText: event.target.value.slice(0, 120),
                    })
                  }
                  maxLength={120}
                  placeholder="Ej.: BORRADOR o CONFIDENCIAL"
                  aria-label="Texto de la marca de agua"
                  className="h-8"
                />
                {state.pageAppearance.watermarkText && (
                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1 text-xs">
                      <span className="text-muted-foreground">Color</span>
                      <Input
                        type="color"
                        value={state.pageAppearance.watermarkColor}
                        onChange={(event) =>
                          updatePageAppearance({
                            watermarkColor: event.target.value,
                          })
                        }
                        className="h-8 w-full p-1"
                        aria-label="Color de la marca de agua"
                      />
                    </label>
                    <NumberField
                      label="Opacidad (%)"
                      value={Math.round(
                        state.pageAppearance.watermarkOpacity * 100
                      )}
                      min={4}
                      max={80}
                      onChange={(opacity) =>
                        updatePageAppearance({
                          watermarkOpacity: opacity / 100,
                        })
                      }
                    />
                    <NumberField
                      label="Ángulo"
                      value={state.pageAppearance.watermarkAngle}
                      min={-180}
                      max={180}
                      onChange={(watermarkAngle) =>
                        updatePageAppearance({ watermarkAngle })
                      }
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Guiones automáticos</p>
                  <p className="text-xs text-muted-foreground">
                    Divide palabras al justificar texto, según el idioma.
                  </p>
                </div>
                <Switch
                  checked={state.pageAppearance.hyphenation}
                  onCheckedChange={(hyphenation) =>
                    updatePageAppearance({ hyphenation })
                  }
                  aria-label="Activar guiones automáticos"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <NumberField
                  label="Superior"
                  value={section.layout.margins.top}
                  onChange={(value) => updateMargins("top", value)}
                />
                <NumberField
                  label="Derecho"
                  value={section.layout.margins.right}
                  onChange={(value) => updateMargins("right", value)}
                />
                <NumberField
                  label="Inferior"
                  value={section.layout.margins.bottom}
                  onChange={(value) => updateMargins("bottom", value)}
                />
                <NumberField
                  label="Izquierdo"
                  value={section.layout.margins.left}
                  onChange={(value) => updateMargins("left", value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="Distancia encabezado"
                  value={section.layout.margins.header}
                  onChange={(value) => updateMargins("header", value)}
                />
                <NumberField
                  label="Distancia pie"
                  value={section.layout.margins.footer}
                  onChange={(value) => updateMargins("footer", value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Columnas</span>
                  <select
                    value={section.layout.columns}
                    onChange={(event) =>
                      updateSection({
                        ...section,
                        layout: {
                          ...section.layout,
                          columns: Number(event.target.value) as 1 | 2 | 3,
                        },
                      })
                    }
                    className="h-8 w-full rounded border border-input bg-background px-2"
                  >
                    <option value={1}>Una</option>
                    <option value={2}>Dos</option>
                    <option value={3}>Tres</option>
                  </select>
                </label>
                <NumberField
                  label="Separación"
                  value={section.layout.columnGap}
                  onChange={(value) =>
                    updateSection({
                      ...section,
                      layout: { ...section.layout, columnGap: value },
                    })
                  }
                />
              </div>
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">Numeración de líneas</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Útil para revisión académica y jurídica. Se aplica solo a
                    esta sección y Word calcula las líneas exactas.
                  </p>
                </div>
                <select
                  value={section.layout.lineNumbers.mode}
                  onChange={(event) =>
                    updateSection({
                      ...section,
                      layout: {
                        ...section.layout,
                        lineNumbers: {
                          ...section.layout.lineNumbers,
                          mode: event.target.value as LineNumberRestartMode,
                        },
                      },
                    })
                  }
                  className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                  aria-label="Modo de numeración de líneas"
                >
                  <option value="none">Sin números de línea</option>
                  <option value="continuous">Continuos</option>
                  <option value="newPage">Reiniciar en cada página</option>
                  <option value="newSection">Reiniciar en cada sección</option>
                </select>
                {section.layout.lineNumbers.mode !== "none" && (
                  <div className="grid grid-cols-3 gap-2">
                    <NumberField
                      label="Iniciar en"
                      value={section.layout.lineNumbers.start}
                      min={1}
                      max={9999}
                      onChange={(start) =>
                        updateSection({
                          ...section,
                          layout: {
                            ...section.layout,
                            lineNumbers: {
                              ...section.layout.lineNumbers,
                              start,
                            },
                          },
                        })
                      }
                    />
                    <NumberField
                      label="Contar cada"
                      value={section.layout.lineNumbers.countBy}
                      min={1}
                      max={100}
                      onChange={(countBy) =>
                        updateSection({
                          ...section,
                          layout: {
                            ...section.layout,
                            lineNumbers: {
                              ...section.layout.lineNumbers,
                              countBy,
                            },
                          },
                        })
                      }
                    />
                    <NumberField
                      label="Distancia"
                      value={section.layout.lineNumbers.distance}
                      min={0}
                      max={240}
                      onChange={(distance) =>
                        updateSection({
                          ...section,
                          layout: {
                            ...section.layout,
                            lineNumbers: {
                              ...section.layout.lineNumbers,
                              distance,
                            },
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </section>

            <Separator />

            <section
              className="space-y-3"
              ref={(node) => {
                sectionAnchorRefs.current.headerFooter = node
              }}
            >
              <h3 className="text-sm font-semibold">Encabezados y pies</h3>
              <div className="space-y-2">
                <Label htmlFor="header-default">Encabezado</Label>
                <Textarea
                  id="header-default"
                  value={section.header.default}
                  onChange={(event) =>
                    updateSection({
                      ...section,
                      header: { ...section.header, default: event.target.value },
                    })
                  }
                  className="min-h-16"
                  placeholder="Texto del encabezado"
                />
                <Label htmlFor="footer-default">Pie de página</Label>
                <Textarea
                  id="footer-default"
                  value={section.footer.default}
                  onChange={(event) =>
                    updateSection({
                      ...section,
                      footer: { ...section.footer, default: event.target.value },
                    })
                  }
                  className="min-h-16"
                  placeholder="Texto del pie"
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Primera página diferente</p>
                  <p className="text-xs text-muted-foreground">
                    Portadas sin el encabezado general.
                  </p>
                </div>
                <Switch
                  checked={section.differentFirstPage}
                  onCheckedChange={(checked) =>
                    updateSection({ ...section, differentFirstPage: checked })
                  }
                />
              </div>
              {section.differentFirstPage && (
                <div className="grid grid-cols-2 gap-2">
                  <Textarea
                    value={section.header.first}
                    onChange={(event) =>
                      updateSection({
                        ...section,
                        header: { ...section.header, first: event.target.value },
                      })
                    }
                    placeholder="Encabezado primera página"
                  />
                  <Textarea
                    value={section.footer.first}
                    onChange={(event) =>
                      updateSection({
                        ...section,
                        footer: { ...section.footer, first: event.target.value },
                      })
                    }
                    placeholder="Pie primera página"
                  />
                </div>
              )}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Pares e impares diferentes</p>
                  <p className="text-xs text-muted-foreground">
                    Útil para impresión a doble cara.
                  </p>
                </div>
                <Switch
                  checked={section.differentOddEven}
                  onCheckedChange={(checked) =>
                    updateSection({ ...section, differentOddEven: checked })
                  }
                />
              </div>
              {section.differentOddEven && (
                <div className="grid grid-cols-2 gap-2">
                  <Textarea
                    value={section.header.even}
                    onChange={(event) =>
                      updateSection({
                        ...section,
                        header: { ...section.header, even: event.target.value },
                      })
                    }
                    placeholder="Encabezado páginas pares"
                  />
                  <Textarea
                    value={section.footer.even}
                    onChange={(event) =>
                      updateSection({
                        ...section,
                        footer: { ...section.footer, even: event.target.value },
                      })
                    }
                    placeholder="Pie páginas pares"
                  />
                </div>
              )}
              <label
                className="space-y-1 text-xs"
                ref={(node) => {
                  sectionAnchorRefs.current.pageNumber = node
                }}
              >
                <span className="text-muted-foreground">Número de página</span>
                <select
                  value={section.pageNumberPosition}
                  onChange={(event) =>
                    updateSection({
                      ...section,
                      pageNumberPosition: event.target
                        .value as PageNumberPosition,
                    })
                  }
                  className="h-8 w-full rounded border border-input bg-background px-2"
                >
                  <option value="none">Sin numeración</option>
                  <option value="header-left">Encabezado izquierda</option>
                  <option value="header-center">Encabezado centro</option>
                  <option value="header-right">Encabezado derecha</option>
                  <option value="footer-left">Pie izquierda</option>
                  <option value="footer-center">Pie centro</option>
                  <option value="footer-right">Pie derecha</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Formato</span>
                  <select
                    value={section.pageNumberFormat}
                    onChange={(event) =>
                      updateSection({
                        ...section,
                        pageNumberFormat: event.target
                          .value as PageNumberFormat,
                      })
                    }
                    className="h-8 w-full rounded border border-input bg-background px-2"
                  >
                    <option value="decimal">1, 2, 3</option>
                    <option value="lowerRoman">i, ii, iii</option>
                    <option value="upperRoman">I, II, III</option>
                    <option value="lowerLetter">a, b, c</option>
                    <option value="upperLetter">A, B, C</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Iniciar en</span>
                  <Input
                    type="number"
                    min={1}
                    max={9999}
                    value={section.pageNumberStart ?? ""}
                    placeholder="Continuar"
                    onChange={(event) =>
                      updateSection({
                        ...section,
                        pageNumberStart: event.target.value
                          ? Math.max(1, Number(event.target.value))
                          : undefined,
                      })
                    }
                    className="h-8"
                  />
                </label>
              </div>
              {section.pageNumberStart !== undefined && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    updateSection({ ...section, pageNumberStart: undefined })
                  }
                >
                  Continuar desde la sección anterior
                </Button>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <FilePlus2 className="h-4 w-4" />
                Crear nueva sección
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => onInsertSectionBreak("nextPage")}
                >
                  <Pilcrow />
                  Página siguiente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onInsertSectionBreak("continuous")}
                >
                  <Columns3 />
                  Continua
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onInsertSectionBreak("evenPage")}
                >
                  Página par
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onInsertSectionBreak("oddPage")}
                >
                  Página impar
                </Button>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
