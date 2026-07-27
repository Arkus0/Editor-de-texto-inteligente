import type {
  WritingAssistantSettings,
  WritingRuleId,
} from "@/types/document"

export interface WritingTextSegment {
  text: string
  position: number
  language?: string
}

export interface LocalWritingIssue {
  id: string
  fingerprint: string
  ruleId: WritingRuleId
  severity: "correction" | "suggestion"
  from: number
  to: number
  message: string
  explanation: string
  excerpt: string
  originalText: string
  replacement?: string
}

export const WRITING_RULE_LABELS: Record<WritingRuleId, string> = {
  "repeated-word": "Palabras repetidas",
  "multiple-spaces": "Espacios duplicados",
  "space-before-punctuation": "Espacio antes de puntuación",
  "long-sentence": "Frases extensas",
}

function fingerprint(ruleId: WritingRuleId, excerpt: string) {
  return `${ruleId}:${excerpt
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180)}`
}

function createIssue(
  segment: WritingTextSegment,
  ruleId: WritingRuleId,
  matchIndex: number,
  matchedText: string,
  details: Omit<
    LocalWritingIssue,
    | "id"
    | "fingerprint"
    | "ruleId"
    | "from"
    | "to"
    | "excerpt"
    | "originalText"
  >
): LocalWritingIssue {
  const issueFingerprint = fingerprint(ruleId, matchedText)
  return {
    ...details,
    id: `${segment.position}-${matchIndex}-${issueFingerprint}`,
    fingerprint: issueFingerprint,
    ruleId,
    from: segment.position + matchIndex,
    to: segment.position + matchIndex + matchedText.length,
    excerpt: matchedText.trim(),
    originalText: matchedText,
  }
}

export function analyzeWritingSegments(
  segments: WritingTextSegment[],
  settings: Pick<WritingAssistantSettings, "longSentenceThreshold">,
  defaultLanguage: string
) {
  const issues: LocalWritingIssue[] = []
  for (const segment of segments) {
    const language = segment.language || defaultLanguage
    for (const match of segment.text.matchAll(/\b([\p{L}]{2,})\s+\1\b/giu)) {
      if (match.index === undefined) continue
      issues.push(
        createIssue(
          segment,
          "repeated-word",
          match.index,
          match[0],
          {
            severity: "correction",
            message: "Palabra repetida",
            explanation:
              "Corrección mecánica: la misma palabra aparece dos veces seguidas.",
            replacement: match[1],
          }
        )
      )
    }
    for (const match of segment.text.matchAll(/ {2,}/g)) {
      if (match.index === undefined) continue
      issues.push(
        createIssue(
          segment,
          "multiple-spaces",
          match.index,
          match[0],
          {
            severity: "correction",
            message: "Espacios consecutivos",
            explanation:
              "Corrección mecánica: un espacio basta entre dos elementos.",
            replacement: " ",
          }
        )
      )
    }
    const punctuationExpression = language.toLowerCase().startsWith("fr")
      ? /\s+([,.])/g
      : /\s+([,.;:!?])/g
    for (const match of segment.text.matchAll(punctuationExpression)) {
      if (match.index === undefined) continue
      issues.push(
        createIssue(
          segment,
          "space-before-punctuation",
          match.index,
          match[0],
          {
            severity: "correction",
            message: "Espacio antes de puntuación",
            explanation: language.toLowerCase().startsWith("fr")
              ? "Se corrige solo ante coma o punto; la puntuación francesa puede requerir espacio en otros signos."
              : "Corrección mecánica según el idioma asignado a este fragmento.",
            replacement: match[1],
          }
        )
      )
    }
    if (settings.longSentenceThreshold !== null) {
      for (const sentence of segment.text.matchAll(/[^.!?]+[.!?]?/g)) {
        if (sentence.index === undefined) continue
        const wordCount = sentence[0].trim().split(/\s+/).filter(Boolean).length
        if (wordCount <= settings.longSentenceThreshold) continue
        issues.push(
          createIssue(
            segment,
            "long-sentence",
            sentence.index,
            sentence[0],
            {
              severity: "suggestion",
              message: `Frase extensa (${wordCount} palabras)`,
              explanation:
                "Sugerencia de legibilidad, no error gramatical. En prosa académica puede ser deliberada y puedes ignorarla.",
            }
          )
        )
      }
    }
  }
  return issues
}
