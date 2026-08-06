/**
 * Хамгийн бага ZIP бичигч — зөвхөн `store` (шахалтгүй).
 *
 * Яагаад номын сан биш вэ: зураг аль хэдийн JPEG буюу шахагдсан тул `deflate`
 * хийхэд файл 1–2% л жижигрээд, оронд нь 30–50KB-ийн хамаарал, CPU нэмнэ.
 * Ажилтанд хэрэгтэй нь ганц товчоор бүх файлаа нэг хавтсаар авах явдал —
 * шахалт биш. Store-only ZIP-ийг Windows Explorer, macOS Finder, `unzip`
 * бүгд асуудалгүй нээнэ.
 *
 * Zip64 дэмждэггүй: нэг архив 4GB-аас хэтрэхгүй гэж үзсэн (60 зураг × 30MB
 * = 1.8GB дээд тал).
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// ── CRC-32 ─────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

export const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

// ── Бичих туслах ───────────────────────────────────────────────────

class Writer {
  private parts: Uint8Array[] = [];
  length = 0;

  push(chunk: Uint8Array): void {
    this.parts.push(chunk);
    this.length += chunk.length;
  }

  /** 16/32 битийн талбарууд бүгд little-endian. */
  u16(value: number): void {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): void {
    this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }

  toBlob(type: string): Blob {
    return new Blob(this.parts as BlobPart[], { type });
  }
}

/** MS-DOS форматын огноо/цаг — 1980 оноос хойш, 2 секундын нарийвчлалтай. */
const dosDateTime = (date: Date): { time: number; day: number } => ({
  time:
    (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  day:
    ((Math.max(1980, date.getFullYear()) - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate(),
});

const utf8 = new TextEncoder();

/**
 * Зөвхөн ASCII нэр — кирилл нэр өгвөл хөтөч бүр өөрөөр тайлдаг.
 *
 * `..` сегментийг мөн хасна: зарим задлагч архив доторх `../` замыг дагаж
 * хавтаснаас гадуур файл бичдэг (Zip Slip).
 */
export const safeEntryName = (name: string): string => {
  const cleaned = name
    .replace(/[^\w.\-/]/g, '_')
    .split('/')
    .filter((part) => part !== '' && part !== '.' && part !== '..')
    .join('/');
  return cleaned || 'file';
};

export function createZip(entries: readonly ZipEntry[], now = new Date()): Blob {
  const body = new Writer();
  const central = new Writer();
  const { time, day } = dosDateTime(now);

  entries.forEach((entry) => {
    const name = utf8.encode(safeEntryName(entry.name));
    const crc = crc32(entry.data);
    const offset = body.length;

    // ── Local file header ──
    body.u32(0x04034b50);
    body.u16(20); // хамгийн бага хувилбар
    body.u16(0x0800); // нэр UTF-8 гэдгийг зааж өгнө
    body.u16(0); // арга: store
    body.u16(time);
    body.u16(day);
    body.u32(crc);
    body.u32(entry.data.length);
    body.u32(entry.data.length);
    body.u16(name.length);
    body.u16(0);
    body.push(name);
    body.push(entry.data);

    // ── Central directory ──
    central.u32(0x02014b50);
    central.u16(20);
    central.u16(20);
    central.u16(0x0800);
    central.u16(0);
    central.u16(time);
    central.u16(day);
    central.u32(crc);
    central.u32(entry.data.length);
    central.u32(entry.data.length);
    central.u16(name.length);
    central.u16(0); // extra
    central.u16(0); // comment
    central.u16(0); // disk
    central.u16(0); // internal attrs
    central.u32(0); // external attrs
    central.u32(offset);
    central.push(name);
  });

  const centralOffset = body.length;
  const centralSize = central.length;

  const end = new Writer();
  end.u32(0x06054b50);
  end.u16(0);
  end.u16(0);
  end.u16(entries.length);
  end.u16(entries.length);
  end.u32(centralSize);
  end.u32(centralOffset);
  end.u16(0);

  return new Blob(
    [body.toBlob(''), central.toBlob(''), end.toBlob('')],
    { type: 'application/zip' },
  );
}

/** Blob-ыг татах — өөр газар ч хэрэглэхээр тусад нь. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Татаж эхлэх хүртэл URL амьд байх ёстой.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
