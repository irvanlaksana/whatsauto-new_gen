import { AutoReply, isNativePlatform, type HttpResponse } from "./native";

/**
 * HTTP lintas platform.
 *
 * Di Android permintaan dijalankan oleh kode native (HttpURLConnection) supaya
 * tidak terbentur CORS WebView saat mengambil Google Sheets. Di browser memakai
 * fetch biasa.
 */
export async function httpText(url: string, init?: {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<HttpResponse> {
  if (isNativePlatform()) {
    return AutoReply.request({ url, timeoutMs: 20_000, ...init });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 20_000);
    const response = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.headers,
      body: init?.body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: response.ok, status: response.status, body: await response.text() };
  } catch (error) {
    return { ok: false, status: 0, body: "", error: (error as Error).message };
  }
}
