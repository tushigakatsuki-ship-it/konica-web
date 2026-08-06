import assert from 'node:assert/strict';
import test from 'node:test';
import { crc32, safeEntryName } from '../src/lib/zip';

/**
 * Архивын зөв эсэхийг тодорхойлдог хоёр цэвэр хэсгийг шалгана: CRC-32 тооцоо
 * ба бичлэгийн нэрийн цэвэрлэгээ. Толгойн бүтэц зөв эсэхийг `unzip -t`-ээр
 * гараар шалгасан (`createZip` нь `Blob` буцаадаг тул тест дотор задлахад
 * төвөгтэй).
 */

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

test('crc32 нь стандарт утгуудыг өгнө', () => {
  // Сурах бичгийн жишээнүүд — `zlib.crc32`-тэй ижил.
  assert.equal(crc32(bytes('')), 0);
  assert.equal(crc32(bytes('a')), 0xe8b7be43);
  assert.equal(crc32(bytes('abc')), 0x352441c2);
  assert.equal(crc32(bytes('123456789')), 0xcbf43926);
});

test('crc32 нь 32 бит эерэг тоо буцаана', () => {
  const value = crc32(new Uint8Array(1024).fill(0xff));
  assert.ok(Number.isInteger(value));
  assert.ok(value >= 0 && value <= 0xffffffff);
});

test('safeEntryName нь замын халдлагыг таслана', () => {
  assert.equal(safeEntryName('../../etc/passwd'), 'etc/passwd');
  assert.equal(safeEntryName('/absolute/path.jpg'), 'absolute/path.jpg');
  assert.equal(safeEntryName('a/./b/../c.jpg'), 'a/b/c.jpg');
  assert.equal(safeEntryName('PMN-260806-4821/01_10x15_print.jpg'), 'PMN-260806-4821/01_10x15_print.jpg');
  assert.equal(safeEntryName('зураг.jpg'), '_____.jpg');
  assert.equal(safeEntryName(''), 'file');
});
