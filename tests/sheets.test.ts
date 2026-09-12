import { describe, expect, it } from "vitest";
import { detectDelimiter, parseDelimited, parseTable } from "../src/lib/csv";
import { buildProgram, rulesFromTable, settingsFromTable } from "../src/lib/sheet-mapping";
import { buildApiUrl, buildCsvUrl, extractGid, extractSheetId } from "../src/lib/sheet-sync";
import { SAMPLE_SETTINGS_CSV, SAMPLE_SHEET_CSV, defaultSettings } from "../src/lib/defaults";
import { decideReply } from "../src/lib/engine";
import { normalizeKey, renderTemplate } from "../src/lib/variables";

describe("parser CSV", () => {
  it("mendeteksi pemisah otomatis", () => {
    expect(detectDelimiter("a,b,c")).toBe(",");
    expect(detectDelimiter("a;b;c")).toBe(";");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
  });

  it("menangani kutip, koma di dalam sel, dan baris baru", () => {
    const rows = parseDelimited(`keyword,reply\nharga,"Rp 10,000\nbaris kedua"\nkosong,x`);
    expect(rows).toHaveLength(3);
    expect(rows[1][1]).toBe("Rp 10,000\nbaris kedua");
  });

  it("melewati baris kosong", () => {
    const table = parseTable("keyword,reply\nmenu,halo\n\n\njam,08.00\n");
    expect(table.rows).toHaveLength(2);
  });
});

describe("pemetaan spreadsheet → program", () => {
  it("membaca aturan dari header berbahasa Indonesia/Inggris", () => {
    const csv = "Kata Kunci;Tipe;Balasan;Aktif;Jeda;Prioritas;Produk;Harga\nharga;contains;Harga {produk} {harga};TRUE;500;5;Kopi;18000";
    const { rules, warnings } = rulesFromTable(parseTable(csv, ";"));
    expect(warnings).toHaveLength(0);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      keyword: "harga",
      matchType: "contains",
      active: true,
      delayMs: 500,
      priority: 5,
      source: "sheet",
      row: 2,
    });
    expect(rules[0].extra).toEqual({ produk: "Kopi", harga: "18000" });
  });

  it("menandai baris tanpa balasan dan header yang salah", () => {
    const missing = rulesFromTable(parseTable("a,b\n1,2"));
    expect(missing.rules).toHaveLength(0);
    expect(missing.warnings[0]).toContain("tidak ditemukan");

    const emptyReply = rulesFromTable(parseTable("keyword,reply\nmenu,\njam,08.00"));
    expect(emptyReply.rules).toHaveLength(1);
    expect(emptyReply.warnings[0]).toContain("reply kosong");
  });

  it("membaca parameter dari sheet key-value", () => {
    const parsed = settingsFromTable(parseTable(SAMPLE_SETTINGS_CSV), defaultSettings());
    expect(parsed.applied).toContain("cooldown_minutes");
    expect(parsed.settings.cooldownMinutes).toBe(2);
    expect(parsed.settings.activeHours).toEqual({ mode: "custom", start: "08:00", end: "22:00" });
    expect(parsed.settings.channels).toEqual(["whatsapp", "whatsapp_business"]);
    expect(parsed.settings.welcomeMessage).toContain("{sender}");
  });

  it("end-to-end: CSV contoh → program → keputusan balasan", () => {
    const { program, warnings } = buildProgram({
      rulesCsv: SAMPLE_SHEET_CSV,
      settingsCsv: SAMPLE_SETTINGS_CSV,
      base: defaultSettings(),
    });
    expect(warnings).toHaveLength(0);
    expect(program.rules).toHaveLength(5);

    const decision = decideReply(
      program,
      {
        sender: "Rina",
        phone: "+6281200001111",
        text: "harga berapa ya?",
        channel: "whatsapp",
        isGroup: false,
        isFirstMessage: false,
      },
      { now: new Date(2026, 4, 10, 9, 0) },
    );
    expect(decision.source).toBe("sheet");
    expect(decision.text).toBe("Harga Paket Hemat Rp 125000 ya Kak Rina 😊");
    expect(decision.delayMs).toBe(0);
  });
});

describe("URL spreadsheet", () => {
  const url =
    "https://docs.google.com/spreadsheets/d/1AbC-2_xYz9KLMNOPqrst/edit#gid=1234567890";

  it("mengambil id sheet dan gid dari berbagai format link", () => {
    expect(extractSheetId(url)).toBe("1AbC-2_xYz9KLMNOPqrst");
    expect(extractSheetId("1AbC-2_xYz9KLMNOPqrst")).toBe("1AbC-2_xYz9KLMNOPqrst");
    expect(extractSheetId("https://docs.google.com/spreadsheets/u/0/d/1AbC-2_xYz9KLMNOPqrst/edit")).toBe(
      "1AbC-2_xYz9KLMNOPqrst",
    );
    expect(extractSheetId("bukan link")).toBeNull();
    expect(extractGid(url)).toBe("1234567890");
  });

  it("membangun URL CSV dan API", () => {
    expect(buildCsvUrl("ID123", "Balasan")).toBe(
      "https://docs.google.com/spreadsheets/d/ID123/gviz/tq?tqx=out%3Acsv&sheet=Balasan",
    );
    expect(buildApiUrl("ID123", "Balasan!A1:Z1000", "KEY")).toContain(
      "https://sheets.googleapis.com/v4/spreadsheets/ID123/values/Balasan!A1%3AZ1000?key=KEY",
    );
  });
});

describe("variabel", () => {
  it("menormalkan nama kolom menjadi kunci variabel", () => {
    expect(normalizeKey("Tanggal Promo")).toBe("tanggal_promo");
    expect(normalizeKey("Harga (Rp)")).toBe("harga_rp");
    expect(normalizeKey("  Nama Lengkap ")).toBe("nama_lengkap");
  });

  it("membiarkan variabel tak dikenal apa adanya", () => {
    const text = renderTemplate(
      "Halo {sender}, {tidak_ada}",
      {
        sender: "Dewi",
        phone: "+628",
        text: "hai",
        channel: "whatsapp",
        isGroup: false,
        isFirstMessage: false,
      },
      {},
      new Date(2026, 0, 2, 8, 5),
    );
    expect(text).toBe("Halo Dewi, {tidak_ada}");
  });
});
