# Backend web untuk parameter

Backend opsional (Express) yang menyimpan parameter balasan di server, sehingga bisa
diatur lewat browser tanpa menyentuh Google Spreadsheet.

```bash
npm run server                      # http://localhost:8787
PORT=9000 npm run server            # ganti port
PARAMS_FILE=/var/lib/whatsauto.json npm run server   # ganti lokasi penyimpanan
```

Data disimpan sebagai satu dokumen JSON (`server-data/params.json`, gitignored).

## Bentuk dokumen parameter

```json
{
  "version": 3,
  "updatedAt": "2026-09-12T01:04:25.091Z",
  "settings": {
    "autoReplyEnabled": true,
    "welcomeMessage": "Halo {sender}, salam dari backend web",
    "defaultReply": "Maaf belum dikenali, ketik menu.",
    "cooldownMinutes": 3,
    "replyDelayMs": 900,
    "activeHours": { "mode": "custom", "start": "08:00", "end": "21:00" },
    "contactPolicy": "everyone",
    "replyToGroups": false,
    "channels": ["whatsapp", "whatsapp_business"],
    "ai": { "enabled": false, "mode": "fallback", "apiKey": "", "model": "gemini-2.0-flash", "persona": "ramah" }
  },
  "rules": [
    {
      "id": "backend_harga",
      "keyword": "harga",
      "matchType": "contains",
      "reply": "Harga {produk} Rp {harga} ya {sender}",
      "active": true,
      "delayMs": 0,
      "priority": 5,
      "channels": [],
      "source": "backend",
      "extra": { "produk": "Paket Web", "harga": "99000" }
    }
  ],
  "whitelist": [],
  "blacklist": []
}
```

Kolom `extra` menjadi variabel di dalam balasan (`{produk}`, `{harga}`), sama seperti
kolom tambahan di spreadsheet.

## Endpoint

| Method | Alamat | Keterangan |
| --- | --- | --- |
| `GET` | `/api/health` | `{ ok, time, rules, updatedAt, hasGeminiKey }` |
| `GET` | `/api/params` | Seluruh dokumen parameter |
| `PUT` | `/api/params` | Ganti seluruh dokumen (payload disanitasi server) |
| `POST` | `/api/params/rules` | Tambah satu aturan atau array aturan → `201` |
| `PATCH` | `/api/params/rules/:id` | Ubah sebagian field aturan → `404` bila id tidak ada |
| `DELETE` | `/api/params/rules/:id` | Hapus aturan → `404` bila id tidak ada |
| `POST` | `/api/ai/reply` | Proxy Gemini (`{ message, sender, settings }` → `{ replyText }`) |
| `GET` | `/admin` | Halaman admin (HTML statis, tanpa build step) |

Semua jawaban `/api/*` memakai header `Access-Control-Allow-Origin: *` dan preflight
`OPTIONS` dijawab `204`, jadi bisa dipanggil dari browser maupun dari aplikasi Android
(yang memakai HTTP native sehingga tidak terkena CORS sama sekali).

## Contoh

```bash
# cek hidup
curl http://localhost:8787/api/health

# simpan parameter
curl -X PUT http://localhost:8787/api/params \
  -H 'Content-Type: application/json' \
  -d @params.json

# tambah aturan
curl -X POST http://localhost:8787/api/params/rules \
  -H 'Content-Type: application/json' \
  -d '{"keyword":"ongkir","reply":"Ongkir gratis minggu ini","source":"backend"}'

# matikan satu aturan
curl -X PATCH http://localhost:8787/api/params/rules/backend_2 \
  -H 'Content-Type: application/json' -d '{"active":false}'
```

## Menghubungkan aplikasi

1. Jalankan backend di komputer: `npm run server`.
2. Cari IP komputer (`ipconfig` / `ip a`), pastikan HP dan komputer satu jaringan.
3. Di aplikasi: **Pengaturan → Backend parameter (web) → Alamat backend** =
   `http://<IP-komputer>:8787`, lalu **Tes koneksi** dan **Tarik parameter**.
4. Nyalakan **Tarik otomatis** agar aplikasi mengambil parameter terbaru secara berkala.

Setelah ditarik, parameter masuk ke mesin balasan yang sama dan ikut dikirim ke layanan
Android, jadi tetap dipakai saat aplikasi ditutup.

## Prioritas sumber

Saat beberapa sumber punya aturan dengan prioritas dan tipe pencocokan sama, urutannya:

1. **backend** (diatur admin lewat `/admin`)
2. **spreadsheet** (Google Sheets)
3. **manual** (dibuat di aplikasi)
