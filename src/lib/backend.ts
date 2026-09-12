import { httpText } from "./http";
import { rule as makeRule } from "./defaults";
import type { AppSettings, BackendConfig, ContactEntry, ReplyRule } from "./types";

/**
 * Klien backend web (server/index.ts).
 *
 * Backend adalah sumber parameter alternatif selain Google Spreadsheet:
 * admin mengubah balasan di halaman `/admin`, aplikasi menariknya dari sini.
 */

export interface BackendParams {
  version: number;
  updatedAt: string;
  settings: AppSettings;
  rules: ReplyRule[];
  whitelist: ContactEntry[];
  blacklist: ContactEntry[];
}

export interface BackendResult {
  ok: boolean;
  message: string;
  params?: BackendParams;
}

function joinUrl(base: string, path: string): string {
  const clean = base.trim().replace(/\/+$/, "");
  return `${clean}${path}`;
}

function normalizeRules(raw: unknown): ReplyRule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
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
        extra:
          typeof item.extra === "object" && item.extra !== null
            ? (item.extra as Record<string, string>)
            : {},
      }),
    );
}

function normalizeContacts(raw: unknown): ContactEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item, index) => ({
      id: typeof item.id === "string" && item.id ? item.id : `c_${index}`,
      name: String(item.name ?? ""),
      phone: String(item.phone ?? ""),
      note: typeof item.note === "string" ? item.note : undefined,
    }));
}

export function normalizeParams(raw: unknown): BackendParams | null {
  if (typeof raw !== "object" || raw === null) return null;
  const input = raw as Record<string, unknown>;
  const settings = input.settings as AppSettings | undefined;
  if (!settings || typeof settings !== "object") return null;

  return {
    version: typeof input.version === "number" ? input.version : 0,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
    settings,
    rules: normalizeRules(input.rules),
    whitelist: normalizeContacts(input.whitelist),
    blacklist: normalizeContacts(input.blacklist),
  };
}

export async function pingBackend(backend: BackendConfig): Promise<BackendResult> {
  if (!backend.url.trim()) return { ok: false, message: "Alamat backend belum diisi." };
  const response = await httpText(joinUrl(backend.url, "/api/health"), { timeoutMs: 10_000 });
  if (!response.ok) {
    return {
      ok: false,
      message: response.error ?? `Backend tidak merespons (status ${response.status}).`,
    };
  }
  try {
    const health = JSON.parse(response.body) as { rules?: number; updatedAt?: string };
    return {
      ok: true,
      message: `Backend aktif · ${health.rules ?? 0} aturan · diperbarui ${
        health.updatedAt ? new Date(health.updatedAt).toLocaleString("id-ID") : "-"
      }`,
    };
  } catch {
    return { ok: false, message: "Respons backend tidak valid." };
  }
}

export async function pullParams(backend: BackendConfig): Promise<BackendResult> {
  if (!backend.url.trim()) return { ok: false, message: "Alamat backend belum diisi." };
  const response = await httpText(joinUrl(backend.url, "/api/params"), { timeoutMs: 15_000 });
  if (!response.ok) {
    return {
      ok: false,
      message: response.error ?? `Gagal mengambil parameter (status ${response.status}).`,
    };
  }
  try {
    const params = normalizeParams(JSON.parse(response.body));
    if (!params) return { ok: false, message: "Bentuk parameter dari backend tidak dikenali." };
    return {
      ok: true,
      message: `${params.rules.length} aturan ditarik dari backend.`,
      params,
    };
  } catch (error) {
    return { ok: false, message: `Respons backend tidak valid: ${(error as Error).message}` };
  }
}

export async function pushParams(
  backend: BackendConfig,
  payload: Omit<BackendParams, "version" | "updatedAt">,
): Promise<BackendResult> {
  if (!backend.url.trim()) return { ok: false, message: "Alamat backend belum diisi." };
  const response = await httpText(joinUrl(backend.url, "/api/params"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeoutMs: 15_000,
  });
  if (!response.ok) {
    return { ok: false, message: response.error ?? `Gagal menyimpan ke backend (status ${response.status}).` };
  }
  try {
    const result = JSON.parse(response.body) as { params?: unknown };
    const params = normalizeParams(result.params);
    return {
      ok: true,
      message: `Parameter terkirim ke backend (${params?.rules.length ?? 0} aturan).`,
      params: params ?? undefined,
    };
  } catch {
    return { ok: true, message: "Parameter terkirim ke backend." };
  }
}
