import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateAiReply } from "../lib/ai";
import { pingBackend, pullParams, pushParams } from "../lib/backend";
import { decideReply, identityKey } from "../lib/engine";
import { AutoReply, isNativePlatform } from "../lib/native";
import { buildProgramFromState, loadState, saveState, type PersistedState } from "../lib/storage";
import { syncFromSheet } from "../lib/sheet-sync";
import type {
  ContactEntry,
  IncomingMessage,
  LogEntry,
  NativeEvent,
  NativePermissions,
  ReplyDecision,
  ReplyProgram,
  ReplyRule,
  BackendConfig,
  SyncState,
} from "../lib/types";

export interface SimulateResult {
  decision: ReplyDecision;
  text: string;
  aiError?: string;
}

const EMPTY_PERMISSIONS: NativePermissions = {
  notificationListener: false,
  accessibility: false,
  programLoaded: false,
  ruleCount: 0,
  automationRunning: false,
  supported: isNativePlatform(),
};

export function useWhatsAuto() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [permissions, setPermissions] = useState<NativePermissions>(EMPTY_PERMISSIONS);
  const [nativeEvents, setNativeEvents] = useState<NativeEvent[]>([]);
  const [pushState, setPushState] = useState<"idle" | "pushing" | "ok" | "error">("idle");
  const [pushMessage, setPushMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const lastReplyAt = useRef<Record<string, number>>({});
  const lastPushed = useRef<string>("");
  const native = isNativePlatform();

  const program: ReplyProgram = useMemo(() => buildProgramFromState(state), [state]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((message: string) => setToast(message), []);

  const update = useCallback((patch: Partial<PersistedState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const updateSettings = useCallback((patch: Partial<PersistedState["settings"]>) => {
    setState((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }, []);

  const updateSheet = useCallback((patch: Partial<PersistedState["sheet"]>) => {
    setState((current) => ({ ...current, sheet: { ...current.sheet, ...patch } }));
  }, []);

  const updateBackend = useCallback((patch: Partial<BackendConfig>) => {
    setState((current) => ({ ...current, backend: { ...current.backend, ...patch } }));
  }, []);

  const updateSync = useCallback((patch: Partial<SyncState>) => {
    setState((current) => ({ ...current, sync: { ...current.sync, ...patch } }));
  }, []);

  /** Kirim program balasan ke layanan native Android. */
  const pushProgram = useCallback(
    async (target: ReplyProgram = program) => {
      if (!native) {
        setPushState("idle");
        setPushMessage("Mode browser: engine berjalan di simulator saja.");
        return;
      }
      setPushState("pushing");
      try {
        const result = await AutoReply.setProgram(target);
        lastPushed.current = JSON.stringify(target);
        setPushState(result.ok ? "ok" : "error");
        setPushMessage(
          result.ok
            ? `${result.ruleCount} aturan aktif di layanan Android.`
            : "Program gagal dikirim ke layanan Android.",
        );
      } catch (error) {
        setPushState("error");
        setPushMessage((error as Error).message);
      }
    },
    [native, program],
  );

  const programSignature = JSON.stringify(program);
  useEffect(() => {
    if (!native) return;
    if (lastPushed.current === programSignature) return;
    void pushProgram(program);
  }, [native, program, programSignature, pushProgram]);

  const refreshPermissions = useCallback(async () => {
    if (!native) {
      setPermissions(EMPTY_PERMISSIONS);
      return;
    }
    try {
      const result = await AutoReply.getPermissions();
      setPermissions(result);
    } catch (error) {
      setPermissions({ ...EMPTY_PERMISSIONS, automationRunning: false });
      setPushMessage((error as Error).message);
    }
  }, [native]);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  // Terima event dari layanan native (balasan terkirim, error otomasi, dsb).
  useEffect(() => {
    if (!native) return;
    let handle: { remove: () => Promise<void> } | undefined;
    let cancelled = false;

    const pull = async () => {
      try {
        const { events } = await AutoReply.getEvents({ limit: 60 });
        if (!cancelled) setNativeEvents(events);
      } catch {
        /* layanan belum siap */
      }
    };

    void AutoReply.addListener("autoReplyEvent", (event) => {
      setNativeEvents((current) => [event, ...current].slice(0, 60));
    }).then((listener) => {
      if (cancelled) {
        void listener.remove();
      } else {
        handle = listener;
      }
    });

    void pull();
    const timer = setInterval(() => {
      void pull();
      void refreshPermissions();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      void handle?.remove();
    };
  }, [native, refreshPermissions]);

  const syncNow = useCallback(
    async (silent = false) => {
      if (!state.sheet.url.trim()) {
        if (!silent) notify("Isi link spreadsheet lebih dulu.");
        return null;
      }
      setSyncing(true);
      const result = await syncFromSheet(state.sheet, state.settings, state.sheet.sheetsApiKey);
      setSyncing(false);

      if (!result.ok || !result.program) {
        updateSync({
          lastSyncAt: new Date().toISOString(),
          lastStatus: "error",
          lastMessage: result.message,
        });
        if (!silent) notify(result.message);
        return result;
      }

      setState((current) => ({
        ...current,
        sheetRules: result.program!.rules,
        settings: result.program!.settings,
        sync: {
          lastSyncAt: new Date().toISOString(),
          lastStatus: "ok",
          lastMessage: result.message,
          rowCount: result.rowCount,
        },
      }));

      if (!silent) notify(result.message);
      return result;
    },
    [notify, state.settings, state.sheet, updateSync],
  );

  // Auto-sync berkala.
  useEffect(() => {
    if (!state.sheet.autoSync || !state.sheet.url.trim()) return;
    const minutes = Math.max(1, state.sheet.syncIntervalMinutes);
    const timer = setInterval(() => {
      void syncNow(true);
    }, minutes * 60_000);
    return () => clearInterval(timer);
  }, [state.sheet.autoSync, state.sheet.syncIntervalMinutes, state.sheet.url, syncNow]);

  /** Cek koneksi ke backend web. */
  const testBackend = useCallback(async () => {
    const result = await pingBackend(state.backend);
    updateBackend({
      lastSyncAt: new Date().toISOString(),
      lastStatus: result.ok ? "ok" : "error",
      lastMessage: result.message,
    });
    notify(result.message);
    return result;
  }, [notify, state.backend, updateBackend]);

  /** Tarik parameter (aturan + settings) dari backend web. */
  const pullFromBackend = useCallback(
    async (silent = false) => {
      const result = await pullParams(state.backend);
      if (!result.ok || !result.params) {
        updateBackend({
          lastSyncAt: new Date().toISOString(),
          lastStatus: "error",
          lastMessage: result.message,
        });
        if (!silent) notify(result.message);
        return result;
      }

      const params = result.params;
      setState((current) => ({
        ...current,
        backendRules: params.rules,
        settings: params.settings,
        whitelist: params.whitelist.length > 0 ? params.whitelist : current.whitelist,
        blacklist: params.blacklist.length > 0 ? params.blacklist : current.blacklist,
        backend: {
          ...current.backend,
          lastSyncAt: new Date().toISOString(),
          lastStatus: "ok",
          lastMessage: result.message,
        },
      }));
      if (!silent) notify(result.message);
      return result;
    },
    [notify, state.backend, updateBackend],
  );

  /** Kirim parameter lokal ke backend web. */
  const pushToBackend = useCallback(async () => {
    const result = await pushParams(state.backend, {
      settings: state.settings,
      rules: [...state.backendRules, ...state.manualRules],
      whitelist: state.whitelist,
      blacklist: state.blacklist,
    });
    updateBackend({
      lastSyncAt: new Date().toISOString(),
      lastStatus: result.ok ? "ok" : "error",
      lastMessage: result.message,
    });
    notify(result.message);
    return result;
  }, [notify, state.backend, state.backendRules, state.manualRules, state.settings, state.whitelist, state.blacklist, updateBackend]);

  // Auto-pull berkala dari backend.
  useEffect(() => {
    if (!state.backend.autoPull || !state.backend.url.trim()) return;
    const minutes = Math.max(1, state.backend.pullIntervalMinutes);
    const timer = setInterval(() => {
      void pullFromBackend(true);
    }, minutes * 60_000);
    return () => clearInterval(timer);
  }, [state.backend.autoPull, state.backend.pullIntervalMinutes, state.backend.url, pullFromBackend]);

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "at">) => {
    setState((current) => ({
      ...current,
      logs: [
        { ...entry, id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString() },
        ...current.logs,
      ].slice(0, 300),
    }));
  }, []);

  /** Jalankan engine persis seperti di perangkat, untuk simulator. */
  const simulate = useCallback(
    async (message: IncomingMessage): Promise<SimulateResult> => {
      const decision = decideReply(program, message, {
        lastReplyAt: lastReplyAt.current,
        now: new Date(),
      });

      let text = decision.text;
      let aiError: string | undefined;

      if (decision.shouldReply && decision.source === "ai") {
        const ai = await generateAiReply(program.settings.ai, message);
        if (ai.ok) {
          text = ai.text;
        } else {
          aiError = ai.error;
          text = program.settings.defaultReply;
        }
      }

      if (decision.shouldReply && text) {
        lastReplyAt.current[identityKey(message)] = Date.now();
      }

      addLog({
        sender: message.sender,
        phone: message.phone,
        channel: message.channel,
        incoming: message.text,
        outgoing: decision.shouldReply ? text : "",
        source: decision.source,
        reason: decision.reason,
        delivered: decision.shouldReply && Boolean(text),
      });

      return { decision, text, aiError };
    },
    [addLog, program],
  );

  const addRule = useCallback((rule: ReplyRule) => {
    setState((current) => ({ ...current, manualRules: [rule, ...current.manualRules] }));
  }, []);

  const updateRule = useCallback((id: string, patch: Partial<ReplyRule>) => {
    setState((current) => ({
      ...current,
      manualRules: current.manualRules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    }));
  }, []);

  const removeRule = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      manualRules: current.manualRules.filter((rule) => rule.id !== id),
    }));
  }, []);

  const addContact = useCallback((list: "whitelist" | "blacklist", entry: ContactEntry) => {
    setState((current) => ({ ...current, [list]: [entry, ...current[list]] }));
  }, []);

  const removeContact = useCallback((list: "whitelist" | "blacklist", id: string) => {
    setState((current) => ({ ...current, [list]: current[list].filter((entry) => entry.id !== id) }));
  }, []);

  const clearLogs = useCallback(() => {
    setState((current) => ({ ...current, logs: [] }));
  }, []);

  const clearNativeEvents = useCallback(async () => {
    if (native) {
      try {
        await AutoReply.clearEvents();
      } catch {
        /* abaikan */
      }
    }
    setNativeEvents([]);
  }, [native]);

  const openPermissionSettings = useCallback(
    async (kind: "notification" | "accessibility") => {
      if (!native) {
        notify("Buka aplikasi di HP Android untuk mengatur izin ini.");
        return;
      }
      try {
        if (kind === "notification") await AutoReply.openNotificationSettings();
        else await AutoReply.openAccessibilitySettings();
      } catch (error) {
        notify((error as Error).message);
      }
      setTimeout(() => void refreshPermissions(), 1200);
    },
    [native, notify, refreshPermissions],
  );

  return {
    native,
    state,
    program,
    permissions,
    nativeEvents,
    pushState,
    pushMessage,
    syncing,
    toast,
    notify,
    update,
    updateSettings,
    updateSheet,
    updateBackend,
    updateSync,
    syncNow,
    testBackend,
    pullFromBackend,
    pushToBackend,
    simulate,
    addRule,
    updateRule,
    removeRule,
    addContact,
    removeContact,
    clearLogs,
    clearNativeEvents,
    pushProgram,
    openPermissionSettings,
    refreshPermissions,
  };
}

export type WhatsAutoStore = ReturnType<typeof useWhatsAuto>;
