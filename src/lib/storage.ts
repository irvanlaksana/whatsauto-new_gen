import { defaultSettings, emptyProgram, seedContacts, seedRules } from "./defaults";
import type {
  AppSettings,
  ContactEntry,
  LogEntry,
  ReplyProgram,
  ReplyRule,
  SheetSource,
  SyncState,
} from "./types";

/** Penyimpanan lokal (WebView/localStorage) — tidak butuh backend. */

const STORAGE_KEY = "whatsauto.state.v3";

export interface PersistedState {
  settings: AppSettings;
  manualRules: ReplyRule[];
  sheetRules: ReplyRule[];
  whitelist: ContactEntry[];
  blacklist: ContactEntry[];
  sheet: SheetSource;
  sync: SyncState;
  logs: LogEntry[];
}

export function defaultSheetSource(): SheetSource {
  return {
    url: "",
    rulesSheet: "Balasan",
    settingsSheet: "Parameter",
    autoSync: true,
    syncIntervalMinutes: 5,
    sheetsApiKey: "",
  };
}

export function defaultState(): PersistedState {
  const contacts = seedContacts();
  return {
    settings: defaultSettings(),
    manualRules: seedRules(),
    sheetRules: [],
    whitelist: contacts.whitelist,
    blacklist: contacts.blacklist,
    sheet: defaultSheetSource(),
    sync: { lastSyncAt: null, lastStatus: "idle", lastMessage: "Belum pernah sinkron.", rowCount: 0 },
    logs: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Gabungkan objek tersimpan di atas nilai default, tahan terhadap data lama/rusak. */
function mergeObject<T extends object>(base: T, value: unknown): T {
  if (!isRecord(value)) return base;
  return { ...base, ...(value as Partial<T>) };
}

function pickArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

export function loadState(): PersistedState {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return base;

    const settings = mergeObject(base.settings, parsed.settings);
    return {
      settings: {
        ...settings,
        activeHours: mergeObject(base.settings.activeHours, settings.activeHours),
        ai: mergeObject(base.settings.ai, settings.ai),
      },
      manualRules: pickArray<ReplyRule>(parsed.manualRules, base.manualRules),
      sheetRules: pickArray<ReplyRule>(parsed.sheetRules),
      whitelist: pickArray<ContactEntry>(parsed.whitelist, base.whitelist),
      blacklist: pickArray<ContactEntry>(parsed.blacklist, base.blacklist),
      sheet: mergeObject(base.sheet, parsed.sheet),
      sync: mergeObject(base.sync, parsed.sync),
      logs: pickArray<LogEntry>(parsed.logs),
    };
  } catch {
    return base;
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* penyimpanan penuh / mode privat — abaikan */
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* abaikan */
  }
}

export function buildProgramFromState(state: PersistedState): ReplyProgram {
  const program = emptyProgram();
  program.settings = state.settings;
  program.rules = [...state.sheetRules, ...state.manualRules];
  program.whitelist = state.whitelist;
  program.blacklist = state.blacklist;
  return program;
}
