import { create } from "zustand"
import { persist } from "zustand/middleware"

export const QUICK_ACCESS_COMMANDS = [
  "save",
  "undo",
  "redo",
  "open",
  "print",
  "focus",
  "accessibility",
] as const

export type QuickAccessCommandId = (typeof QUICK_ACCESS_COMMANDS)[number]

export const DEFAULT_QUICK_ACCESS_COMMANDS: QuickAccessCommandId[] = [
  "save",
  "undo",
  "redo",
]

export const RIBBON_TAB_IDS = [
  "home",
  "insert",
  "design",
  "layout",
  "references",
  "mailings",
  "review",
  "view",
  "ai",
] as const

export type RibbonPreferenceTabId = (typeof RIBBON_TAB_IDS)[number]

export const DEFAULT_RIBBON_TABS: RibbonPreferenceTabId[] = [
  ...RIBBON_TAB_IDS,
]

export const RIBBON_GROUPS_BY_TAB: Record<
  RibbonPreferenceTabId,
  readonly string[]
> = {
  home: [
    "home.clipboard",
    "home.font",
    "home.styles",
    "home.paragraph",
    "home.editing",
  ],
  insert: ["insert.content", "insert.pages", "insert.fields"],
  design: ["design.themes", "design.page", "design.customize"],
  layout: ["layout.page", "layout.zoom"],
  references: ["references.citations", "references.academic"],
  mailings: ["mailings.merge"],
  review: ["review.versions", "review.review", "review.accessibility"],
  view: ["view.show", "view.zoom", "view.immersive"],
  ai: ["ai.assistant"],
}

interface UiPreferencesState {
  quickAccessCommands: QuickAccessCommandId[]
  ribbonTabs: RibbonPreferenceTabId[]
  hiddenRibbonGroups: string[]
  toggleQuickAccessCommand: (command: QuickAccessCommandId) => void
  moveQuickAccessCommand: (
    command: QuickAccessCommandId,
    direction: -1 | 1
  ) => void
  resetQuickAccessCommands: () => void
  toggleRibbonTab: (tab: RibbonPreferenceTabId) => void
  moveRibbonTab: (tab: RibbonPreferenceTabId, direction: -1 | 1) => void
  toggleRibbonGroup: (group: string) => void
  resetRibbon: () => void
}

const commandIds = new Set<string>(QUICK_ACCESS_COMMANDS)
const ribbonTabIds = new Set<string>(RIBBON_TAB_IDS)
const ribbonGroupIds = new Set<string>(
  Object.values(RIBBON_GROUPS_BY_TAB).flat()
)

export function normalizeQuickAccessCommands(
  value: unknown
): QuickAccessCommandId[] {
  if (!Array.isArray(value)) return [...DEFAULT_QUICK_ACCESS_COMMANDS]
  const commands = [
    ...new Set(
      value.filter(
        (command): command is QuickAccessCommandId =>
          typeof command === "string" && commandIds.has(command)
      )
    ),
  ]
  return commands.length ? commands : [...DEFAULT_QUICK_ACCESS_COMMANDS]
}

export function normalizeRibbonTabs(
  value: unknown
): RibbonPreferenceTabId[] {
  if (!Array.isArray(value)) return [...DEFAULT_RIBBON_TABS]
  const tabs = [
    ...new Set(
      value.filter(
        (tab): tab is RibbonPreferenceTabId =>
          typeof tab === "string" && ribbonTabIds.has(tab)
      )
    ),
  ]
  return tabs.length ? tabs : [...DEFAULT_RIBBON_TABS]
}

export function normalizeHiddenRibbonGroups(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (group): group is string =>
          typeof group === "string" && ribbonGroupIds.has(group)
      )
    ),
  ]
}

