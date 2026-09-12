import { describe, expect, it } from "vitest";
import { decideReply, identityKey, normalizePhone, sortRules, withinActiveHours } from "../src/lib/engine";
import { emptyProgram, rule, seedRules } from "../src/lib/defaults";
import type { IncomingMessage, ReplyProgram } from "../src/lib/types";

function message(partial: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    sender: "Budi",
    phone: "+6281234567890",
    text: "halo",
    channel: "whatsapp",
    isGroup: false,
    isFirstMessage: false,
    ...partial,
  };
}

function program(partial: Partial<ReplyProgram> = {}): ReplyProgram {
  return { ...emptyProgram(), rules: seedRules(), ...partial };
}

describe("decideReply", () => {
  it("membalas dengan aturan spreadsheet/manual yang cocok", () => {
    const decision = decideReply(program(), message({ text: "boleh lihat menu?" }));
    expect(decision.shouldReply).toBe(true);
    expect(decision.reason).toBe("matched");
    expect(decision.ruleId).toBe("seed_menu");
    expect(decision.text).toContain("Ini daftar layanan kami");
  });

  it("mengganti variabel bawaan dan kolom tambahan", () => {
    const prog = program({
      rules: [
        rule({
          keyword: "harga",
          reply: "Halo {sender}, harga {produk} Rp {harga} per {date}.",
          extra: { produk: "Kopi Susu", harga: "18.000" },
        }),
      ],
    });
    const decision = decideReply(prog, message({ sender: "Siti", text: "harga berapa?" }), {
      now: new Date(2026, 4, 10, 9, 30),
    });
    expect(decision.text).toBe("Halo Siti, harga Kopi Susu Rp 18.000 per 10/05/2026.");
  });

  it("memakai pesan sambutan hanya untuk pesan pertama", () => {
    const prog = program();
    const first = decideReply(prog, message({ isFirstMessage: true, text: "harga" }));
    expect(first.source).toBe("welcome");
    const next = decideReply(prog, message({ isFirstMessage: false, text: "harga" }));
    expect(next.source).toBe("rule");
  });

  it("jatuh ke balasan default bila tidak ada aturan cocok", () => {
    const decision = decideReply(program(), message({ text: "asdfghjkl" }));
    expect(decision.source).toBe("default");
    expect(decision.reason).toBe("default");
  });

  it("menghormati saklar utama, channel, dan jam aktif", () => {
    const base = program();
    const disabled = decideReply(
      { ...base, settings: { ...base.settings, autoReplyEnabled: false } },
      message(),
    );
    expect(disabled.reason).toBe("disabled");

    const wrongChannel = decideReply(base, message({ channel: "telegram" }));
    expect(wrongChannel.reason).toBe("channel_off");

    const night = decideReply(
      {
        ...base,
        settings: {
          ...base.settings,
          activeHours: { mode: "custom", start: "08:00", end: "10:00" },
        },
      },
      message({ text: "menu" }),
      { now: new Date(2026, 4, 10, 23, 15) },
    );
    expect(night.reason).toBe("outside_hours");
  });

  it("memblokir blacklist dan menegakkan whitelist", () => {
    const base = program();
    const blocked = decideReply(
      { ...base, blacklist: [{ id: "b", name: "Spam", phone: "+6281234567890" }] },
      message(),
    );
    expect(blocked.reason).toBe("blacklisted");

    const notListed = decideReply(
      {
        ...base,
        settings: { ...base.settings, contactPolicy: "whitelist" as const },
        whitelist: [{ id: "w", name: "Orang Lain", phone: "+628999" }],
      },
      message(),
    );
    expect(notListed.reason).toBe("not_whitelisted");

    const listed = decideReply(
      {
        ...base,
        settings: { ...base.settings, contactPolicy: "whitelist" as const },
        whitelist: [{ id: "w", name: "Budi", phone: "081234567890" }],
      },
      message(),
    );
    expect(listed.shouldReply).toBe(true);
  });

  it("menerapkan cooldown per nomor", () => {
    const base = program();
    const now = new Date(2026, 4, 10, 12, 0);
    const first = decideReply(base, message({ text: "menu" }), { now });
    expect(first.shouldReply).toBe(true);

    const second = decideReply(base, message({ text: "menu" }), {
      now: new Date(now.getTime() + 60_000),
      lastReplyAt: { [normalizePhone("+6281234567890")]: now.getTime() },
    });
    expect(second.reason).toBe("cooldown");

    const afterCooldown = decideReply(base, message({ text: "menu" }), {
      now: new Date(now.getTime() + 3 * 60_000),
      lastReplyAt: { [normalizePhone("+6281234567890")]: now.getTime() },
    });
    expect(afterCooldown.shouldReply).toBe(true);
  });

  it("mengabaikan pesan grup kecuali diizinkan", () => {
    const base = program();
    expect(decideReply(base, message({ isGroup: true, text: "menu" })).reason).toBe("group_ignored");
    const allowed = decideReply(
      { ...base, settings: { ...base.settings, replyToGroups: true } },
      message({ isGroup: true, text: "menu" }),
    );
    expect(allowed.shouldReply).toBe(true);
  });

  it("menyerahkan ke AI saat mode always/fallback", () => {
    const base = program();
    const always = decideReply(
      { ...base, settings: { ...base.settings, ai: { ...base.settings.ai, enabled: true, mode: "always" as const } } },
      message({ text: "menu" }),
    );
    expect(always.source).toBe("ai");

    const fallback = decideReply(
      { ...base, settings: { ...base.settings, ai: { ...base.settings.ai, enabled: true, mode: "fallback" as const } } },
      message({ text: "zzz tidak dikenal" }),
    );
    expect(fallback.source).toBe("ai");
  });
});

