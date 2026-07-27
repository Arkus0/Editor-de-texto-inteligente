const fs = require("node:fs/promises")
const { parentPort } = require("node:worker_threads")

const {
  decodeMyThes,
  parseMyThesText,
} = require("./thesaurus-utils.cjs")

const textCache = new Map()
const resultCache = new Map()

async function loadText(filePath) {
  if (!textCache.has(filePath)) {
    textCache.set(
      filePath,
      fs.readFile(filePath).then((buffer) => decodeMyThes(buffer))
    )
  }
  return textCache.get(filePath)
}

parentPort.on("message", async ({ id, filePath, word, language }) => {
  try {
    const cacheKey = `${filePath}:${word.toLocaleLowerCase(language)}`
    let result = resultCache.get(cacheKey)
    if (!result) {
      const parsed = parseMyThesText(
        await loadText(filePath),
        word,
        language
      )
      result = {
        ...parsed,
        language,
        source: "libreoffice-mythes",
        available: true,
      }
      resultCache.set(cacheKey, result)
    }
    parentPort.postMessage({ id, result })
  } catch (error) {
    parentPort.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
