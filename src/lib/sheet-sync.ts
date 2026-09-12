import { httpText } from "./http";
import { parseTable } from "./csv";
import { buildProgram } from "./sheet-mapping";
import type { AppSettings, ReplyProgram, SheetSource } from "./types";

/**
 * Membaca Google Spreadsheet.
 *
 * Dua jalur didukung:
 * 1. CSV publik  → https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&sheet=<nama>
 *    (sheet harus dibagikan "Siapa saja yang memiliki link").
 * 2. Sheets API v4 + API key → untuk sheet yang tidak dibagikan publik.
 */

export function extractSheetId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const fromPath = value.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/);
  if (fromPath) return fromPath[1];

  const fromParam = value.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (fromParam) return fromParam[1];

  if (/^[a-zA-Z0-9-_]{15,}$/.test(value)) return value;

  return null;
}

export function extractGid(input: string): string | null {
  const match = input.match(/[?&#]gid=(\d+)/);
  return match ? match[1] : null;
}

export function buildCsvUrl(sheetId: string, sheetName?: string, gid?: string | null): string {
  const params = new URLSearchParams({ tqx: "out:csv" });
  if (sheetName?.trim()) params.set("sheet", sheetName.trim());
  else if (gid) params.set("gid", gid);
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params.toString()}`;
}

export function buildApiUrl(sheetId: string, range: string, apiKey: string): string {
  const encoded = encodeURIComponent(range);
  return `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encoded}?key=${apiKey}`;
}

export interface SyncResult {
  ok: boolean;
  message: string;
  program?: ReplyProgram;
  warnings: string[];
  applied: string[];
  rowCount: number;
  source: "csv" | "api";
}

async function fetchSheetCsv(
  sheetId: string,
  sheetName: string,
  apiKey: string,
): Promise<{ ok: boolean; csv: string; message: string; source: "csv" | "api" }> {
  const csvUrl = buildCsvUrl(sheetId, sheetName, null);
  const csvResponse = await httpText(csvUrl);
  if (csvResponse.ok && csvResponse.body.trim()) {
    return { ok: true, csv: csvResponse.body, message: "OK", source: "csv" };
  }

  if (!apiKey) {
    return {
      ok: false,
      csv: "",
      source: "csv",
      message: csvResponse.error
        ? `Gagal mengambil sheet: ${csvResponse.error}`
        : `Sheet tidak bisa dibaca (status ${csvResponse.status}). Pastikan sheet dibagikan "Siapa saja yang memiliki link" atau isi API key.`,
    };
  }

  const range = sheetName.trim() ? `${sheetName.trim()}!A1:Z1000` : "A1:Z1000";
  const apiResponse = await httpText(buildApiUrl(sheetId, range, apiKey));
  if (!apiResponse.ok) {
    return {
      ok: false,
      csv: "",
      source: "api",
      message: `API Sheets gagal (status ${apiResponse.status}): ${apiResponse.body.slice(0, 200)}`,
    };
  }

  try {
    const payload = JSON.parse(apiResponse.body) as { values?: string[][] };
    const values = payload.values ?? [];
    const csv = values.map((row) => row.map(csvCell).join(",")).join("\n");
    return { ok: true, csv, message: "OK", source: "api" };
  } catch (error) {
    return { ok: false, csv: "", source: "api", message: `Respons API tidak valid: ${(error as Error).message}` };
  }
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function syncFromSheet(
  source: SheetSource,
  base: AppSettings,
  apiKey = "",
): Promise<SyncResult> {
  const sheetId = extractSheetId(source.url);
  if (!sheetId) {
    return {
      ok: false,
      message: "Link spreadsheet tidak dikenali. Tempel link Google Sheets yang lengkap.",
      warnings: [],
      applied: [],
      rowCount: 0,
      source: "csv",
    };
  }

  const rulesFetch = await fetchSheetCsv(sheetId, source.rulesSheet, apiKey);
  if (!rulesFetch.ok) {
    return {
      ok: false,
      message: rulesFetch.message,
      warnings: [],
      applied: [],
      rowCount: 0,
      source: rulesFetch.source,
    };
  }

  let settingsCsv = "";
  const warnings: string[] = [];
  if (source.settingsSheet.trim()) {
    const settingsFetch = await fetchSheetCsv(sheetId, source.settingsSheet, apiKey);
    if (settingsFetch.ok) settingsCsv = settingsFetch.csv;
    else warnings.push(`Sheet parameter tidak terbaca: ${settingsFetch.message}`);
  }

  const built = buildProgram({ rulesCsv: rulesFetch.csv, settingsCsv, base });
  const rowCount = parseTable(rulesFetch.csv).rows.length;

  return {
    ok: true,
    message: `${built.program.rules.length} aturan dimuat dari ${rowCount} baris spreadsheet.`,
    program: built.program,
    warnings: [...built.warnings, ...warnings],
    applied: built.applied,
    rowCount,
    source: rulesFetch.source,
  };
}
