# WhatsAuto Sheet Sync

Aplikasi Android (Capacitor) yang membalas pesan WhatsApp/Telegram secara otomatis
**dengan parameter yang dibaca dari Google Spreadsheet** — pola kerja yang sama seperti
aplikasi WhatsAuto: ubah isi sheet, balasan ikut berubah, tanpa rebuild aplikasi.

```
Google Spreadsheet ──(CSV / Sheets API)──▶ Aplikasi Android
                                              │  program balasan (JSON)
                                              ▼
                          NotificationListenerService  ──▶  ReplyEngine (Java)
                                              │
                                              ▼
                          AccessibilityService ──▶ balas otomatis ke ruang chat
```

## Fitur

| Fitur | Keterangan |
| --- | --- |
| Sinkron spreadsheet | Baca aturan `keyword → balasan` + parameter (sambutan, cooldown, jam aktif, channel) dari Google Sheets. Auto-sync berkala + cache lokal. |
| Mesin balasan | Cocok `exact` / `contains` / `regex`, prioritas, jeda per aturan, variabel dinamis, cooldown per pengirim, jam aktif, whitelist/blacklist, opsi abaikan grup. |
| Auto-reply Android asli | `NotificationListenerService` membaca pesan masuk, `AccessibilityService` mengetik & mengirim balasan — tetap jalan saat UI ditutup. |
| Simulator | Uji aturan di dalam aplikasi dengan engine yang sama persis seperti di perangkat. |
| Log & analitik | Riwayat balasan, alasan tidak dibalas, ekspor CSV. |
| AI opsional | Gemini sebagai fallback bila tidak ada aturan yang cocok (butuh API key). |

## Mulai cepat

```bash
npm install
npm run dev          # UI aplikasi  → http://localhost:5173
npm run server       # backend web  → http://localhost:8787 (admin: /admin)
npm test             # 36 unit test (engine, parser sheet, backend, UI)
npm run build        # typecheck + bundle produksi ke dist/
```

### APK jadi

APK debug hasil build GitHub Actions ada di
[`dist-apk/whatsauto-sheet-sync-debug.apk`](dist-apk/whatsauto-sheet-sync-debug.apk)
(4,25 MB, debug-signed — tinggal install di HP Android, izinkan "sumber tidak dikenal").
Setiap push ke branch ini membangun ulang APK dan memperbarui file tersebut lewat commit
`chore(ci): publish APK + gradle log`.

### Build sendiri (butuh JDK 21 + Android SDK)

```bash
npm run android:sync   # build web + cap sync
npm run android:apk    # gradlew assembleDebug → android/app/build/outputs/apk/debug/app-debug.apk
```

Atau lewat GitHub Actions: tab **Actions → Build Android APK → Run workflow**.
Workflow menjalankan: unit test TypeScript → build web → `cap sync` →
**unit test Java native** → `assembleDebug`.

## Backend web untuk mengatur parameter

Selain spreadsheet, parameter bisa diatur lewat backend web yang disediakan repo ini.

```bash
npm run server       # http://localhost:8787
```

| Alamat | Fungsi |
| --- | --- |
| `/admin` | Halaman admin (form parameter + tabel aturan, tanpa build step) |
| `GET /api/health` | Cek backend hidup + jumlah aturan |
| `GET /api/params` | Ambil seluruh parameter (settings, rules, whitelist, blacklist) |
| `PUT /api/params` | Simpan seluruh parameter |
| `POST /api/params/rules` | Tambah aturan |
| `PATCH /api/params/rules/:id` | Ubah satu aturan (mis. `{"active": false}`) |
| `DELETE /api/params/rules/:id` | Hapus aturan |
| `POST /api/ai/reply` | Proxy Gemini (opsional, butuh `GEMINI_API_KEY`) |

Parameter disimpan di `server-data/params.json` (gitignored).

Di aplikasi, buka **Pengaturan → Backend parameter (web)**: isi **Alamat backend**
(mis. `http://192.168.1.10:8787` saat HP dan komputer satu jaringan, atau URL publik
backend kamu), lalu **Tes koneksi** → **Tarik parameter**. Tombol **Kirim parameter**
mengirim isi aplikasi ke backend, dan **Buka /admin** membuka halaman admin.

