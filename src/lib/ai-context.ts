export interface AiContextOptions {
  includeDocument: boolean
  includeEditorState: boolean
  includeAttachments: boolean
  includeHistory: boolean
}

export interface AiContextPreview {
  documentCharacters: number
  selectionCharacters: number
  editorStateCharacters: number
  attachmentCount: number
  attachmentCharacters: number
  historyTurns: number
}

export const DEFAULT_AI_CONTEXT_OPTIONS: AiContextOptions = {
  includeDocument: true,
  includeEditorState: true,
  includeAttachments: true,
  includeHistory: true,
}

export function estimateIncludedContextCharacters(
  preview: AiContextPreview,
  options: AiContextOptions
) {
  return (
    preview.selectionCharacters +
    (options.includeDocument ? preview.documentCharacters : 0) +
    (options.includeEditorState ? preview.editorStateCharacters : 0) +
    (options.includeAttachments ? preview.attachmentCharacters : 0)
  )
}
