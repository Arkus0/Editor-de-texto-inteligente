import type { DocumentStyleDefinition } from "@/types/document"

export type DocumentStyleThemeId =
  | "word"
  | "modern"
  | "editorial"
  | "corporate"
  | "accessible"

export interface DocumentStyleTheme {
  id: DocumentStyleThemeId
  name: string
  description: string
  accent: string
  headingFont: string
  bodyFont: string
}

export const DOCUMENT_STYLE_THEMES: DocumentStyleTheme[] = [
  {
    id: "word",
    name: "Office",
    description: "Familiar y compatible",
    accent: "#2f5496",
    headingFont: "Aptos Display",
    bodyFont: "Aptos",
  },
  {
    id: "modern",
    name: "Moderno",
    description: "Limpio y contemporáneo",
    accent: "#0f6cbd",
    headingFont: "Arial",
    bodyFont: "Arial",
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Lectura larga y cuidada",
    accent: "#9f1239",
    headingFont: "Georgia",
    bodyFont: "Georgia",
  },
  {
    id: "corporate",
    name: "Corporativo",
    description: "Informes y propuestas",
    accent: "#0f766e",
    headingFont: "Arial",
    bodyFont: "Calibri",
  },
  {
    id: "accessible",
    name: "Accesible",
    description: "Más grande y legible",
    accent: "#111827",
    headingFont: "Arial",
    bodyFont: "Arial",
  },
]

const THEME_PATCHES: Record<
  DocumentStyleThemeId,
  Record<string, Partial<DocumentStyleDefinition>>
> = {
  word: {
    Normal: { fontFamily: "Aptos", fontSize: 11, lineHeight: 1.15, color: "202020" },
    NoSpacing: { fontFamily: "Aptos", fontSize: 11, lineHeight: 1, color: "202020" },
    Title: { fontFamily: "Aptos Display", fontSize: 28, color: "2F5496" },
    Subtitle: { fontFamily: "Aptos", fontSize: 14, color: "666666" },
    Heading1: { fontFamily: "Aptos Display", fontSize: 18, color: "2F5496" },
    Heading2: { fontFamily: "Aptos Display", fontSize: 15, color: "2F5496" },
    Heading3: { fontFamily: "Aptos", fontSize: 13, color: "1F3763" },
  },
  modern: {
    Normal: { fontFamily: "Arial", fontSize: 11, lineHeight: 1.2, color: "172033" },
    NoSpacing: { fontFamily: "Arial", fontSize: 11, lineHeight: 1, color: "172033" },
    Title: { fontFamily: "Arial", fontSize: 30, color: "0F6CBD" },
    Subtitle: { fontFamily: "Arial", fontSize: 14, color: "475569" },
    Heading1: { fontFamily: "Arial", fontSize: 19, color: "0F6CBD" },
    Heading2: { fontFamily: "Arial", fontSize: 15, color: "155E9A" },
    Heading3: { fontFamily: "Arial", fontSize: 13, color: "334155" },
  },
  editorial: {
    Normal: { fontFamily: "Georgia", fontSize: 11, lineHeight: 1.45, color: "27221F" },
    NoSpacing: { fontFamily: "Georgia", fontSize: 11, lineHeight: 1.1, color: "27221F" },
    Title: { fontFamily: "Georgia", fontSize: 30, color: "9F1239" },
    Subtitle: { fontFamily: "Georgia", fontSize: 14, color: "6B4F57" },
    Heading1: { fontFamily: "Georgia", fontSize: 19, color: "9F1239" },
    Heading2: { fontFamily: "Georgia", fontSize: 15, color: "881337" },
    Heading3: { fontFamily: "Georgia", fontSize: 13, color: "4C1D2E" },
  },
  corporate: {
    Normal: { fontFamily: "Calibri", fontSize: 11, lineHeight: 1.2, color: "1F2937" },
    NoSpacing: { fontFamily: "Calibri", fontSize: 11, lineHeight: 1, color: "1F2937" },
    Title: { fontFamily: "Arial", fontSize: 28, color: "0F766E" },
    Subtitle: { fontFamily: "Calibri", fontSize: 14, color: "4B6462" },
    Heading1: { fontFamily: "Arial", fontSize: 18, color: "0F766E" },
    Heading2: { fontFamily: "Arial", fontSize: 15, color: "115E59" },
    Heading3: { fontFamily: "Calibri", fontSize: 13, color: "134E4A" },
  },
  accessible: {
    Normal: { fontFamily: "Arial", fontSize: 12, lineHeight: 1.5, color: "111827" },
    NoSpacing: { fontFamily: "Arial", fontSize: 12, lineHeight: 1.2, color: "111827" },
    Title: { fontFamily: "Arial", fontSize: 30, color: "111827" },
    Subtitle: { fontFamily: "Arial", fontSize: 15, color: "374151" },
    Heading1: { fontFamily: "Arial", fontSize: 20, color: "111827" },
    Heading2: { fontFamily: "Arial", fontSize: 17, color: "1F2937" },
    Heading3: { fontFamily: "Arial", fontSize: 14, color: "1F2937" },
  },
}

export function applyDocumentStyleTheme(
  styles: DocumentStyleDefinition[],
  themeId: DocumentStyleThemeId
) {
  const patches = THEME_PATCHES[themeId]
  return styles.map((style) => ({
    ...style,
    ...(patches[style.id] ?? {}),
  }))
}