describe("identityKey", () => {
  it("memakai nomor bila ada, nama bila tidak", () => {
    expect(identityKey(message({ phone: "081234567890" }))).toBe("6281234567890");
    expect(identityKey(message({ phone: "", sender: "Budi Santoso" }))).toBe("budi santoso");
  });

  it("cooldown tetap jalan untuk pesan tanpa nomor (kasus notifikasi Android)", () => {
    const prog = program();
    const now = new Date(2026, 4, 10, 12, 0);
    const incoming = message({ phone: "", sender: "Rina", text: "menu" });

    expect(decideReply(prog, incoming, { now }).shouldReply).toBe(true);
    const again = decideReply(prog, incoming, {
      now: new Date(now.getTime() + 30_000),
      lastReplyAt: { [identityKey(incoming)]: now.getTime() },
    });
    expect(again.reason).toBe("cooldown");
  });
});

describe("prioritas & pencocokan", () => {
  it("mengurutkan exact sebelum contains pada prioritas sama", () => {
    const rules = sortRules([
      rule({ id: "c", keyword: "menu", matchType: "contains", reply: "contains" }),
      rule({ id: "e", keyword: "menu", matchType: "exact", reply: "exact" }),
    ]);
    expect(rules.map((r) => r.id)).toEqual(["e", "c"]);
  });

  it("prioritas lebih tinggi menang", () => {
    const prog = program({
      rules: [
        rule({ id: "low", keyword: "harga", reply: "murah", priority: 1 }),
        rule({ id: "high", keyword: "harga", reply: "premium", priority: 9 }),
      ],
    });
    expect(decideReply(prog, message({ text: "harga?" })).ruleId).toBe("high");
  });

  it("aturan nonaktif dan aturan channel lain dilewati", () => {
    const prog = program({
      rules: [
        rule({ id: "off", keyword: "menu", reply: "x", active: false }),
        rule({ id: "tg", keyword: "menu", reply: "x", channels: ["telegram"] }),
        rule({ id: "ok", keyword: "menu", reply: "ya", priority: -5 }),
      ],
    });
    expect(decideReply(prog, message({ text: "menu" })).ruleId).toBe("ok");
  });

  it("mendukung regex dan tidak crash pada regex rusak", () => {
    const prog = program({
      rules: [rule({ id: "re", keyword: "^(hai|halo)$", matchType: "regex", reply: "hai juga" })],
    });
    expect(decideReply(prog, message({ text: "Hai" })).ruleId).toBe("re");

    const broken = program({ rules: [rule({ id: "bad", keyword: "([", matchType: "regex", reply: "x" })] });
    expect(decideReply(broken, message({ text: "([ whatever" })).reason).toBe("default");
  });
});

describe("withinActiveHours", () => {
  const settings = emptyProgram().settings;

  it("rentang melewati tengah malam", () => {
    const nightShift = {
      ...settings,
      activeHours: { mode: "custom" as const, start: "22:00", end: "02:00" },
    };
    expect(withinActiveHours(nightShift, new Date(2026, 4, 10, 23, 30))).toBe(true);
    expect(withinActiveHours(nightShift, new Date(2026, 4, 10, 1, 30))).toBe(true);
    expect(withinActiveHours(nightShift, new Date(2026, 4, 10, 12, 0))).toBe(false);
  });
});
