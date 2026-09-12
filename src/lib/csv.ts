/**
 * Parser CSV/TSV kecil tanpa dependensi.
 * Mendukung: kutip ganda, kutip di-escape (""), baris multi-line di dalam kutip,
 * CRLF/LF, serta deteksi pemisah otomatis (koma, titik koma, tab).
 */

export interface Table {
  headers: string[];
  rows: string[][];
}

export function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : ",";
}

export function parseDelimited(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const sep = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function parseTable(input: string, delimiter?: string): Table {
  const matrix = parseDelimited(input, delimiter);
  if (matrix.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = matrix;
  return { headers: headers.map((h) => h.trim()), rows };
}
