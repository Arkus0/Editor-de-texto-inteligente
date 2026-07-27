import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const ROOT = process.cwd()
const EXPORT_DIR = path.join(ROOT, "renderer-build")
const CHUNKS_DIR = path.join(EXPORT_DIR, "_next", "static", "chunks")
const LOADABLE_MANIFEST = path.join(
  ROOT,
  ".next",
  "server",
  "app",
  "page",
  "react-loadable-manifest.json"
)

/**
 * «Arranque» es todo el JavaScript que hay que descargar y compilar antes de
 * que el editor sea utilizable: lo que enlaza `index.html` más el grupo de
 * fragmentos de `AppShell`, que la página carga de inmediato. Los paneles y
 * herramientas que se importan bajo demanda no cuentan aquí.
 */
/**
 * Los límites son un trinquete: se ponen justo por encima de lo medido para que
 * cualquier crecimiento no buscado salte, y solo se suben a conciencia cuando
 * una función nueva lo justifica.
 *
 * Última subida: los campos de formulario, la búsqueda y los gráficos añadieron
 * unos 25 KiB de arranque. El dibujo del gráfico se carga bajo demanda, pero la
 * definición de sus nodos no puede: el esquema de ProseMirror se fija al crear
 * el editor. Si el arranque sigue creciendo, lo siguiente que hay que mirar son
 * `marked` y `turndown` (~70 KiB), que hoy siguen ahí porque volverlos
 * asíncronos toca 17 puntos de `AppShell`.
 */
const BUDGETS = {
  bootJavaScript: 2_050 * 1024,
  bootCss: 145 * 1024,
  largestBootChunk: 500 * 1024,
  allJavaScriptAndCss: 6_500 * 1024,
}

/**
 * Bibliotecas que no deben volver al arranque. Cada una salió de ahí por un
 * motivo concreto y con una medición detrás; una importación estática nueva
 * las devolvería sin que nadie se diera cuenta, porque el presupuesto global
 * tiene holgura suficiente para absorberlas de una en una.
 *
 * La marca es una cadena que solo aparece si la biblioteca viaja de verdad en
 * el fragmento, no si únicamente se menciona su nombre o su ruta.
 */
const FORBIDDEN_IN_BOOT = [
  {
    name: "KaTeX",
    marker: "delimsizing",
    reason:
      "solo hace falta al pintar una ecuación; se carga desde EquationNode",
  },
  {
    name: "react-markdown",
    marker: "micromark",
    reason:
      "solo hace falta para leer una respuesta de la IA; se carga desde MarkdownView",
  },
]

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

async function sizeOfExportAsset(relativeFile) {
  const filePath = path.join(EXPORT_DIR, "_next", relativeFile)
  return (await stat(filePath)).size
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      return entry.isDirectory() ? walkFiles(entryPath) : [entryPath]
    })
  )
  return nested.flat()
}

const html = await readFile(path.join(EXPORT_DIR, "index.html"), "utf8")
const htmlAssets = [
  ...html.matchAll(
    /\/_next\/(static\/chunks\/[^"\\]+\.(?:js|css))/g
  ),
].map((match) => match[1])

const manifest = JSON.parse(await readFile(LOADABLE_MANIFEST, "utf8"))
const appShellAssets = Object.values(manifest).flatMap(
  (entry) => entry.files ?? []
)
const bootAssets = [...new Set([...htmlAssets, ...appShellAssets])]
const bootAssetSizes = await Promise.all(
  bootAssets.map(async (file) => ({
    file,
    bytes: await sizeOfExportAsset(file),
  }))
)

const sumByExtension = (extension) =>
  bootAssetSizes
    .filter(({ file }) => file.endsWith(extension))
    .reduce((total, { bytes }) => total + bytes, 0)

const allChunkFiles = await walkFiles(CHUNKS_DIR)
const allJavaScriptAndCss = (
  await Promise.all(
    allChunkFiles
      .filter((file) => /\.(?:js|css)$/.test(file))
      .map(async (file) => (await stat(file)).size)
  )
).reduce((total, bytes) => total + bytes, 0)

const metrics = {
  bootJavaScript: sumByExtension(".js"),
  bootCss: sumByExtension(".css"),
  largestBootChunk: Math.max(...bootAssetSizes.map(({ bytes }) => bytes)),
  allJavaScriptAndCss,
}

const labels = {
  bootJavaScript: "JavaScript de arranque",
  bootCss: "CSS de arranque",
  largestBootChunk: "Mayor fragmento de arranque",
  allJavaScriptAndCss: "JS + CSS total",
}

let failed = false
for (const [metric, measured] of Object.entries(metrics)) {
  const budget = BUDGETS[metric]
  const passed = measured <= budget
  failed ||= !passed
  console.log(
    `${passed ? "✓" : "✗"} ${labels[metric]}: ${formatKiB(measured)} / ${formatKiB(budget)}`
  )
}

const bootJavaScriptFiles = bootAssets.filter((file) => file.endsWith(".js"))
const bootSources = await Promise.all(
  bootJavaScriptFiles.map(async (file) => ({
    file,
    source: await readFile(path.join(EXPORT_DIR, "_next", file), "utf8"),
  }))
)

console.log("")
for (const { name, marker, reason } of FORBIDDEN_IN_BOOT) {
  const offender = bootSources.find(({ source }) => source.includes(marker))
  if (offender) {
    failed = true
    console.log(
      `✗ ${name} ha vuelto al arranque (${offender.file}): ${reason}`
    )
  } else {
    console.log(`✓ ${name} sigue fuera del arranque`)
  }
}

const largest = [...bootAssetSizes]
  .sort((left, right) => right.bytes - left.bytes)
  .slice(0, 5)
console.log("\nMayores fragmentos de arranque:")
for (const { file, bytes } of largest) {
  console.log(`  ${formatKiB(bytes).padStart(11)}  ${file}`)
}

if (failed) {
  console.error(
    "\nEl paquete supera al menos un presupuesto. Revisa las importaciones estáticas antes de ampliarlo."
  )
  process.exitCode = 1
}
