const { createHash } = require("node:crypto")
const fs = require("node:fs/promises")
const fsSync = require("node:fs")
const path = require("node:path")

function fileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256")
    const stream = fsSync.createReadStream(filePath)
    stream.on("error", reject)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("end", () => resolve(hash.digest("hex")))
  })
}

async function inspectExternalFile(filePath, expectedHash) {
  try {
    const [actualHash, stat] = await Promise.all([
      fileSha256(filePath),
      fs.stat(filePath),
    ])
    return {
      exists: true,
      actualHash,
      expectedHash: expectedHash || null,
      modifiedAt: stat.mtimeMs,
      conflict: Boolean(expectedHash && actualHash !== expectedHash),
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        exists: false,
        actualHash: null,
        expectedHash: expectedHash || null,
        modifiedAt: null,
        conflict: false,
      }
    }
    throw error
  }
}

async function backupExternalFile({
  filePath,
  backupRoot,
  documentId,
  now = Date.now(),
}) {
  const safeDocumentId = String(documentId).replace(/[^A-Za-z0-9_-]/g, "_")
  const resolvedRoot = path.resolve(backupRoot)
  const backupDirectory = path.resolve(resolvedRoot, safeDocumentId)
  if (
    backupDirectory !== resolvedRoot &&
    !backupDirectory.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error("Ruta de copia de conflicto no válida.")
  }
  await fs.mkdir(backupDirectory, { recursive: true })
  const timestamp = new Date(now).toISOString().replace(/[:.]/g, "-")
  const backupPath = path.join(
    backupDirectory,
    `${timestamp}-${path.basename(filePath)}`
  )
  await fs.copyFile(filePath, backupPath)
  return backupPath
}

module.exports = {
  backupExternalFile,
  fileSha256,
  inspectExternalFile,
}
