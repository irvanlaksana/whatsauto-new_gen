import type {
  AppSettings,
  ContactEntry,
  IncomingMessage,
  MatchType,
  ReplyDecision,
  ReplyProgram,
  ReplyRule,
} from "./types";
import { renderTemplate } from "./variables";

/**
 * Mesin penentu balasan.
 *
 * Fungsi ini murni (pure) sehingga mudah diuji dan menjadi satu-satunya acuan
 * perilaku. Versi Java-nya (`android/.../engine/ReplyEngine.java`) mengikuti
 * urutan langkah yang sama persis — bila logika di sini diubah, ubah juga di
 * sana agar hasil di perangkat tetap identik.
 */

export interface EngineContext {
  /** Epoch ms balasan terakhir per nomor, untuk cooldown. */
  lastReplyAt?: Record<string, number>;
  now?: Date;
}

const MATCH_RANK: Record<MatchType, number> = { exact: 0, contains: 1, regex: 2 };

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

/**
 * Kunci identitas pengirim: nomor bila tersedia, selain itu pakai nama.
 * Notifikasi Android umumnya tidak membawa nomor telepon.
 */
export function identityKey(message: IncomingMessage): string {
  const phone = normalizePhone(message.phone);
  return phone || message.sender.trim().toLowerCase();
}

export function isSameContact(entry: ContactEntry, message: IncomingMessage): boolean {
  const phone = normalizePhone(entry.phone);
  if (phone && normalizePhone(message.phone) === phone) return true;
  const name = entry.name.trim().toLowerCase();
  return name.length > 0 && name === message.sender.trim().toLowerCase();
}

export function sortRules(rules: ReplyRule[]): ReplyRule[] {
  return [...rules]
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => {
      if (b.rule.priority !== a.rule.priority) return b.rule.priority - a.rule.priority;
      const rank = MATCH_RANK[a.rule.matchType] - MATCH_RANK[b.rule.matchType];
      if (rank !== 0) return rank;
      return a.index - b.index;
    })
    .map((entry) => entry.rule);
}

export function matchesRule(rule: ReplyRule, message: IncomingMessage): boolean {
  const input = message.text.trim();
  const lowerInput = input.toLowerCase();
  const keyword = rule.keyword.trim();
  if (!keyword) return false;

  switch (rule.matchType) {
    case "exact":
      return lowerInput === keyword.toLowerCase();
    case "contains":
      return lowerInput.includes(keyword.toLowerCase());
    case "regex": {
      try {
        return new RegExp(keyword, "i").test(input);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

function skip(reason: ReplyDecision["reason"], detail = ""): ReplyDecision {
  return { shouldReply: false, text: detail, source: "none", reason, delayMs: 0 };
}

/** Cek jam aktif; mendukung rentang yang melewati tengah malam (mis. 22:00-02:00). */
export function withinActiveHours(settings: AppSettings, now: Date): boolean {
  if (settings.activeHours.mode !== "custom") return true;
  const toMinutes = (value: string): number => {
    const [h, m] = value.split(":").map((part) => Number.parseInt(part, 10));
    if (Number.isNaN(h)) return 0;
    return h * 60 + (Number.isNaN(m) ? 0 : m);
  };
  const current = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(settings.activeHours.start);
  const end = toMinutes(settings.activeHours.end);
  if (start === end) return true;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

export function decideReply(
  program: ReplyProgram,
  message: IncomingMessage,
  context: EngineContext = {},
): ReplyDecision {
  const { settings } = program;
  const now = context.now ?? (message.at ? new Date(message.at) : new Date());
  const delay = settings.replyDelayMs;

  // 1. Saklar utama.
  if (!settings.autoReplyEnabled) return skip("disabled");

  // 2. Channel/aplikasi aktif.
  if (!settings.channels.includes(message.channel)) return skip("channel_off");

  // 3. Jam operasional.
  if (!withinActiveHours(settings, now)) return skip("outside_hours");

  // 4. Grup.
  if (message.isGroup && !settings.replyToGroups) return skip("group_ignored");

  // 5. Blacklist selalu menang.
  if (program.blacklist.some((entry) => isSameContact(entry, message))) {
    return skip("blacklisted");
  }

  // 6. Kebijakan kontak.
  if (
    settings.contactPolicy === "whitelist" &&
    !program.whitelist.some((entry) => isSameContact(entry, message))
  ) {
    return skip("not_whitelisted");
  }

  // 7. Cooldown per nomor agar tidak membalas berulang.
  if (settings.cooldownMinutes > 0) {
    const last = context.lastReplyAt?.[identityKey(message)] ?? 0;
    if (last > 0 && now.getTime() - last < settings.cooldownMinutes * 60_000) {
      return skip("cooldown");
    }
  }

  const extraFor = (rule: ReplyRule) => rule.extra ?? {};

  // 8. AI selalu (bila diaktifkan, teks diisi belakangan oleh pemanggil).
  if (settings.ai.enabled && settings.ai.mode === "always") {
    return { shouldReply: true, text: "", source: "ai", reason: "ai", delayMs: delay };
  }

  // 9. Pesan sambutan untuk kontak baru.
  if (message.isFirstMessage && settings.welcomeMessage.trim()) {
    return {
      shouldReply: true,
      text: renderTemplate(settings.welcomeMessage, message, {}, now),
      source: "welcome",
      reason: "welcome",
      delayMs: delay,
    };
  }

  // 10. Aturan (dari spreadsheet maupun manual).
  for (const rule of sortRules(program.rules)) {
    if (!rule.active) continue;
    if (rule.channels.length > 0 && !rule.channels.includes(message.channel)) continue;
    if (!matchesRule(rule, message)) continue;
    return {
      shouldReply: true,
      text: renderTemplate(rule.reply, message, extraFor(rule), now),
      source: rule.source === "sheet" ? "sheet" : "rule",
      reason: "matched",
      ruleId: rule.id,
      delayMs: rule.delayMs ?? delay,
    };
  }

  // 11. AI sebagai fallback.
  if (settings.ai.enabled && settings.ai.mode === "fallback") {
    return { shouldReply: true, text: "", source: "ai", reason: "ai", delayMs: delay };
  }

  // 12. Balasan default.
  if (settings.defaultReply.trim()) {
    return {
      shouldReply: true,
      text: renderTemplate(settings.defaultReply, message, {}, now),
      source: "default",
      reason: "default",
      delayMs: delay,
    };
  }

  return skip("no_match");
}

export const REASON_LABEL: Record<ReplyDecision["reason"], string> = {
  matched: "Cocok dengan aturan",
  welcome: "Pesan sambutan",
  default: "Balasan default",
  ai: "Dijawab AI",
  disabled: "Auto-reply nonaktif",
  channel_off: "Channel tidak aktif",
  outside_hours: "Di luar jam aktif",
  blacklisted: "Nomor diblokir",
  not_whitelisted: "Bukan whitelist",
  cooldown: "Cooldown aktif",
  group_ignored: "Pesan grup diabaikan",
  no_match: "Tidak ada aturan cocok",
};
