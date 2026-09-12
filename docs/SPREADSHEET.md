# Format Google Spreadsheet

Aplikasi membaca dua tab dari satu dokumen Google Spreadsheet. Nama tab bisa diubah di
aplikasi (tab **Spreadsheet**); default-nya `Balasan` dan `Parameter`.

## 1. Tab aturan (`Balasan`)

Baris pertama = header. Nama kolom **tidak case-sensitive**, spasi/underscore diabaikan,
dan alias berikut dikenali:

| Kolom wajib | Alias yang dikenali |
| --- | --- |
| `keyword` | `kata kunci`, `trigger`, `pesan masuk`, `key`, `pesan` |
| `reply` | `balasan`, `jawaban`, `response`, `pesan balasan`, `isi` |

| Kolom opsional | Alias | Nilai |
| --- | --- | --- |
| `match` | `tipe`, `jenis` | `contains` (default), `exact`, `regex` |
| `active` | `aktif`, `status` | `TRUE`/`FALSE`, `1`/`0`, `ya`/`tidak` |
| `delay_ms` | `jeda` | angka milidetik; kosong = pakai jeda global |
| `priority` | `prioritas`, `urutan` | angka; makin besar makin dulu dicocokkan |
| `channel` | `platform`, `aplikasi` | `whatsapp`, `whatsapp_business`, `telegram`, `instagram`, `sms` (pisahkan dengan koma; kosong = semua) |
| `note` | `catatan`, `keterangan` | bebas, hanya untuk dokumentasi |

**Kolom lain apa pun** (mis. `produk`, `harga`, `tanggal_promo`) otomatis menjadi variabel
di dalam teks balasan: `{produk}`, `{harga}`, `{tanggal_promo}`.

Contoh:

```csv
keyword,match,reply,active,delay_ms,priority,produk,harga
menu,contains,"Daftar layanan:\n1. Harga\n2. Jam buka\n3. Alamat",TRUE,500,10,,
harga,contains,"Harga {produk} Rp {harga} ya Kak {sender} 😊",TRUE,0,5,Paket Hemat,125000
jam,contains,"Kami buka 08.00-22.00 WIB setiap hari.",TRUE,0,0,,
alamat,contains,"Alamat: Jl. Merdeka No. 45, Jakarta Selatan.",TRUE,0,0,,
admin,exact,"Sebentar ya, admin akan segera membalas.",TRUE,1200,0,,
```

## 2. Tab parameter (`Parameter`)

Format dua kolom `key` / `value`:

| key | contoh value | keterangan |
| --- | --- | --- |
| `auto_reply_enabled` | `true` | saklar utama |
| `welcome_message` | `Halo {sender}…` | dikirim ke pengirim yang baru pertama kali chat |
| `default_reply` | `Maaf belum dikenali…` | bila tidak ada aturan cocok |
| `cooldown_minutes` | `2` | jeda minimal antar balasan ke pengirim yang sama |
| `reply_delay_ms` | `800` | jeda "mengetik" sebelum kirim |
| `active_hours` | `always` / `custom` | mode jam aktif |
| `active_hours_start` | `08:00` | dipakai bila mode `custom` |
| `active_hours_end` | `22:00` | boleh melewati tengah malam (mis. `22:00`–`02:00`) |
| `contact_policy` | `everyone` / `whitelist` / `exclude_blacklist` | kebijakan penerima |
| `reply_to_groups` | `false` | balas pesan grup atau tidak |
| `channels` | `whatsapp,whatsapp_business` | aplikasi yang dipantau |
| `ai_enabled` | `false` | aktifkan Gemini |
| `ai_mode` | `fallback` / `always` | kapan AI dipakai |
| `ai_model` | `gemini-2.0-flash` | model Gemini |

Parameter yang tidak dikenal tidak menghentikan sinkronisasi — hanya dilaporkan sebagai
peringatan di aplikasi.

## 3. Variabel di dalam balasan

| Variabel | Isi |
| --- | --- |
| `{sender}` / `{nama}` | nama pengirim |
| `{phone}` / `{nomor}` | nomor (bila tersedia) |
| `{received_msg}` / `{pesan}` | pesan yang masuk |
| `{time}` / `{jam}` | `14:05` |
| `{date}` / `{tanggal}` | `11/09/2026` |
| `{datetime}` | `11/09/2026 14:05` |
| `{day}` / `{hari}` | `Jumat` |
| `{channel}` / `{platform}` | `whatsapp`, `telegram`, … |
| `{nama_kolom}` | nilai kolom lain dari baris sheet yang cocok |

Variabel yang tidak dikenal dibiarkan apa adanya (tidak dihapus).

## 4. Cara engine memilih balasan

Urutan pemeriksaan (identik di simulator dan di perangkat):

1. saklar auto-reply → 2. channel aktif → 3. jam aktif → 4. grup diizinkan →
5. blacklist → 6. whitelist → 7. cooldown → 8. AI `always` → 9. pesan sambutan →
10. aturan (prioritas ↓, lalu `exact` → `contains` → `regex`) → 11. AI `fallback` →
12. balasan default → 13. tidak dibalas.

Aturan dari spreadsheet dan aturan manual digabung; bila prioritas dan tipe cocoknya sama,
aturan dari spreadsheet menang.

## 5. Cara berbagi sheet

- **Publik (tanpa API key):** Share → *Anyone with the link* → *Viewer*. Aplikasi mengambil
  `https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&sheet=<NamaTab>`.
- **Privat:** buat API key Google (API Sheets diaktifkan) lalu isi di aplikasi. Aplikasi
  memakai Sheets API v4 `values/<NamaTab>!A1:Z1000`.

Di Android permintaan HTTP dijalankan oleh kode native, jadi tidak ada masalah CORS.
