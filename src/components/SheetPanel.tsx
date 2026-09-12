import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, SectionTitle, Toggle, inputClass } from "./ui";
import type { WhatsAutoStore } from "../state/useWhatsAuto";
import { SAMPLE_SETTINGS_CSV, SAMPLE_SHEET_CSV } from "../lib/defaults";
import { extractSheetId } from "../lib/sheet-sync";

function formatWhen(iso: string | null): string {
  if (!iso) return "belum pernah";
  return new Date(iso).toLocaleString("id-ID", { hour12: false });
}

export function SheetPanel({ store }: { store: WhatsAutoStore }) {
  const { state, updateSheet, syncNow, syncing } = store;
  const { sheet, sync, sheetRules } = state;
  const [showSample, setShowSample] = useState(false);

  const sheetId = extractSheetId(sheet.url);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      store.notify("Contoh disalin ke clipboard.");
    } catch {
      store.notify("Browser menolak akses clipboard.");
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle
          icon={<FileSpreadsheet size={16} />}
          title="Sumber spreadsheet"
          subtitle="Semua parameter balasan dibaca dari sheet ini."
        />
        <div className="space-y-2">
          <Field
            label="Link Google Spreadsheet"
            hint={sheetId ? `Sheet ID terbaca: ${sheetId}` : "Contoh: https://docs.google.com/spreadsheets/d/…/edit"}
          >
            <input
              className={inputClass}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={sheet.url}
              onChange={(event) => updateSheet({ url: event.target.value })}
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Tab aturan (keyword → balasan)">
              <input
                className={inputClass}
                value={sheet.rulesSheet}
                onChange={(event) => updateSheet({ rulesSheet: event.target.value })}
              />
            </Field>
            <Field label="Tab parameter (key → value)" hint="Kosongkan bila tidak dipakai">
              <input
                className={inputClass}
                value={sheet.settingsSheet}
                onChange={(event) => updateSheet({ settingsSheet: event.target.value })}
              />
            </Field>
          </div>
          <Field
            label="Google API key (opsional)"
            hint="Hanya perlu bila sheet tidak dibagikan publik."
          >
            <input
              className={inputClass}
              type="password"
              placeholder="AIza…"
              value={sheet.sheetsApiKey}
              onChange={(event) => updateSheet({ sheetsApiKey: event.target.value })}
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Toggle
              checked={sheet.autoSync}
              onChange={(value) => updateSheet({ autoSync: value })}
              label="Sinkron otomatis"
              description="Tarik ulang sheet secara berkala saat aplikasi berjalan."
            />
            <Field label="Interval (menit)">
              <input
                className={inputClass}
                type="number"
                min={1}
                max={1440}
                value={sheet.syncIntervalMinutes}
                onChange={(event) =>
                  updateSheet({ syncIntervalMinutes: Math.max(1, Number(event.target.value) || 1) })
                }
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void syncNow()} disabled={syncing || !sheet.url.trim()}>
              <RefreshCw size={14} className={syncing ? "animate-spin" : undefined} />
              {syncing ? "Menyinkronkan…" : "Sinkron sekarang"}
            </Button>
            <Button variant="ghost" onClick={() => setShowSample((value) => !value)}>
              <Clipboard size={14} /> Contoh isi sheet
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                window.open(
                  "https://docs.google.com/spreadsheets/create",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <ExternalLink size={14} /> Buat sheet baru
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Status sinkronisasi" />
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Badge tone={sync.lastStatus === "error" ? "rose" : sync.lastStatus === "ok" ? "emerald" : "slate"}>
            {sync.lastStatus === "error" ? "gagal" : sync.lastStatus === "ok" ? "sukses" : "menunggu"}
          </Badge>
          <span className="text-slate-500">Terakhir: {formatWhen(sync.lastSyncAt)}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{sync.rowCount} baris terbaca</span>
        </div>
        <p className="mt-1.5 text-xs text-slate-600">{sync.lastMessage}</p>
        {sheetRules.length > 0 ? (
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={13} /> {sheetRules.length} aturan dari sheet siap dipakai engine.
          </p>
        ) : null}
      </Card>

      <Card>
        <SectionTitle title="Pratinjau aturan dari sheet" subtitle="Hasil parsing terakhir." />
        {sheetRules.length === 0 ? (
          <EmptyState
            title="Belum ada aturan dari spreadsheet"
            hint="Isi link sheet lalu tekan “Sinkron sekarang”."
          />
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Baris</th>
                  <th className="px-2 py-1.5">Keyword</th>
                  <th className="px-2 py-1.5">Tipe</th>
                  <th className="px-2 py-1.5">Balasan</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sheetRules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-2 py-1.5 text-slate-400">{rule.row}</td>
                    <td className="px-2 py-1.5 font-semibold text-slate-800">{rule.keyword}</td>
                    <td className="px-2 py-1.5 text-slate-500">{rule.matchType}</td>
                    <td className="max-w-[220px] truncate px-2 py-1.5 text-slate-600">{rule.reply}</td>
                    <td className="px-2 py-1.5">
                      <Badge tone={rule.active ? "emerald" : "slate"}>{rule.active ? "aktif" : "off"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showSample ? (
        <Card>
          <SectionTitle
            icon={<AlertTriangle size={16} />}
            title="Format sheet yang dikenali"
            subtitle="Salin ke Google Sheets, lalu bagikan sebagai “Siapa saja yang memiliki link”."
          />
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Tab “Balasan” (aturan)
                </span>
                <Button variant="soft" onClick={() => void copy(SAMPLE_SHEET_CSV)}>
                  Salin CSV
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-emerald-100">
                {SAMPLE_SHEET_CSV}
              </pre>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Tab “Parameter” (pengaturan)
                </span>
                <Button variant="soft" onClick={() => void copy(SAMPLE_SETTINGS_CSV)}>
                  Salin CSV
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-emerald-100">
                {SAMPLE_SETTINGS_CSV}
              </pre>
            </div>
            <p className="text-[11px] text-slate-500">
              Kolom tambahan apa pun (mis. <code className="rounded bg-slate-100 px-1">produk</code>,{" "}
              <code className="rounded bg-slate-100 px-1">harga</code>) otomatis menjadi variabel{" "}
              <code className="rounded bg-slate-100 px-1">{"{produk}"}</code> di dalam teks balasan.
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
