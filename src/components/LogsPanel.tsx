import { useMemo, useState } from "react";
import { BarChart3, Download, History, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, SectionTitle, inputClass } from "./ui";
import type { WhatsAutoStore } from "../state/useWhatsAuto";
import { REASON_LABEL } from "../lib/engine";

const SOURCE_TONE: Record<string, "emerald" | "sky" | "amber" | "slate" | "rose"> = {
  sheet: "emerald",
  rule: "sky",
  welcome: "amber",
  default: "slate",
  ai: "amber",
  none: "rose",
};

export function LogsPanel({ store }: { store: WhatsAutoStore }) {
  const { state, clearLogs } = store;
  const [query, setQuery] = useState("");

  const logs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.logs;
    return state.logs.filter((log) =>
      [log.sender, log.phone, log.incoming, log.outgoing, log.channel].join(" ").toLowerCase().includes(needle),
    );
  }, [query, state.logs]);

  const stats = useMemo(() => {
    const replied = state.logs.filter((log) => log.delivered).length;
    const perSource = state.logs.reduce<Record<string, number>>((acc, log) => {
      acc[log.source] = (acc[log.source] ?? 0) + 1;
      return acc;
    }, {});
    return { total: state.logs.length, replied, skipped: state.logs.length - replied, perSource };
  }, [state.logs]);

  const exportCsv = () => {
    const header = "waktu,pengirim,nomor,channel,pesan_masuk,balasan,sumber,alasan,terkirim";
    const lines = state.logs.map((log) =>
      [
        log.at,
        log.sender,
        log.phone,
        log.channel,
        log.incoming,
        log.outgoing,
        log.source,
        log.reason,
        log.delivered ? "ya" : "tidak",
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `whatsauto-log-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle icon={<BarChart3 size={16} />} title="Ringkasan" />
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Total pesan", value: stats.total },
            { label: "Dibalas", value: stats.replied },
            { label: "Dilewati", value: stats.skipped },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-surface-2 px-2 py-3">
              <p className="text-xl font-black text-ink">{item.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(stats.perSource).map(([source, count]) => (
            <Badge key={source} tone={SOURCE_TONE[source] ?? "slate"}>
              {source}: {count}
            </Badge>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <SectionTitle icon={<History size={16} />} title="Log balasan" subtitle={`${logs.length} entri`} />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={exportCsv} disabled={state.logs.length === 0}>
              <Download size={14} /> CSV
            </Button>
            <Button variant="danger" onClick={clearLogs} disabled={state.logs.length === 0}>
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
        <input
          className={`${inputClass} mb-2`}
          placeholder="Cari pengirim / pesan…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {logs.length === 0 ? (
          <EmptyState title="Belum ada log" hint="Coba simulator atau kirim pesan ke WhatsApp kamu." />
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto">
            {logs.map((log) => (
              <li key={log.id} className="rounded-xl border border-line p-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-ink">{log.sender || log.phone}</span>
                  <Badge tone={SOURCE_TONE[log.source] ?? "slate"}>{log.source}</Badge>
                  <span className="text-ink-mute">{log.channel}</span>
                  <span className="ml-auto text-[10px] text-ink-mute">
                    {new Date(log.at).toLocaleString("id-ID", { hour12: false })}
                  </span>
                </div>
                <p className="mt-1.5 text-ink-soft">
                  <span className="font-semibold text-ink-mute">Masuk:</span> {log.incoming}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-ink">
                  <span className="font-semibold text-brand">Balas:</span>{" "}
                  {log.outgoing || `— ${REASON_LABEL[log.reason]}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
