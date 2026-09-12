import {
  Bell,
  Bot,
  CheckCircle2,
  MousePointerClick,
  RefreshCw,
  Send,
  ShieldAlert,
  Smartphone,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, SectionTitle } from "./ui";
import type { WhatsAutoStore } from "../state/useWhatsAuto";

const STEPS = [
  "Izinkan akses notifikasi agar aplikasi bisa membaca pesan masuk WhatsApp/Telegram.",
  "Aktifkan layanan Aksesibilitas supaya balasan bisa diketik otomatis ke ruang chat.",
  "Pastikan “Sinkron spreadsheet” sudah berhasil, lalu program dikirim ke Android.",
  "Biarkan aplikasi berjalan di latar belakang (matikan optimasi baterai untuk aplikasi ini).",
];

function StatusRow({
  label,
  hint,
  ok,
  action,
}: {
  label: string;
  hint: string;
  ok: boolean;
  action: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
      <div className="flex items-start gap-2">
        {ok ? (
          <CheckCircle2 size={16} className="mt-0.5 text-emerald-600" />
        ) : (
          <XCircle size={16} className="mt-0.5 text-rose-500" />
        )}
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-[11px] text-slate-500">{hint}</p>
        </div>
      </div>
      <Button variant={ok ? "ghost" : "primary"} onClick={action}>
        {ok ? "Atur" : "Izinkan"}
      </Button>
    </div>
  );
}

export function AndroidPanel({ store }: { store: WhatsAutoStore }) {
  const { native, permissions, nativeEvents, pushState, pushMessage, program } = store;

  if (!native) {
    return (
      <div className="space-y-3">
        <Card>
          <SectionTitle icon={<Smartphone size={16} />} title="Mode browser" />
          <p className="text-xs text-slate-600">
            Halaman ini sedang dibuka di browser, jadi layanan otomatis Android tidak aktif. Semua fitur lain
            (sinkron spreadsheet, aturan, simulator) tetap berfungsi. Instal file APK di HP Android untuk
            mengaktifkan balasan otomatis.
          </p>
        </Card>
        <Card>
          <SectionTitle title="Cara kerja di Android" />
          <ol className="space-y-2 text-xs text-slate-600">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle
          icon={<ShieldAlert size={16} />}
          title="Izin layanan Android"
          subtitle="Dua izin ini wajib untuk balasan otomatis."
        />
        <div className="space-y-2">
          <StatusRow
            label="Akses notifikasi"
            hint="Membaca pesan masuk dari WhatsApp/Telegram."
            ok={permissions.notificationListener}
            action={() => void store.openPermissionSettings("notification")}
          />
          <StatusRow
            label="Layanan aksesibilitas"
            hint="Mengetik dan mengirim balasan ke ruang chat."
            ok={permissions.accessibility}
            action={() => void store.openPermissionSettings("accessibility")}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<UploadCloud size={16} />} title="Program balasan di Android" />
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Badge tone={permissions.programLoaded ? "emerald" : "amber"}>
            {permissions.programLoaded ? `${permissions.ruleCount} aturan dimuat` : "belum dimuat"}
          </Badge>
          <Badge tone={permissions.automationRunning ? "emerald" : "slate"}>
            {permissions.automationRunning ? "otomasi berjalan" : "otomasi idle"}
          </Badge>
          <Badge tone={pushState === "error" ? "rose" : "slate"}>
            {pushState === "pushing" ? "mengirim…" : pushState === "ok" ? "terkirim" : pushState === "error" ? "gagal" : "menunggu"}
          </Badge>
        </div>
        {pushMessage ? <p className="mt-1.5 text-xs text-slate-600">{pushMessage}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button onClick={() => void store.pushProgram()}>
            <Send size={14} /> Kirim ulang ke Android
          </Button>
          <Button variant="ghost" onClick={() => void store.refreshPermissions()}>
            <RefreshCw size={14} /> Muat ulang status
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Total {program.rules.length} aturan ({program.rules.filter((rule) => rule.active).length} aktif) akan
          dipakai layanan latar belakang, termasuk saat aplikasi ditutup.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle icon={<Bell size={16} />} title="Log layanan Android" subtitle="Aktivitas nyata di perangkat." />
          <Button variant="ghost" onClick={() => void store.clearNativeEvents()}>
            Bersihkan
          </Button>
        </div>
        {nativeEvents.length === 0 ? (
          <EmptyState
            title="Belum ada aktivitas"
            hint="Kirim pesan ke WhatsApp kamu untuk melihat log di sini."
          />
        ) : (
          <ul className="max-h-80 space-y-1.5 overflow-y-auto">
            {nativeEvents.map((event) => (
              <li key={event.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5">
                  {event.kind === "replied" ? (
                    <Bot size={12} className="text-emerald-600" />
                  ) : event.kind === "error" ? (
                    <XCircle size={12} className="text-rose-500" />
                  ) : (
                    <MousePointerClick size={12} className="text-slate-400" />
                  )}
                  <span className="font-semibold text-slate-700">{event.message}</span>
                  <span className="ml-auto text-[10px] text-slate-400">
                    {new Date(event.at).toLocaleTimeString("id-ID", { hour12: false })}
                  </span>
                </div>
                {event.detail ? <p className="mt-0.5 text-slate-500">{event.detail}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
