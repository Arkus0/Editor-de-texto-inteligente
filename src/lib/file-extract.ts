export interface ExtractedAttachment {
  id: string;
  name: string;
  size: number;
  text: string;
}

import type {
  AcademicAttachmentKind,
  AiAttachmentInput,
} from "@/types/academic"

const MAX_PDF_BYTES = 50 * 1024 * 1024
const MAX_INLINE_MEDIA_BYTES = 18 * 1024 * 1024

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(`[Página ${pageNumber}]\n${pageText}`);
  }
  return pageTexts.join("\n\n");
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractDocxHtml(file: File): Promise<string> {
  const mammoth = await import("mammoth")
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      includeDefaultStyleMap: true,
      convertImage: mammoth.images.imgElement((image) =>
        image.read("base64").then((data) => ({
          src: `data:${image.contentType};base64,${data}`,
        }))
      ),
    }
  )
  return result.value
}

async function extractOdtText(file: File): Promise<string> {
  const [{ default: JSZip }, { XMLParser }] = await Promise.all([
    import("jszip"),
    import("fast-xml-parser"),
  ])
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const contentFile = zip.file("content.xml")
  if (!contentFile) throw new Error("El ODT no contiene content.xml.")
  const document = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    preserveOrder: true,
    trimValues: false,
  }).parse(await contentFile.async("string")) as Array<Record<string, unknown>>

  const textFromNodes = (nodes: Array<Record<string, unknown>>): string =>
    nodes
      .map((node) => {
        const tag = Object.keys(node).find((key) => key !== ":@") ?? ""
        if (tag === "#text") return String(node[tag] ?? "")
        const attributes =
          (node[":@"] as Record<string, unknown> | undefined) ?? {}
        if (tag === "text:s") {
          return " ".repeat(
            Math.max(1, Number(attributes["text:c"]) || 1)
          )
        }
        if (tag === "text:tab") return "\t"
        if (tag === "text:line-break") return "\n"
        const children = Array.isArray(node[tag])
          ? (node[tag] as Array<Record<string, unknown>>)
          : []
        const text = textFromNodes(children)
        return /^(text:p|text:h|text:list-item|table:table-row)$/.test(tag)
          ? `${text}\n`
          : text
      })
      .join("")

  return textFromNodes(document)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function textToParagraphHtml(text: string) {
  const paragraphs = text
    .replace(/\r\n?/gu, "\n")
    .split(/\n{2,}/gu)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br>")
    )
  return paragraphs.map((paragraph) => `<p>${paragraph || "<br>"}</p>`).join("")
}

function sanitizeImportedHtml(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html")
  document
    .querySelectorAll("script,style,iframe,object,embed,form,meta,link")
    .forEach((element) => element.remove())
  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      if (
        attribute.name.toLowerCase().startsWith("on") ||
        /^(?:javascript|vbscript):/iu.test(attribute.value.trim())
      ) {
        element.removeAttribute(attribute.name)
      }
    }
  })
  return document.body.innerHTML
}

export async function extractEditableHtmlFromFile(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase()

  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return sanitizeImportedHtml(await extractDocxHtml(file))
  }

  if (
    file.type === "application/vnd.oasis.opendocument.text" ||
    lowerName.endsWith(".odt")
  ) {
    return textToParagraphHtml(await extractOdtText(file))
  }

  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return textToParagraphHtml(await extractPdfText(file))
  }

  if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
    const { markdownToHtml } = await import("@/lib/markdown")
    return sanitizeImportedHtml(markdownToHtml(await file.text()))
  }

  if (file.type === "text/html" || lowerName.endsWith(".html")) {
    return sanitizeImportedHtml(await file.text())
  }

  if (file.type === "text/plain" || lowerName.endsWith(".txt")) {
    return textToParagraphHtml(await file.text())
  }

  throw new Error(`Formato de archivo no soportado: ${file.name}`)
}

export async function extractTextFromFile(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();

  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return extractPdfText(file);
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return extractDocxText(file);
  }

  if (
    file.type === "application/vnd.oasis.opendocument.text" ||
    lowerName.endsWith(".odt")
  ) {
    return extractOdtText(file)
  }

  if (file.type === "text/plain" || lowerName.endsWith(".txt")) {
    return file.text();
  }

  if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
    return file.text()
  }

  if (file.type === "text/html" || lowerName.endsWith(".html")) {
    const html = await file.text()
    const document = new DOMParser().parseFromString(html, "text/html")
    return document.body.textContent ?? ""
  }

  throw new Error(`Formato de archivo no soportado: ${file.name}`);
}

function inferKind(file: File): AcademicAttachmentKind {
  const lowerName = file.name.toLowerCase()
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf"
  if (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp)$/i.test(lowerName)
  ) {
    return "image"
  }
  return "text"
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ""
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

export async function prepareAiAttachment(file: File): Promise<
  Pick<AiAttachmentInput, "name" | "mimeType" | "kind" | "text" | "dataBase64">
> {
  const kind = inferKind(file)
  if (kind === "pdf" && file.size > MAX_PDF_BYTES) {
    throw new Error("Los PDF no pueden superar 50 MB.")
  }

  if (kind === "image") {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      throw new Error("La imagen debe ser PNG, JPG o WebP.")
    }
    if (file.size > MAX_INLINE_MEDIA_BYTES) {
      throw new Error("La imagen no puede superar 18 MB.")
    }
    return {
      name: file.name,
      mimeType: file.type,
      kind,
      text: "",
      dataBase64: arrayBufferToBase64(await file.arrayBuffer()),
    }
  }

  if (kind === "pdf") {
    let text = ""
    try {
      text = await extractPdfText(file)
    } catch {
      // Un PDF escaneado puede no tener una capa de texto. Gemini recibirá
      // también el documento visual completo.
    }
    if (file.size > MAX_INLINE_MEDIA_BYTES) {
      if (text.replace(/\s/g, "").length < 200) {
        throw new Error(
          "Este PDF escaneado supera 18 MB. Comprímelo o divídelo para que Gemini pueda leer sus páginas visualmente."
        )
      }
      return {
        name: file.name,
        mimeType: "application/pdf",
        kind,
        text,
      }
    }
    return {
      name: file.name,
      mimeType: "application/pdf",
      kind,
      text,
      dataBase64: arrayBufferToBase64(await file.arrayBuffer()),
    }
  }

  return {
    name: file.name,
    mimeType: file.type || "text/plain",
    kind,
    text: await extractTextFromFile(file),
  }
}
