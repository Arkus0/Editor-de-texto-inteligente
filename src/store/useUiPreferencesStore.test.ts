import { beforeEach, describe, expect, it } from "vitest"

import {
  DEFAULT_QUICK_ACCESS_COMMANDS,
  DEFAULT_RIBBON_TABS,
  normalizeHiddenRibbonGroups,
  normalizeQuickAccessCommands,
  normalizeRibbonTabs,
  useUiPreferencesStore,
} from "@/store/useUiPreferencesStore"

describe("preferencias de interfaz", () => {
  beforeEach(() => {
    useUiPreferencesStore.setState({
      quickAccessCommands: [...DEFAULT_QUICK_ACCESS_COMMANDS],
      ribbonTabs: [...DEFAULT_RIBBON_TABS],
      hiddenRibbonGroups: [],
    })
  })

  it("limpia identificadores antiguos, repetidos o desconocidos", () => {
    expect(
      normalizeQuickAccessCommands(["redo", "save", "redo", "unknown"])
    ).toEqual(["redo", "save"])
  })

  it("permite añadir, quitar y reordenar accesos", () => {
    const state = useUiPreferencesStore.getState()
    state.toggleQuickAccessCommand("print")
    useUiPreferencesStore.getState().moveQuickAccessCommand("print", -1)
    expect(useUiPreferencesStore.getState().quickAccessCommands).toEqual([
      "save",
      "undo",
      "print",
      "redo",
    ])

    useUiPreferencesStore.getState().toggleQuickAccessCommand("undo")
    expect(useUiPreferencesStore.getState().quickAccessCommands).toEqual([
      "save",
      "print",
      "redo",
    ])
  })

  it("normaliza pestañas y grupos de cinta persistidos", () => {
    expect(normalizeRibbonTabs(["review", "home", "review", "unknown"])).toEqual([
      "review",
      "home",
    ])
    expect(
      normalizeHiddenRibbonGroups([
        "home.font",
        "home.font",
        "unknown.group",
      ])
    ).toEqual(["home.font"])
  })

  it("permite ocultar y reordenar pestañas sin dejar la cinta vacía", () => {
    const state = useUiPreferencesStore.getState()
    state.toggleRibbonTab("insert")
    useUiPreferencesStore.getState().moveRibbonTab("review", -1)

    expect(useUiPreferencesStore.getState().ribbonTabs).not.toContain("insert")
    expect(useUiPreferencesStore.getState().ribbonTabs.indexOf("review")).toBe(
      DEFAULT_RIBBON_TABS.indexOf("review") - 2
    )

    for (const tab of useUiPreferencesStore
      .getState()
      .ribbonTabs.filter((candidate) => candidate !== "home")) {
      useUiPreferencesStore.getState().toggleRibbonTab(tab)
    }
    useUiPreferencesStore.getState().toggleRibbonTab("home")
    expect(useUiPreferencesStore.getState().ribbonTabs).toEqual(["home"])
  })

  it("oculta grupos pero conserva al menos uno por pestaña", () => {
    const state = useUiPreferencesStore.getState()
    state.toggleRibbonGroup("design.themes")
    state.toggleRibbonGroup("design.customize")
    state.toggleRibbonGroup("design.page")
    expect(useUiPreferencesStore.getState().hiddenRibbonGroups).toEqual([
      "design.themes",
      "design.customize",
    ])
    useUiPreferencesStore.getState().toggleRibbonGroup("design.themes")
    expect(useUiPreferencesStore.getState().hiddenRibbonGroups).toEqual([
      "design.customize",
    ])
  })
})
