-- Printmn вэб захиалгын Postgres схем
--
-- Одоогийн хадгалалт нь Cloudflare R2 дээрх JSON manifest (`api/_store/r2Store.ts`).
-- Энэ файл бол **шилжих зорилтот схем**: `api/_store/postgres.ts` бичихэд
-- `WebOrderStore` интерфейсийг эдгээр хүснэгт дээр хэрэгжүүлнэ.
--
-- ⚠️ ЗУРГИЙН ФАЙЛ ЭНД ОРОХГҮЙ. Файл нь объект санд (R2/S3/MinIO) үлдэнэ —
-- хэдэн MB-ийн JPEG-ийг Postgres-д хийвэл нөөцлөлт, репликаци хямд биш болж,
-- дамжуулалт удаашрана. Хүснэгтэд зөвхөн ТҮЛХҮҮР (`storage_key`) хадгална.
--
-- Ажиллуулах:  psql "$DATABASE_URL" -f docs/schema.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- Захиалга
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS web_order (
  id              bigserial PRIMARY KEY,

  -- Хэрэглэгчид харагдах дугаар: PMN-260806-4821
  order_number    text        NOT NULL UNIQUE,

  -- Хэрэглэгчийн «түлхүүр». Захиалгын дугаарыг таасан ч үүнгүйгээр захиалга
  -- уншигдахгүй (`/api/payment`, `/zakhialga/<дугаар>` хоёулаа шалгадаг).
  upload_id       text        NOT NULL,

  -- Улаанбаатарын огноо. UTC-ээр авбал шөнийн 00:00–08:00-д ирсэн захиалга
  -- өмнөх өдрөөр бичигдэж, өдрийн самбараас унана.
  order_date      date        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  customer_name   text        NOT NULL,
  customer_phone  text        NOT NULL,
  customer_email  text        NOT NULL DEFAULT '',
  customer_note   text        NOT NULL DEFAULT '',

  -- Мөнгийг ЗААВАЛ бүхэл төгрөгөөр. `float` ашиглавал нэгтгэл дээр цент
  -- алдагдаж, өдрийн касс таарахаа болино.
  total           integer     NOT NULL CHECK (total >= 0),

  printed_at      timestamptz,

  -- Давхар захиалгаас хамгаалах (`/api/order` дээрх idempotency). Одоо энэ нь
  -- edge instance-ийн санах ойд байгаа тул бүрэн баталгаа биш — SQL руу
  -- шилжихэд UNIQUE индекс нь ЖИНХЭНЭ баталгаа болно.
  request_id      text,

  CONSTRAINT web_order_upload_id_format CHECK (upload_id ~ '^[a-km-np-z2-9]{16}$'),
  CONSTRAINT web_order_number_format    CHECK (order_number ~ '^PMN-[0-9]{6}-[0-9]{4}$')
);

-- Ажилтны хуудас өдрөөр жагсаадаг.
CREATE INDEX IF NOT EXISTS web_order_date_idx ON web_order (order_date DESC, created_at DESC);

-- R2 дээр байхгүй байсан боломж: утсаар хайх.
CREATE INDEX IF NOT EXISTS web_order_phone_idx ON web_order (customer_phone);

