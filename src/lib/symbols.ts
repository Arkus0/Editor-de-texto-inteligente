export interface EditorSymbol {
  value: string
  name: string
  category: "matemáticas" | "griego" | "flechas" | "monedas" | "texto"
}

export const EDITOR_SYMBOLS: EditorSymbol[] = [
  { value: "±", name: "más menos", category: "matemáticas" },
  { value: "×", name: "multiplicación", category: "matemáticas" },
  { value: "÷", name: "división", category: "matemáticas" },
  { value: "≈", name: "aproximadamente", category: "matemáticas" },
  { value: "≠", name: "distinto", category: "matemáticas" },
  { value: "≤", name: "menor o igual", category: "matemáticas" },
  { value: "≥", name: "mayor o igual", category: "matemáticas" },
  { value: "∞", name: "infinito", category: "matemáticas" },
  { value: "√", name: "raíz", category: "matemáticas" },
  { value: "∑", name: "sumatorio", category: "matemáticas" },
  { value: "∏", name: "productorio", category: "matemáticas" },
  { value: "∫", name: "integral", category: "matemáticas" },
  { value: "∂", name: "derivada parcial", category: "matemáticas" },
  { value: "∆", name: "incremento delta", category: "matemáticas" },
  { value: "∇", name: "nabla", category: "matemáticas" },
  { value: "∈", name: "pertenece", category: "matemáticas" },
  { value: "∉", name: "no pertenece", category: "matemáticas" },
  { value: "⊂", name: "subconjunto", category: "matemáticas" },
  { value: "⊆", name: "subconjunto o igual", category: "matemáticas" },
  { value: "∪", name: "unión", category: "matemáticas" },
  { value: "∩", name: "intersección", category: "matemáticas" },
  { value: "∀", name: "para todo", category: "matemáticas" },
  { value: "∃", name: "existe", category: "matemáticas" },
  { value: "¬", name: "negación", category: "matemáticas" },
  { value: "∧", name: "conjunción", category: "matemáticas" },
  { value: "∨", name: "disyunción", category: "matemáticas" },
  { value: "α", name: "alfa minúscula", category: "griego" },
  { value: "β", name: "beta minúscula", category: "griego" },
  { value: "γ", name: "gamma minúscula", category: "griego" },
  { value: "δ", name: "delta minúscula", category: "griego" },
  { value: "ε", name: "épsilon minúscula", category: "griego" },
  { value: "θ", name: "theta minúscula", category: "griego" },
  { value: "λ", name: "lambda minúscula", category: "griego" },
  { value: "μ", name: "mu minúscula", category: "griego" },
  { value: "π", name: "pi minúscula", category: "griego" },
  { value: "ρ", name: "rho minúscula", category: "griego" },
  { value: "σ", name: "sigma minúscula", category: "griego" },
  { value: "τ", name: "tau minúscula", category: "griego" },
  { value: "φ", name: "phi minúscula", category: "griego" },
  { value: "χ", name: "chi minúscula", category: "griego" },
  { value: "ψ", name: "psi minúscula", category: "griego" },
  { value: "ω", name: "omega minúscula", category: "griego" },
  { value: "Γ", name: "gamma mayúscula", category: "griego" },
  { value: "Δ", name: "delta mayúscula", category: "griego" },
  { value: "Θ", name: "theta mayúscula", category: "griego" },
  { value: "Λ", name: "lambda mayúscula", category: "griego" },
  { value: "Π", name: "pi mayúscula", category: "griego" },
  { value: "Σ", name: "sigma mayúscula", category: "griego" },
  { value: "Φ", name: "phi mayúscula", category: "griego" },
  { value: "Ψ", name: "psi mayúscula", category: "griego" },
  { value: "Ω", name: "omega mayúscula", category: "griego" },
  { value: "←", name: "flecha izquierda", category: "flechas" },
  { value: "→", name: "flecha derecha", category: "flechas" },
  { value: "↑", name: "flecha arriba", category: "flechas" },
  { value: "↓", name: "flecha abajo", category: "flechas" },
  { value: "↔", name: "flecha doble horizontal", category: "flechas" },
  { value: "⇒", name: "implica", category: "flechas" },
  { value: "⇔", name: "equivalencia", category: "flechas" },
  { value: "↗", name: "flecha noreste", category: "flechas" },
  { value: "↘", name: "flecha sureste", category: "flechas" },
  { value: "€", name: "euro", category: "monedas" },
  { value: "$", name: "dólar", category: "monedas" },
  { value: "£", name: "libra esterlina", category: "monedas" },
  { value: "¥", name: "yen yuan", category: "monedas" },
  { value: "₿", name: "bitcoin", category: "monedas" },
  { value: "¢", name: "centavo", category: "monedas" },
  { value: "©", name: "copyright", category: "texto" },
  { value: "®", name: "marca registrada", category: "texto" },
  { value: "™", name: "marca comercial", category: "texto" },
  { value: "§", name: "sección", category: "texto" },
  { value: "¶", name: "párrafo calderón", category: "texto" },
  { value: "†", name: "daga", category: "texto" },
  { value: "‡", name: "doble daga", category: "texto" },
  { value: "•", name: "viñeta", category: "texto" },
  { value: "·", name: "punto medio", category: "texto" },
  { value: "…", name: "puntos suspensivos", category: "texto" },
  { value: "—", name: "raya", category: "texto" },
  { value: "–", name: "semirraya", category: "texto" },
  { value: "«", name: "comilla angular izquierda", category: "texto" },
  { value: "»", name: "comilla angular derecha", category: "texto" },
  { value: "“", name: "comilla doble izquierda", category: "texto" },
  { value: "”", name: "comilla doble derecha", category: "texto" },
  { value: "′", name: "prima", category: "texto" },
  { value: "″", name: "doble prima", category: "texto" },
  { value: "°", name: "grado", category: "texto" },
  { value: "№", name: "número", category: "texto" },
  { value: "✓", name: "marca de verificación", category: "texto" },
  { value: "✗", name: "marca de error", category: "texto" },
  { value: "★", name: "estrella", category: "texto" },
]

const SYMBOL_VALUES = new Set(EDITOR_SYMBOLS.map((symbol) => symbol.value))

export function isEditorSymbol(value: unknown): value is string {
  return typeof value === "string" && SYMBOL_VALUES.has(value)
}

export function searchEditorSymbols(query: string, category = "todos") {
  const normalized = query.trim().toLocaleLowerCase("es")
  return EDITOR_SYMBOLS.filter(
    (symbol) =>
      (category === "todos" || symbol.category === category) &&
      (!normalized ||
        symbol.value === normalized ||
        symbol.name.toLocaleLowerCase("es").includes(normalized))
  )
}
