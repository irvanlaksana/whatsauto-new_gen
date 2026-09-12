import { parseTable, type Table } from "./csv";
import { normalizeKey } from "./variables";
import { defaultSettings, PROGRAM_VERSION, rule } from "./defaults";
import type {
  AppSettings,
  ChannelId,
  MatchType,
  ReplyProgram,
  ReplyRule,
} from "./types";
import { CHANNELS } from "./types";

/**
 * Mengubah dokumen spreadsheet (CSV/TSV) menjadi program balasan.
 * Inilah inti fitur "sinkronisasi spreadsheet": parameter balasan dibaca
 * langsung dari sheet, bukan di-hardcode di aplikasi.
 */

const KEYWORD_ALIASES = ["keyword", "kata_kunci", "katakunci", "trigger", "pesan_masuk", "incoming", "key", "pesan"];
const REPLY_ALIASES = ["reply", "balasan", "jawaban", "response", "pesan_balasan", "reply_text", "replytext", "isi"];
const MATCH_ALIASES = ["match", "match_type", "matchtype", "tipe", "tipe_match", "jenis", "jenis_pencocokan"];
const ACTIVE_ALIASES = ["active", "aktif", "status", "enabled", "is_active", "on"];
const DELAY_ALIASES = ["delay", "delay_ms", "delayms", "jeda", "jeda_ms"];
const PRIORITY_ALIASES = ["priority", "prioritas", "urutan", "bobot"];
const CHANNEL_ALIASES = ["channel", "platform", "aplikasi", "app", "apps"];
const NOTE_ALIASES = ["note", "notes", "catatan", "keterangan"];

function pickHeader(headers: string[], aliases: string[]): string | undefined {
  const normalized = headers.map(normalizeKey);
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index !== -1) return headers[index];
  }
  return undefined;
}

