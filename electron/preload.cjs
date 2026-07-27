const { contextBridge, ipcRenderer } = require("electron")

let requestSequence = 0

function createRequestId() {
  requestSequence += 1
  return `${Date.now()}-${requestSequence}-${Math.random().toString(36).slice(2)}`
}

contextBridge.exposeInMainWorld("editorDesktop", {
  isDesktop: true,
  documents: {
    open: (filePath) => ipcRenderer.invoke("documents:open", filePath),
    save: (input) => ipcRenderer.invoke("documents:save", input),
    saveRecovery: (input) => ipcRenderer.invoke("documents:saveRecovery", input),
    loadRecovery: (documentId) => ipcRenderer.invoke("documents:loadRecovery", documentId),
    listVersions: (documentId) => ipcRenderer.invoke("documents:listVersions", documentId),
    deleteVersion: (versionId) => ipcRenderer.invoke("documents:deleteVersion", versionId),
    pinVersion: (versionId, pinned) =>
      ipcRenderer.invoke("documents:pinVersion", versionId, pinned),
  },
  secrets: {
    hasZoteroKey: () => ipcRenderer.invoke("secrets:hasZoteroKey"),
    setZoteroKey: (apiKey) => ipcRenderer.invoke("secrets:setZoteroKey", apiKey),
    clearZoteroKey: () => ipcRenderer.invoke("secrets:clearZoteroKey"),
  },
  zotero: {
    connectLocal: () => ipcRenderer.invoke("zotero:connectLocal"),
    connectWeb: () => ipcRenderer.invoke("zotero:connectWeb"),
    fetchItems: (input) => ipcRenderer.invoke("zotero:fetchItems", input),
    fetchCollections: (input) => ipcRenderer.invoke("zotero:fetchCollections", input),
    fetchAttachments: (input) => ipcRenderer.invoke("zotero:fetchAttachments", input),
    sync: (input) => ipcRenderer.invoke("zotero:sync", input),
    mergeItems: (input) => ipcRenderer.invoke("zotero:mergeItems", input),
    openAttachment: (input) => ipcRenderer.invoke("zotero:openAttachment", input),
  },
  csl: {
    searchStyles: (query) => ipcRenderer.invoke("csl:searchStyles", query),
    fetchStyle: (styleId) => ipcRenderer.invoke("csl:fetchStyle", styleId),
    format: (input) => ipcRenderer.invoke("csl:format", input),
  },
  dictionary: {
    addWord: (word) => ipcRenderer.invoke("dictionary:addWord", word),
    removeWord: (word) => ipcRenderer.invoke("dictionary:removeWord", word),
    listWords: () => ipcRenderer.invoke("dictionary:listWords"),
    lookupSynonyms: (input) =>
      ipcRenderer.invoke("dictionary:lookupSynonyms", input),
  },
  ai: {
    testKey: (apiKey) => ipcRenderer.invoke("ai:testKey", apiKey),
    generate: (request, onEvent) => {
      const requestId = createRequestId()
      return new Promise((resolve, reject) => {
        const channel = `ai:event:${requestId}`
        const listener = (_event, payload) => {
          if (payload.type === "error") {
            ipcRenderer.removeListener(channel, listener)
            reject(new Error(payload.message))
            return
          }
          onEvent(payload)
          if (payload.type === "done") {
            ipcRenderer.removeListener(channel, listener)
            resolve({
              text: payload.text,
              sources: payload.sources ?? [],
              finishReason: payload.finishReason,
            })
          }
        }
        ipcRenderer.on(channel, listener)
        ipcRenderer.send("ai:start", requestId, request)
      })
    },
    cancel: (requestId) => ipcRenderer.send("ai:cancel", requestId),
  },
  windows: {
    detachDocument: (documentId) => ipcRenderer.invoke("windows:detachDocument", documentId),
    openExternal: (url) => ipcRenderer.invoke("windows:openExternal", url),
  },
  onMenuCommand: (callback) => {
    const listener = (_event, command, payload) => callback(command, payload)
    ipcRenderer.on("menu:command", listener)
    return () => ipcRenderer.removeListener("menu:command", listener)
  },
})

ipcRenderer.send("runtime:preload-ready")
