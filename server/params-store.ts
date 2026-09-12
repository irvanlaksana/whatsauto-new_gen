import fs from "node:fs";
import path from "node:path";
import { defaultSettings, PROGRAM_VERSION, rule as makeRule } from "../src/lib/defaults";
import type { AppSettings, ContactEntry, ReplyProgram, ReplyRule } from "../src/lib/types";

/**
 * Penyimpanan parameter di sisi backend (file JSON).
 *
 * Backend ini menjadi sumber parameter alternatif selain Google Spreadsheet:
 * admin mengatur balasan lewat halaman web `/admin`, lalu aplikasi Android
 * menariknya lewat `GET /api/params`.
 */

export interface StoredParams {
  version: number;
  updatedAt: string;
  settings: AppSettings;
  rules: ReplyRule[];
  whitelist: ContactEntry[];
  blacklist: ContactEntry[];
}

export function defaultParams(): StoredParams {
  return {
    version: PROGRAM_VERSION,
    updatedAt: new Date().toISOString(),
    settings: defaultSettings(),
    rules: [],
    whitelist: [],
    blacklist: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Buang field tak dikenal agar payload dari klien tidak merusak bentuk data. */
export function sanitizeParams(input: unknown): StoredParams {
  const base = defaultParams();
  if (!isRecord(input)) return base;

  const settings = { ...base.settings, ...(isRecord(input.settings) ? input.settings : {}) } as AppSettings;
  settings.activeHours = {
    ...base.settings.activeHours,
    ...(isRecord(settings.activeHours) ? settings.activeHours : {}),
  };
  settings.ai = { ...base.settings.ai, ...(isRecord(settings.ai) ? settings.ai : {}) };
  settings.channels = Array.isArray(settings.channels) ? settings.channels : base.settings.channels;

  const rawRules = Array.isArray(input.rules) ? input.rules : [];
  const rules = rawRules
    .filter(isRecord)
    .filter((item) => typeof item.keyword === "string" && typeof item.reply === "string")
    .map((item, index) =>
      makeRule({
        id: typeof item.id === "string" && item.id ? item.id : `backend_${index + 2}`,
        keyword: String(item.keyword),
        reply: String(item.reply),
        matchType: ["exact", "contains", "regex"].includes(String(item.matchType))
          ? (String(item.matchType) as ReplyRule["matchType"])
          : "contains",
        active: item.active !== false,
        delayMs: typeof item.delayMs === "number" ? item.delayMs : null,
        priority: typeof item.priority === "number" ? item.priority : 0,
        channels: Array.isArray(item.channels) ? (item.channels as ReplyRule["channels"]) : [],
        source: "backend",
        row: typeof item.row === "number" ? item.row : undefined,
        note: typeof item.note === "string" ? item.note : undefined,
        extra: isRecord(item.extra) ? (item.extra as Record<string, string>) : {},
      }),
    );

  const contacts = (value: unknown): ContactEntry[] =>
    (Array.isArray(value) ? value : [])
      .filter(isRecord)
      .map((item, index) => ({
        id: typeof item.id === "string" && item.id ? item.id : `c_${index}`,
        name: String(item.name ?? ""),
        phone: String(item.phone ?? ""),
        note: typeof item.note === "string" ? item.note : undefined,
      }));

  return {
    version: PROGRAM_VERSION,
    updatedAt: new Date().toISOString(),
    settings,
    rules,
    whitelist: contacts(input.whitelist),
    blacklist: contacts(input.blacklist),
  };
}

export interface ParamsStore {
  read(): StoredParams;
  write(params: StoredParams): StoredParams;
  path: string;
}

export function createParamsStore(filePath: string): ParamsStore {
  const resolved = path.resolve(filePath);

  const read = (): StoredParams => {
    try {
      const raw = fs.readFileSync(resolved, "utf-8");
      const stored = sanitizeParams(JSON.parse(raw));
      // updatedAt dari file dipertahankan bila ada.
      const parsed = JSON.parse(raw) as { updatedAt?: string };
      if (typeof parsed.updatedAt === "string") stored.updatedAt = parsed.updatedAt;
      return stored;
    } catch {
      return defaultParams();
    }
  };

  const write = (params: StoredParams): StoredParams => {
    const clean = sanitizeParams(params);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(clean, null, 2), "utf-8");
    return clean;
  };

  return { read, write, path: resolved };
}

/** Gabungkan parameter backend menjadi program balasan siap pakai. */
export function toProgram(params: StoredParams): ReplyProgram {
  return {
    version: PROGRAM_VERSION,
    generatedAt: params.updatedAt,
    settings: params.settings,
    rules: params.rules,
    whitelist: params.whitelist,
    blacklist: params.blacklist,
  };
}