export const useUiPreferencesStore = create<UiPreferencesState>()(
  persist(
    (set) => ({
      quickAccessCommands: [...DEFAULT_QUICK_ACCESS_COMMANDS],
      ribbonTabs: [...DEFAULT_RIBBON_TABS],
      hiddenRibbonGroups: [],
      toggleQuickAccessCommand: (command) =>
        set((state) => {
          const exists = state.quickAccessCommands.includes(command)
          return {
            quickAccessCommands: exists
              ? state.quickAccessCommands.filter((item) => item !== command)
              : [...state.quickAccessCommands, command],
          }
        }),
      moveQuickAccessCommand: (command, direction) =>
        set((state) => {
          const index = state.quickAccessCommands.indexOf(command)
          const target = index + direction
          if (
            index < 0 ||
            target < 0 ||
            target >= state.quickAccessCommands.length
          ) {
            return state
          }
          const quickAccessCommands = [...state.quickAccessCommands]
          ;[quickAccessCommands[index], quickAccessCommands[target]] = [
            quickAccessCommands[target],
            quickAccessCommands[index],
          ]
          return { quickAccessCommands }
        }),
      resetQuickAccessCommands: () => ({
        quickAccessCommands: [...DEFAULT_QUICK_ACCESS_COMMANDS],
      }),
      toggleRibbonTab: (tab) =>
        set((state) => {
          const visible = state.ribbonTabs.includes(tab)
          if (visible && state.ribbonTabs.length === 1) return state
          if (visible) {
            return {
              ribbonTabs: state.ribbonTabs.filter((candidate) => candidate !== tab),
            }
          }
          const visibleSet = new Set([...state.ribbonTabs, tab])
          return {
            ribbonTabs: DEFAULT_RIBBON_TABS.filter((candidate) =>
              visibleSet.has(candidate)
            ),
          }
        }),
      moveRibbonTab: (tab, direction) =>
        set((state) => {
          const index = state.ribbonTabs.indexOf(tab)
          const target = index + direction
          if (index < 0 || target < 0 || target >= state.ribbonTabs.length) {
            return state
          }
          const ribbonTabs = [...state.ribbonTabs]
          ;[ribbonTabs[index], ribbonTabs[target]] = [
            ribbonTabs[target],
            ribbonTabs[index],
          ]
          return { ribbonTabs }
        }),
      toggleRibbonGroup: (group) =>
        set((state) => {
          if (!ribbonGroupIds.has(group)) return state
          const hidden = state.hiddenRibbonGroups.includes(group)
          if (hidden) {
            return {
              hiddenRibbonGroups: state.hiddenRibbonGroups.filter(
                (candidate) => candidate !== group
              ),
            }
          }
          const tab = group.split(".")[0] as RibbonPreferenceTabId
          const groups = RIBBON_GROUPS_BY_TAB[tab] ?? []
          const visibleGroups = groups.filter(
            (candidate) => !state.hiddenRibbonGroups.includes(candidate)
          )
          if (visibleGroups.length === 1 && visibleGroups[0] === group) {
            return state
          }
          return {
            hiddenRibbonGroups: [...state.hiddenRibbonGroups, group],
          }
        }),
      resetRibbon: () => ({
        ribbonTabs: [...DEFAULT_RIBBON_TABS],
        hiddenRibbonGroups: [],
      }),
    }),
    {
      name: "eti-ui-preferences",
      version: 2,
      migrate: (persisted) => {
        const value = persisted as Partial<UiPreferencesState>
        return {
          quickAccessCommands: normalizeQuickAccessCommands(
            value.quickAccessCommands
          ),
          ribbonTabs: normalizeRibbonTabs(value.ribbonTabs),
          hiddenRibbonGroups: normalizeHiddenRibbonGroups(
            value.hiddenRibbonGroups
          ),
        }
      },
      partialize: (state) => ({
        quickAccessCommands: state.quickAccessCommands,
        ribbonTabs: state.ribbonTabs,
        hiddenRibbonGroups: state.hiddenRibbonGroups,
      }),
    }
  )
)
