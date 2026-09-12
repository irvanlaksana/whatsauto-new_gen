/**
 * Tipe data inti WhatsAuto.
 *
 * Semua struktur di sini JSON-serializable karena objek `ReplyProgram`
 * dikirim apa adanya ke sisi native Android (NotificationListenerService +
 * AccessibilityService) supaya balasan tetap berjalan saat UI ditutup.
 */

export type MatchType = "exact" | "contains" | "regex";

export type ChannelId =
  | "whatsapp"
  | "whatsapp_business"
  | "telegram"
  | "instagram"
  | "sms";

export interface ChannelDef {
  id: ChannelId;
  label: string;
  packageNames: string[];
  accent: string;
}

export const CHANNELS: ChannelDef[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    packageNames: ["com.whatsapp"],
    accent: "emerald",
  },
  {
    id: "whatsapp_business",
    label: "WhatsApp Business",
    packageNames: ["com.whatsapp.w4b"],
    accent: "teal",
  },
  {
    id: "telegram",
    label: "Telegram",
    packageNames: ["org.telegram.messenger", "org.telegram.plus"],
    accent: "sky",
  },
  {
    id: "instagram",
    label: "Instagram DM",
    packageNames: ["com.instagram.android"],
    accent: "fuchsia",
  },
  {
    id: "sms",
    label: "SMS / Pesan",
    packageNames: ["com.google.android.apps.messaging", "com.samsung.android.messaging"],
    accent: "indigo",
  },
];

export function channelOfPackage(packageName: string): ChannelId | null {
  for (const channel of CHANNELS) {
    if (channel.packageNames.includes(packageName)) return channel.id;
  }
  return null;
}

/** Baris balasan — bisa berasal dari spreadsheet maupun dibuat manual di aplikasi. */
export interface ReplyRule {
  id: string;
  keyword: string;
  matchType: MatchType;
  reply: string;
  active: boolean;
  /** null = memakai jeda global dari settings.replyDelayMs. */
  delayMs: number | null;
  priority: number;
  /** Kosong = berlaku untuk semua channel yang aktif. */
  channels: ChannelId[];
  source: "sheet" | "manual";
  row?: number;
  note?: string;
  /** Kolom tambahan dari spreadsheet, dipakai sebagai variabel {nama_kolom}. */
  extra: Record<string, string>;
}

export interface ContactEntry {
  id: string;
  name: string;
  phone: string;
  note?: string;
}

export interface ActiveHours {
  mode: "always" | "custom";
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface AiSettings {
  enabled: boolean;
  /** fallback = AI hanya dipakai bila tidak ada aturan yang cocok. */
  mode: "fallback" | "always";
  apiKey: string;
  model: string;
  persona: string;
}

export interface AppSettings {
  autoReplyEnabled: boolean;
  welcomeMessage: string;
  defaultReply: string;
  cooldownMinutes: number;
  replyDelayMs: number;
  activeHours: ActiveHours;
  contactPolicy: "everyone" | "whitelist" | "exclude_blacklist";
  replyToGroups: boolean;
  channels: ChannelId[];
  ai: AiSettings;
}

export interface SheetSource {
  url: string;
  /** Nama sheet / tab berisi aturan keyword → balasan. */
  rulesSheet: string;
  /** Nama sheet / tab berisi parameter key-value. Kosong = tidak dipakai. */
  settingsSheet: string;
  autoSync: boolean;
  syncIntervalMinutes: number;
  /** API key Google (opsional) untuk sheet yang tidak dibagikan publik. */
  sheetsApiKey: string;
}

export interface SyncState {
  lastSyncAt: string | null;
  lastStatus: "idle" | "ok" | "error";
  lastMessage: string;
  rowCount: number;
}

/** Paket lengkap yang dipakai mesin balasan (web + native). */
export interface ReplyProgram {
  version: number;
  generatedAt: string;
  settings: AppSettings;
  rules: ReplyRule[];
  whitelist: ContactEntry[];
  blacklist: ContactEntry[];
}

export interface IncomingMessage {
  sender: string;
  phone: string;
  text: string;
  channel: ChannelId;
  isGroup: boolean;
  isFirstMessage: boolean;
  /** ISO string; default = sekarang. Dipakai native & test. */
  at?: string;
}

export type DecisionSource =
  | "rule"
  | "sheet"
  | "welcome"
  | "default"
  | "ai"
  | "none";

export type DecisionReason =
  | "matched"
  | "welcome"
  | "default"
  | "ai"
  | "disabled"
  | "channel_off"
  | "outside_hours"
  | "blacklisted"
  | "not_whitelisted"
  | "cooldown"
  | "group_ignored"
  | "no_match";

export interface ReplyDecision {
  shouldReply: boolean;
  text: string;
  source: DecisionSource;
  reason: DecisionReason;
  ruleId?: string;
  delayMs: number;
}

export interface LogEntry {
  id: string;
  at: string;
  sender: string;
  phone: string;
  channel: ChannelId;
  incoming: string;
  outgoing: string;
  source: DecisionSource;
  reason: DecisionReason;
  delivered: boolean;
}

/** Event mentah yang dikirim layanan native ke UI. */
export interface NativeEvent {
  id: string;
  at: string;
  kind: "incoming" | "replied" | "skipped" | "automation" | "error";
  message: string;
  detail?: string;
}

export interface NativePermissions {
  notificationListener: boolean;
  accessibility: boolean;
  programLoaded: boolean;
  ruleCount: number;
  automationRunning: boolean;
  supported: boolean;
}