function parseBool(value: string | undefined, fallback = true): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const v = value.trim().toLowerCase();
  if (["true", "1", "yes", "ya", "y", "on", "aktif", "active"].includes(v)) return true;
  if (["false", "0", "no", "tidak", "n", "off", "nonaktif"].includes(v)) return false;
  return fallback;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat((value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDelay(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function parseMatchType(value: string | undefined): MatchType {
  const v = normalizeKey(value ?? "");
  if (v === "exact" || v === "persis" || v === "sama") return "exact";
  if (v === "regex" || v === "regular") return "regex";
  return "contains";
}

function parseChannels(value: string | undefined): ChannelId[] {
  if (!value || value.trim() === "" || value.trim() === "*") return [];
  const wanted = value
    .split(/[,;|]/)
    .map((part) => normalizeKey(part))
    .filter(Boolean);
  const found: ChannelId[] = [];
  for (const channel of CHANNELS) {
    const id = normalizeKey(channel.id);
    const label = normalizeKey(channel.label);
    if (wanted.includes(id) || wanted.includes(label)) found.push(channel.id);
  }
  return found;
}

export interface ParsedRules {
  rules: ReplyRule[];
  skipped: number;
  warnings: string[];
}

export function rulesFromTable(table: Table): ParsedRules {
  const { headers, rows } = table;
  const keywordHeader = pickHeader(headers, KEYWORD_ALIASES);
  const replyHeader = pickHeader(headers, REPLY_ALIASES);
  const warnings: string[] = [];

  if (!keywordHeader || !replyHeader) {
    return {
      rules: [],
      skipped: rows.length,
      warnings: [
        `Kolom "keyword" dan "reply" tidak ditemukan. Header terbaca: ${headers.join(", ") || "(kosong)"}`,
      ],
    };
  }

  const matchHeader = pickHeader(headers, MATCH_ALIASES);
  const activeHeader = pickHeader(headers, ACTIVE_ALIASES);
  const delayHeader = pickHeader(headers, DELAY_ALIASES);
  const priorityHeader = pickHeader(headers, PRIORITY_ALIASES);
  const channelHeader = pickHeader(headers, CHANNEL_ALIASES);
  const noteHeader = pickHeader(headers, NOTE_ALIASES);
  const known = new Set(
    [keywordHeader, replyHeader, matchHeader, activeHeader, delayHeader, priorityHeader, channelHeader, noteHeader]
      .filter((h): h is string => Boolean(h))
      .map(normalizeKey),
  );

  const rules: ReplyRule[] = [];
  let skipped = 0;

  rows.forEach((cells, index) => {
    const rowNumber = index + 2; // +1 header, +1 basis 1
    const cellOf = (header?: string) =>
      header ? (cells[headers.indexOf(header)] ?? "").trim() : undefined;

    const keyword = cellOf(keywordHeader) ?? "";
    const reply = cellOf(replyHeader) ?? "";
    if (!keyword && !reply) {
      skipped += 1;
      return;
    }
    if (!reply) {
      warnings.push(`Baris ${rowNumber}: kolom reply kosong, baris dilewati.`);
      skipped += 1;
      return;
    }

    const extra: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      const key = normalizeKey(header);
      if (!key || known.has(key)) return;
      const value = (cells[columnIndex] ?? "").trim();
      if (value) extra[key] = value;
    });

    rules.push(
      rule({
        id: `sheet_${rowNumber}_${normalizeKey(keyword) || "row"}`,
        keyword,
        reply,
        matchType: parseMatchType(cellOf(matchHeader)),
        active: parseBool(cellOf(activeHeader), true),
        delayMs: parseDelay(cellOf(delayHeader)),
        priority: Math.round(parseNumber(cellOf(priorityHeader), 0)),
        channels: parseChannels(cellOf(channelHeader)),
        source: "sheet",
        row: rowNumber,
        note: cellOf(noteHeader),
        extra,
      }),
    );
  });

  return { rules, skipped, warnings };
}

const SETTINGS_ALIASES: Array<{ aliases: string[]; apply: (settings: AppSettings, value: string) => void }> = [
  {
    aliases: ["auto_reply_enabled", "autoreply", "auto_reply", "aktif"],
    apply: (s, v) => {
      s.autoReplyEnabled = parseBool(v, s.autoReplyEnabled);
    },
  },
  {
    aliases: ["welcome_message", "welcome", "pesan_sambutan", "pesan_pembuka"],
    apply: (s, v) => {
      s.welcomeMessage = v;
    },
  },
  {
    aliases: ["default_reply", "default", "fallback_reply", "balasan_default"],
    apply: (s, v) => {
      s.defaultReply = v;
    },
  },
  {
    aliases: ["cooldown_minutes", "cooldown", "cooldown_menit"],
    apply: (s, v) => {
      s.cooldownMinutes = Math.max(0, parseNumber(v, s.cooldownMinutes));
    },
  },
  {
    aliases: ["reply_delay_ms", "reply_delay", "jeda_balasan", "delay_default"],
    apply: (s, v) => {
      s.replyDelayMs = Math.max(0, Math.round(parseNumber(v, s.replyDelayMs)));
    },
  },
  {
    aliases: ["active_hours", "jam_aktif", "active_hours_mode"],
    apply: (s, v) => {
      s.activeHours.mode = normalizeKey(v) === "custom" ? "custom" : "always";
    },
  },
  {
    aliases: ["active_hours_start", "start", "mulai", "jam_mulai"],
    apply: (s, v) => {
      if (/^\d{1,2}:\d{2}$/.test(v.trim())) s.activeHours.start = v.trim();
    },
  },
  {
    aliases: ["active_hours_end", "end", "selesai", "jam_selesai"],
    apply: (s, v) => {
      if (/^\d{1,2}:\d{2}$/.test(v.trim())) s.activeHours.end = v.trim();
    },
  },
  {
    aliases: ["contact_policy", "kebijakan_kontak", "contacts"],
    apply: (s, v) => {
      const key = normalizeKey(v);
      if (["whitelist", "only_whitelist"].includes(key)) s.contactPolicy = "whitelist";
      else if (["exclude_blacklist", "blacklist"].includes(key)) s.contactPolicy = "exclude_blacklist";
      else s.contactPolicy = "everyone";
    },
  },
  {
    aliases: ["reply_to_groups", "grup", "groups"],
    apply: (s, v) => {
      s.replyToGroups = parseBool(v, s.replyToGroups);
    },
  },
  {
    aliases: ["channels", "aplikasi", "platforms"],
    apply: (s, v) => {
      const channels = parseChannels(v);
      if (channels.length > 0) s.channels = channels;
    },
  },
  {
    aliases: ["ai_enabled", "ai", "gemini_enabled"],
    apply: (s, v) => {
      s.ai.enabled = parseBool(v, s.ai.enabled);
    },
  },
  {
    aliases: ["ai_mode", "gemini_mode"],
    apply: (s, v) => {
      s.ai.mode = normalizeKey(v) === "always" ? "always" : "fallback";
    },
  },
  {
    aliases: ["ai_model", "gemini_model"],
    apply: (s, v) => {
      if (v.trim()) s.ai.model = v.trim();
    },
  },
];

export interface ParsedSettings {
  settings: AppSettings;
  applied: string[];
  unknown: string[];
}

export function settingsFromTable(table: Table, base: AppSettings = defaultSettings()): ParsedSettings {
  const settings: AppSettings = JSON.parse(JSON.stringify(base)) as AppSettings;
  const normalizedHeaders = table.headers.map(normalizeKey);
  const keyColumn = normalizedHeaders.indexOf("key") !== -1 ? normalizedHeaders.indexOf("key") : 0;
  const valueColumn =
    normalizedHeaders.indexOf("value") !== -1
      ? normalizedHeaders.indexOf("value")
      : normalizedHeaders.indexOf("nilai") !== -1
        ? normalizedHeaders.indexOf("nilai")
        : 1;

  const applied: string[] = [];
  const unknown: string[] = [];

  for (const cells of table.rows) {
    const rawKey = (cells[keyColumn] ?? "").trim();
    const value = (cells[valueColumn] ?? "").trim();
    if (!rawKey) continue;
    const key = normalizeKey(rawKey);
    const entry = SETTINGS_ALIASES.find((candidate) => candidate.aliases.includes(key));
    if (!entry) {
      unknown.push(rawKey);
      continue;
    }
    entry.apply(settings, value);
    applied.push(rawKey);
  }

  return { settings, applied, unknown };
}

export function buildProgram(input: {
  rulesCsv?: string;
  settingsCsv?: string;
  base: AppSettings;
}): { program: ReplyProgram; warnings: string[]; applied: string[]; unknown: string[] } {
  const warnings: string[] = [];
  let rules: ReplyRule[] = [];
  let applied: string[] = [];
  let unknown: string[] = [];
  let settings = input.base;

  if (input.settingsCsv?.trim()) {
    const parsed = settingsFromTable(parseTable(input.settingsCsv), input.base);
    settings = parsed.settings;
    applied = parsed.applied;
    unknown = parsed.unknown;
    if (unknown.length > 0) {
      warnings.push(`Parameter tidak dikenal di sheet pengaturan: ${unknown.join(", ")}`);
    }
  }

  if (input.rulesCsv?.trim()) {
    const parsedRules = rulesFromTable(parseTable(input.rulesCsv));
    rules = parsedRules.rules;
    warnings.push(...parsedRules.warnings);
  }

  return {
    program: {
      version: PROGRAM_VERSION,
      generatedAt: new Date().toISOString(),
      settings,
      rules,
      whitelist: [],
      blacklist: [],
    },
    warnings,
    applied,
    unknown,
  };
}
