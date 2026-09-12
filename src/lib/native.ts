import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { NativeEvent, NativePermissions, ReplyProgram } from "./types";

/**
 * Jembatan ke modul native Android (`AutoReplyPlugin.java`).
 * Saat berjalan di browser, semua fungsi native diganti fallback yang aman
 * sehingga UI tetap bisa dipakai untuk simulasi.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}

export interface HttpRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface AutoReplyPluginApi {
  ping(): Promise<{ ok: boolean; version: string }>;
  getPermissions(): Promise<NativePermissions>;
  openNotificationSettings(): Promise<void>;
  openAccessibilitySettings(): Promise<void>;
  setProgram(program: ReplyProgram): Promise<{ ok: boolean; ruleCount: number }>;
  getProgramInfo(): Promise<{ ruleCount: number; generatedAt: string }>;
  getEvents(options?: { limit?: number }): Promise<{ events: NativeEvent[] }>;
  clearEvents(): Promise<void>;
  request(options: HttpRequest): Promise<HttpResponse>;
  addListener(
    eventName: "autoReplyEvent",
    listener: (event: NativeEvent) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const NOT_NATIVE = "Fitur ini hanya tersedia di aplikasi Android.";

function unsupported(): NativePermissions {
  return {
    notificationListener: false,
    accessibility: false,
    programLoaded: false,
    ruleCount: 0,
    automationRunning: false,
    supported: false,
  };
}

const webImplementation = {
  async ping() {
    return { ok: false, version: "web" };
  },
  async getPermissions(): Promise<NativePermissions> {
    return unsupported();
  },
  async openNotificationSettings(): Promise<void> {
    throw new Error(NOT_NATIVE);
  },
  async openAccessibilitySettings(): Promise<void> {
    throw new Error(NOT_NATIVE);
  },
  async setProgram(): Promise<{ ok: boolean; ruleCount: number }> {
    return { ok: false, ruleCount: 0 };
  },
  async getProgramInfo(): Promise<{ ruleCount: number; generatedAt: string }> {
    return { ruleCount: 0, generatedAt: "" };
  },
  async getEvents(): Promise<{ events: NativeEvent[] }> {
    return { events: [] };
  },
  async clearEvents(): Promise<void> {
    return undefined;
  },
  async request(options: HttpRequest): Promise<HttpResponse> {
    try {
      const response = await fetch(options.url, {
        method: options.method ?? "GET",
        headers: options.headers,
        body: options.body,
      });
      return { ok: response.ok, status: response.status, body: await response.text() };
    } catch (error) {
      return { ok: false, status: 0, body: "", error: (error as Error).message };
    }
  },
  async addListener(): Promise<PluginListenerHandle> {
    return { remove: async () => undefined };
  },
  async removeAllListeners(): Promise<void> {
    return undefined;
  },
};

export const AutoReply = registerPlugin<AutoReplyPluginApi>("AutoReply", {
  web: webImplementation,
});

export const isNativePlatform = () => Capacitor.isNativePlatform();

export { NOT_NATIVE };
