import { useState } from "react";
import {
  BarChart3,
  FileSpreadsheet,
  MessageSquare,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { SimulatorPanel } from "./components/SimulatorPanel";
import { SheetPanel } from "./components/SheetPanel";
import { RulesPanel } from "./components/RulesPanel";
import { ContactsPanel } from "./components/ContactsPanel";
import { AndroidPanel } from "./components/AndroidPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { LogsPanel } from "./components/LogsPanel";
import { useWhatsAuto } from "./state/useWhatsAuto";

type TabId = "simulator" | "sheet" | "rules" | "contacts" | "android" | "settings" | "logs";

const TABS: Array<{ id: TabId; label: string; icon: typeof Sparkles }> = [
  { id: "simulator", label: "Simulator", icon: Sparkles },
  { id: "sheet", label: "Spreadsheet", icon: FileSpreadsheet },
  { id: "rules", label: "Aturan", icon: MessageSquare },
  { id: "contacts", label: "Kontak", icon: ShieldCheck },
  { id: "android", label: "Android", icon: Smartphone },
  { id: "logs", label: "Log", icon: BarChart3 },
  { id: "settings", label: "Pengaturan", icon: SettingsIcon },
];

export default function App() {
  const store = useWhatsAuto();
  const [tab, setTab] = useState<TabId>("sheet");
  const { program, permissions, state } = store;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <MessageSquare size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-black tracking-tight">WhatsAuto Sheet Sync</h1>
            <p className="truncate text-[11px] text-slate-500">
              Balasan otomatis WhatsApp dari parameter Google Spreadsheet
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                program.settings.autoReplyEnabled ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            <span className="text-[11px] font-semibold text-slate-600">
              {program.settings.autoReplyEnabled ? "Aktif" : "Nonaktif"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
              {store.native ? (permissions.notificationListener ? "Android siap" : "izin kurang") : "browser"}
            </span>
          </div>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                }`}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4 pb-16">
        {tab === "simulator" ? <SimulatorPanel store={store} /> : null}
        {tab === "sheet" ? <SheetPanel store={store} /> : null}
        {tab === "rules" ? <RulesPanel store={store} /> : null}
        {tab === "contacts" ? <ContactsPanel store={store} /> : null}
        {tab === "android" ? <AndroidPanel store={store} /> : null}
        {tab === "logs" ? <LogsPanel store={store} /> : null}
        {tab === "settings" ? <SettingsPanel store={store} /> : null}
      </main>

      {store.toast ? (
        <div className="fixed bottom-4 left-1/2 z-30 w-[min(92vw,420px)] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg">
          {store.toast}
        </div>
      ) : null}

      <footer className="mx-auto max-w-4xl px-4 pb-6 text-center text-[11px] text-slate-400">
        {state.sheetRules.length} aturan sheet · {state.manualRules.length} aturan manual · v1.0
      </footer>
    </div>
  );
}
