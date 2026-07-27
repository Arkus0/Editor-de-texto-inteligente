export type TextBoxPresetId = "plain" | "highlight" | "quote" | "warning"
export type TextBoxPosition = "inline" | "float-left" | "float-right"
export type TextBoxAlign = "left" | "center" | "right"
export type TextBoxBorderStyle = "none" | "solid" | "dashed" | "double"

export const TEXT_BOX_PRESETS = [
  {
    id: "plain",
    label: "Simple",
    background: "#ffffff",
    borderColor: "#94a3b8",
    borderStyle: "solid",
  },
  {
    id: "highlight",
    label: "Destacado",
    background: "#eff6ff",
    borderColor: "#2563eb",
    borderStyle: "solid",
  },
  {
    id: "quote",
    label: "Cita",
    background: "#f8fafc",
    borderColor: "#475569",
    borderStyle: "double",
  },
  {
    id: "warning",
    label: "Aviso",
    background: "#fff7ed",
    borderColor: "#ea580c",
    borderStyle: "dashed",
  },
] as const satisfies ReadonlyArray<{
  id: TextBoxPresetId
  label: string
  background: string
  borderColor: string
  borderStyle: TextBoxBorderStyle
}>

export function getTextBoxPreset(id: TextBoxPresetId) {
  return (
    TEXT_BOX_PRESETS.find((preset) => preset.id === id) ??
    TEXT_BOX_PRESETS[0]
  )
}