-- Idempotency-г өгөгдлийн сангийн түвшинд баталгаажуулна.
CREATE UNIQUE INDEX IF NOT EXISTS web_order_request_id_key
  ON web_order (request_id) WHERE request_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- Захиалгын мөр (үйлчилгээ × тоо)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS web_order_line (
  id           bigserial PRIMARY KEY,
  order_id     bigint  NOT NULL REFERENCES web_order (id) ON DELETE CASCADE,

  -- `src/data/catalog.ts` доторх id. Каталог өөрчлөгдвөл нэр нь хэвээр
  -- үлдэхийн тулд `name`-ийг ХУУЛЖ хадгална (түүхэн баримт).
  service_id   integer NOT NULL,
  name         text    NOT NULL,
  qty          integer NOT NULL CHECK (qty > 0),
  unit_price   integer NOT NULL CHECK (unit_price >= 0),
  total        integer NOT NULL CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS web_order_line_order_idx ON web_order_line (order_id);

-- ─────────────────────────────────────────────────────────────────────
-- Зургийн файл (метадата л; байт нь объект санд)
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE web_file_kind AS ENUM ('print', 'original');

CREATE TABLE IF NOT EXISTS web_order_file (
  id           bigserial PRIMARY KEY,
  order_id     bigint        NOT NULL REFERENCES web_order (id) ON DELETE CASCADE,

  -- Объект сан дахь зам: uploads/2026-08-06/<uploadId>/01-print.jpg
  storage_key  text          NOT NULL UNIQUE,
  kind         web_file_kind NOT NULL,

  -- Ажилтанд татахад харагдах нэр: 01_10x15_2sh_print.jpg
  file_name    text          NOT NULL,
  size_bytes   bigint        NOT NULL CHECK (size_bytes > 0),
  size_label   text          NOT NULL,
  service_id   integer       NOT NULL,
  qty          integer       NOT NULL CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS web_order_file_order_idx ON web_order_file (order_id);

-- ─────────────────────────────────────────────────────────────────────
-- Төлбөр
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE web_payment_status AS ENUM ('pending', 'paid');
CREATE TYPE web_payment_method AS ENUM ('qpay', 'manual');

-- Захиалга тутамд НЭГ төлбөрийн бичлэг (1:1).
-- Хэсэгчилсэн төлөлт, буцаалт нэмэгдвэл энэ хүснэгтийг 1:N болгож,
-- `web_order` дээр `paid_total` нэмэх нь зөв алхам болно.
CREATE TABLE IF NOT EXISTS web_payment (
  order_id    bigint             PRIMARY KEY REFERENCES web_order (id) ON DELETE CASCADE,
  status      web_payment_status NOT NULL DEFAULT 'pending',
  amount      integer            NOT NULL CHECK (amount >= 0),
  method      web_payment_method,

  -- QPay-ийн нэхэмжлэлийн id — callback ирэхэд шалгахад.
  invoice_id  text,
  paid_at     timestamptz,
  note        text,

  -- Төлөгдсөн бол хэзээ, ямар аргаар гэдэг нь ЗААВАЛ бөглөгдсөн байна.
  CONSTRAINT web_payment_paid_complete
    CHECK (status <> 'paid' OR (paid_at IS NOT NULL AND method IS NOT NULL))
);

-- QPay callback нь `invoice_id`-аар хайдаг.
CREATE UNIQUE INDEX IF NOT EXISTS web_payment_invoice_idx
  ON web_payment (invoice_id) WHERE invoice_id IS NOT NULL;

-- Ажилтны хуудас «төлбөр хүлээгдэж байгаа» захиалгыг эхэлж хардаг.
CREATE INDEX IF NOT EXISTS web_payment_pending_idx
  ON web_payment (status) WHERE status = 'pending';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- SQL рүү шилжсэнээр нээгдэх боломжууд (R2 дээр хийх аргагүй байсан)
-- ─────────────────────────────────────────────────────────────────────
--
-- Өдрийн орлого:
--   SELECT order_date, count(*), sum(total)
--     FROM web_order o JOIN web_payment p ON p.order_id = o.id
--    WHERE p.status = 'paid'
--    GROUP BY order_date ORDER BY order_date DESC;
--
-- Хамгийн их захиалагддаг хэмжээ (POPULAR_IDS-ийг таамгаар биш өгөгдлөөр):
--   SELECT size_label, sum(qty) AS sheets
--     FROM web_order_file WHERE kind = 'print'
--    GROUP BY size_label ORDER BY sheets DESC;
--
-- Утсаар хайх:
--   SELECT * FROM web_order WHERE customer_phone = '99001234' ORDER BY created_at DESC;
--
-- Төлөгдөөгүй хуучин захиалгыг цэвэрлэх (файлыг нь устгахын өмнө):
--   SELECT o.order_number, f.storage_key
--     FROM web_order o
--     JOIN web_payment p ON p.order_id = o.id
--     JOIN web_order_file f ON f.order_id = o.id
--    WHERE p.status = 'pending' AND o.created_at < now() - interval '30 days';
