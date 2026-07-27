import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  backupExternalFile,
  fileSha256,
  inspectExternalFile,
} from "../../electron/document-save-utils.cjs"

const temporaryDirectories: string[] = []

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "eti-save-conflict-"))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe("protección contra conflictos de guardado", () => {
  it("distingue el archivo esperado de una modificación externa", async () => {
    const directory = await temporaryDirectory()
    const documentPath = join(directory, "tesis.docx")
    await writeFile(documentPath, "versión abierta")
    const expectedHash = await fileSha256(documentPath)

    expect(
      await inspectExternalFile(documentPath, expectedHash)
    ).toMatchObject({
      exists: true,
      conflict: false,
      expectedHash,
      actualHash: expectedHash,
    })

    await writeFile(documentPath, "versión cambiada en Word")
    const conflict = await inspectExternalFile(documentPath, expectedHash)
    expect(conflict.conflict).toBe(true)
    expect(conflict.actualHash).not.toBe(expectedHash)
    expect(conflict.modifiedAt).toEqual(expect.any(Number))
  })

  it("conserva una copia recuperable antes de sobrescribir", async () => {
    const directory = await temporaryDirectory()
    const documentPath = join(directory, "trabajo.docx")
    const backupRoot = join(directory, "backups")
    await writeFile(documentPath, "cambios externos importantes")

    const backupPath = await backupExternalFile({
      filePath: documentPath,
      backupRoot,
      documentId: "../documento:uno",
      now: Date.UTC(2026, 6, 24, 19, 30),
    })

    expect(backupPath.startsWith(backupRoot)).toBe(true)
    expect(await readFile(backupPath, "utf8")).toBe(
      "cambios externos importantes"
    )
  })

  it("permite guardar si el archivo externo ya no existe", async () => {
    const directory = await temporaryDirectory()
    const missingPath = join(directory, "eliminado.docx")

    expect(
      await inspectExternalFile(missingPath, "hash-anterior")
    ).toEqual({
      exists: false,
      actualHash: null,
      expectedHash: "hash-anterior",
      modifiedAt: null,
      conflict: false,
    })
  })
})