Urutan pemenang bila prioritas & tipe cocoknya sama: **backend → spreadsheet → manual**.

Detail API: [`docs/BACKEND.md`](docs/BACKEND.md).

## Memakai spreadsheet sebagai sumber parameter

1. Buat Google Spreadsheet dengan dua tab (nama boleh diganti di aplikasi):

   **Tab `Balasan`**

   | keyword | match | reply | active | delay_ms | priority | produk | harga |
   | --- | --- | --- | --- | --- | --- | --- | --- |
   | menu | contains | "Daftar layanan: 1. Harga 2. Jam buka" | TRUE | 500 | 10 | | |
   | harga | contains | Harga {produk} Rp {harga} ya Kak {sender} 😊 | TRUE | 0 | 5 | Paket Hemat | 125000 |

   **Tab `Parameter`**

   | key | value |
   | --- | --- |
   | welcome_message | Halo {sender}, ada yang bisa dibantu? |
   | default_reply | Maaf pesan belum dikenali, ketik *menu*. |
   | cooldown_minutes | 2 |
   | active_hours | custom |
   | active_hours_start | 08:00 |
   | active_hours_end | 22:00 |

2. Bagikan sheet: **Anyone with the link → Viewer**. (Sheet privat tetap bisa, isi
   Google API key di aplikasi.)
3. Di aplikasi, tab **Spreadsheet**: tempel link, tekan **Sinkron sekarang**.
4. Tab **Android**: izinkan *Akses notifikasi* dan *Layanan aksesibilitas*.

Detail lengkap kolom, alias nama kolom, dan daftar variabel ada di
[`docs/SPREADSHEET.md`](docs/SPREADSHEET.md).

## Struktur kode

```
src/
  lib/
    engine.ts        mesin penentu balasan (murni, diuji)
    sheet-mapping.ts spreadsheet → ReplyProgram
    sheet-sync.ts    ambil CSV / Sheets API
    csv.ts           parser CSV/TSV
    variables.ts     substitusi {sender} {harga} …
    storage.ts       persistensi lokal
    ai.ts            Gemini (opsional)
    native.ts        jembatan ke plugin Android
    http.ts          HTTP lintas platform (native = tanpa CORS)
  state/useWhatsAuto.ts  satu sumber kebenaran state aplikasi
  components/*.tsx       panel UI (Simulator, Spreadsheet, Aturan, Kontak, Android, Log, Pengaturan)
tests/                   29 unit test TS: engine, parser sheet, smoke test UI (jsdom)
server/dev-server.ts     server opsional untuk mode web (proxy Gemini + static)
android/app/src/main/java/com/whatsauto/smartai/
  engine/ReplyEngine.java           port Java dari engine.ts
  engine/ReplyProgram.java          model program balasan
  plugin/AutoReplyPlugin.java       plugin Capacitor "AutoReply"
  plugin/AutoReplyStore.java        prefs + ring buffer event
  service/NotificationWatcherService.java
  service/ChatAutomationService.java
android/app/src/test/java/.../engine/ReplyEngineTest.java   17 unit test JVM (tanpa emulator)
```

> **Catatan penting.** `src/lib/engine.ts` dan `ReplyEngine.java` adalah dua implementasi
> dari spesifikasi yang sama. Keduanya punya test sendiri (`tests/engine.test.ts` dan
> `ReplyEngineTest.java`). Bila mengubah urutan logika di satu sisi, ubah juga di sisi
> lainnya agar hasil simulator dan perangkat identik.
>
> Unit test Java berjalan di JVM biasa (tanpa emulator) lewat `./gradlew testDebugUnitTest`
> dan dieksekusi otomatis oleh CI.

## Catatan keamanan & batasan

- Auto-reply memakai AccessibilityService: gunakan hanya untuk akun milik sendiri dan
  patuhi ketentuan WhatsApp. Aplikasi tidak membaca pesan yang bukan untuk fitur ini.
- Balasan AI hanya berjalan saat aplikasi terbuka; di latar belakang Android mesin
  memakai aturan sheet dan balasan default (agar deterministik dan hemat baterai).
- Semua data (aturan, API key, log) disimpan lokal di perangkat.
