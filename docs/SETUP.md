# Тохиргоо — тэгээс NAS хүртэл, алхам алхмаар

Энэ бол **нэг удаагийн** тохиргооны жагсаалт. Дарааллыг нь бүү сольж — алхам
бүр өмнөхөөсөө гарсан утгыг ашигладаг.

Нийт хугацаа: **60–90 минут** (Cloudflare-ийн баталгаажуулалт хүлээхийг оруулаад).

Одоогийн байдал: `konica-web.vercel.app` дээр `R2_*` ба `ADMIN_TOKEN` **алга**.
Тиймээс хэрэглэгч зураг оруулж чадахгүй, NAS татах юм ч байхгүй байна. Доорх
жагсаалт тэрийг л засна.

Бүх алхам дуустал вэб дээр захиалга авахгүй байхыг зөвлөнө.

---

## Хэсэг А — Cloudflare R2 (зураг хадгалах сан)

### Алхам 1. Бүртгэл + төлбөрийн карт

1. https://dash.cloudflare.com → Sign up (эсвэл нэвтрэх)
2. Зүүн цэс → **Storage & databases** → **R2** → **Overview**
3. **Purchase R2** / **Subscribe** товч дарна

> ⚠️ **Үнэгүй багцад ч карт заавал хэрэгтэй.** Cloudflare-ийн ажилтны яг үг:
> «The usage is not capped, if you exceed the free allocation on R2 you will be
> charged so a payment method is needed.» Өөрөөр хэлбэл **хэрэглээ таслагддаггүй**
> — 10 GB-ыг давбал автоматаар мөнгө авна. Алхам 5-д хамгаалалт тавина.

Карт холбохыг хүсэхгүй бол → энэ баримтын төгсгөл дэх «Картгүй хувилбар» хэсгийг
үзнэ үү.

### Алхам 2. Бакет үүсгэх

**Create bucket** дарна:

| Талбар | Утга |
| --- | --- |
| Bucket name | `printmn-photos` |
| Location | **Asia-Pacific (APAC)** |
| Storage class | Standard |

> Нэрийг өөрчилбөл Алхам 7-д `R2_BUCKET`-ыг мөн адил бичнэ. Нэр нь дараа
> солигдохгүй.

### Алхам 3. CORS — үүнгүйгээр зураг ОГТ орохгүй

Бакет дотор → **Settings** → **CORS policy** → **Edit** → доорхыг тавина:

```json
[
  {
    "AllowedOrigins": [
      "https://konica-web.vercel.app",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Яагаад чухал вэ: браузер зургийг **шууд R2 руу** PUT хийдэг (Vercel-ийн 4.5MB
хязгаарыг тойрохын тулд). CORS байхгүй бол браузер тэр хүсэлтийг өөрөө хааж,
хэрэглэгчид «зураг байршуулж чадсангүй» гэж гарна.

Өөрийн домэйн (жишээ нь `printmn.mn`) залгах үед тэр хаягийг **энэ жагсаалтад
нэмэхээ бүү мартаарай.**

### Алхам 4. Хугацааны дүрэм (lifecycle)

Бакет → **Settings** → **Object lifecycle rules** → **Add rule**:

| Талбар | Утга |
| --- | --- |
| Rule name | `uploads-90-days` |
| Prefix | `uploads/` |
| Action | Delete objects **90 days** after upload |

Ингэснээр хадгалалт хязгааргүй өсөхгүй. `manifests/` угтварыг **бүү хамруул** —
захиалгын түүх, төлбөрийн бүртгэл тэнд байдаг бөгөөд маш бага зай эзэлдэг.

> ⚠️ 90 хоног өнгөрөхөд R2 дээрх зураг **устана**. NAS дээрх хуулбар цорын ганц
> болно. NAS-аа заавал нөөцөл (Hyper Backup / HBS3). RAID бол нөөцлөлт биш.

### Алхам 5. Мөнгөний хамгаалалт

R2-д «энэ дүнд хүрвэл зогсоо» гэсэн тохиргоо **байхгүй**. Хийж чадах зүйл нь
сэрэмжлүүлэг:

**Manage Account** → **Notifications** → **Add** → `Billing usage alert`

- $10 дээр нэг, $50 дээр нэг — хоёуланг нь тавь
- И-мэйлээ шалгаж баталгаажуул

Хэвийн ачаалалд (өдөрт ~500 зураг, 90 хоногийн дүрэмтэй) сарын зардал **$3–4**
байх ёстой. $10 давбал ямар нэг зүйл буруу байна.

### Алхам 6. API токен

**R2 → Overview** хуудасны баруун талд → **API** → **Manage API tokens** →
**Create Account API token**:

| Талбар | Утга |
| --- | --- |
| Token name | `konica-web` |
| Permissions | **Object Read & Write** |
| Specify bucket(s) | `printmn-photos` (зөвхөн энэ нэгийг) |
| TTL | Forever |

**Create** дарна. Гарч ирэх дэлгэцээс дараах **гурвыг** хуулж ав:

```
Access Key ID          →  R2_ACCESS_KEY_ID
Secret Access Key      →  R2_SECRET_ACCESS_KEY   ← ЗӨВХӨН НЭГ УДАА харагдана
Account ID             →  R2_ACCOUNT_ID          (мөн хаягийн мөрөнд байгаа)
```

Secret-ийг тэр дороо тэмдэглэлдээ хадгал. Дахин харах арга байхгүй — алдвал
шинэ токен үүсгэнэ.

---

## Хэсэг Б — Vercel (сервер)

### Алхам 7. Орчны хувьсагчид

https://vercel.com → `konica-web` төсөл → **Settings** → **Environment Variables**

Дараах хувьсагчдыг нэг бүрчлэн нэмнэ. Орчин: **Production, Preview, Development
гуравт нь** тэмдэглэ.

**Зайлшгүй — үүнгүйгээр зураг огт ажиллахгүй:**

| Нэр | Утга |
| --- | --- |
| `R2_ACCOUNT_ID` | Алхам 6-аас |
| `R2_BUCKET` | `printmn-photos` |
| `R2_ACCESS_KEY_ID` | Алхам 6-аас |
| `R2_SECRET_ACCESS_KEY` | Алхам 6-аас |
| `ADMIN_TOKEN` | Доорх тушаалаар үүсгэнэ |
| `RTDB_AUTH` | Firebase → Project settings → Service accounts → **Database secrets** |

> `RTDB_AUTH` нь захиалгын бүртгэлийн түлхүүр. Үүнгүй бол `/api/order` нь юу ч
> хийхээс өмнө 503 буцаана — хэрэглэгч «Сервер тохируулагдаагүй байна» гэж
> харна. R2 бүрэн байсан ч энэ нэг мөрөөс болж бүх захиалга унана.

`ADMIN_TOKEN`-ыг **гараар бүү бод.** Терминал дээр:

```bash
openssl rand -hex 32
```

Гарсан 64 тэмдэгтийг хуулна. **Зөвхөн латин үсэг, тоо байх ёстой** — кирилл үсэг
орвол NAS-ын скрипт HTTP толгойд тавьж чадахгүй (тусгайлан барьж, ойлгомжтой
алдаа өгдөг болгосон, гэхдээ эхнээсээ зөв байх нь дээр).

**Төлбөр — дор хаяж нэгийг нь:**

| Нэр | Утга |
| --- | --- |
| `BANK_NAME` | `Хаан банк` |
| `BANK_ACCOUNT` | дансны дугаар |
| `BANK_HOLDER` | данс эзэмшигчийн нэр |

эсвэл QPay-тэй бол `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE`,
`QPAY_BASE_URL`.

**Заавал биш, гэхдээ маш хэрэгтэй:**

| Нэр | Юунд | Хаанаас |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Төлбөр орох бүрд утсанд мэдэгдэнэ | Telegram дээр `@BotFather` |
| `TELEGRAM_CHAT_ID` | Хаашаа мэдэгдэх | `@userinfobot` |

Үүнгүй бол ажилтан `/admin` хуудсыг гараар сэргээж хараад суух хэрэгтэй болно.

### Алхам 8. Redeploy

**Хувьсагч нэмэхэд автоматаар ажиллахгүй.** Заавал:

**Deployments** → хамгийн дээд мөрийн `···` → **Redeploy** →
«Use existing Build Cache»-ийг **унтраа** → Redeploy.

2–3 минут хүлээнэ.

---

## Хэсэг В — Шалгах

### Алхам 9. Эрүүл мэндийн хуудас

Браузераар нээ:

```
https://konica-web.vercel.app/api/health
```

Бэлэн бол:

```json
{
  "ok": true,
  "summary": "Бүх зайлшгүй тохиргоо бэлэн — NAS холбож болно.",
  "checks": {
    "storage": { "ready": true,  "detail": "«printmn-photos» бакет, …" },
    "admin":   { "ready": true,  "detail": "ADMIN_TOKEN бөглөгдсөн …" },
    "payment": { "ready": true,  "detail": "Дансны шилжүүлэг бэлэн …" },
    "notify":  { "ready": false, "detail": "Telegram мэдэгдэл унтарсан …" }
  },
  "missing": []
}
```

`ok: false` бол `missing` жагсаалтад **яг ямар хувьсагч дутуу** байгааг нэрлэнэ.
Тэрийг бөглөөд Алхам 8-ыг давтана.

> Энэ хуудас нууц утгыг **хэзээ ч** харуулдаггүй — зөвхөн `true/false`. Токены
> уртыг ч хэлдэггүй.

**Түлхүүр үнэхээр ажиллаж байгааг** шалгах (хувьсагч бөглөгдсөн ≠ утга нь зөв):

```bash
curl -H "x-admin-token: ТӨКӨНӨӨ_ЭНД" \
  "https://konica-web.vercel.app/api/health?deep=1"
```

Энэ нь R2 руу жинхэнэ хүсэлт явуулна. `403` буцвал Access Key буруу, `404`
буцвал бакетын нэр буруу гэдгийг шууд хэлнэ.

### Алхам 10. Жинхэнэ захиалга нэг удаа

Утаснаасаа вэб рүү орж, 10×15 хэмжээгээр 1 зураг захиална.

Шалгах зүйлс:

- [ ] Зураг байршиж дууслаа (CORS зөв → Алхам 3)
- [ ] Захиалгын дугаар гарлаа (R2 бичиж чадсан → Алхам 7)
- [ ] Cloudflare → R2 → `printmn-photos` дотор `uploads/…` болон `manifests/…` гарч ирлээ
- [ ] Telegram мэдэгдэл ирлээ (тохируулсан бол)

Дараа нь төлбөрийг гараар баталгаажуулна:

```bash
curl -X POST "https://konica-web.vercel.app/api/admin" \
  -H "x-admin-token: ТӨКӨНӨӨ_ЭНД" \
  -H "content-type: application/json" \
  -d '{"action":"pay","ref":"manifests/2026-08-19/PMN-...-....json","paid":true}'
```

`ref`-ийг олохын тулд:

```bash
curl -H "x-admin-token: ТӨКӨНӨӨ_ЭНД" \
  "https://konica-web.vercel.app/api/admin?days=1" | head -40
```

---

## Хэсэг Г — NAS

Дэлгэрэнгүй тайлбар, архитектурын шалтгаан `NAS-SETUP.md` дотор. Энд зөвхөн
дараалал.

### Алхам 11. Бэлтгэл

Synology бол Package Center → **Python 3** суулгана. Дараа нь SSH-ээр:

```bash
mkdir -p /volume1/photo/web-orders/_config
python3 --version          # 3.8+ байх ёстой
```

QNAP бол зам нь `/share/photo/web-orders/_config`.

### Алхам 12. Скрипт + тохиргоо

`scripts/nas-sync.py`-г `_config` хавтас руу хуулаад:

```bash
chmod +x /volume1/photo/web-orders/_config/nas-sync.py
```

`_config/nas-sync.env` файл үүсгэж:

```bash
KONICA_API_BASE=https://konica-web.vercel.app
KONICA_ADMIN_TOKEN=PASTE_YOUR_TOKEN_HERE
KONICA_DEST=/volume1/photo/web-orders
KONICA_DAYS=7
```

`PASTE_YOUR_TOKEN_HERE`-ийг Алхам 7-гийн `ADMIN_TOKEN`-оор **яг адилхан** солино.
Дараа нь заавал:

```bash
chmod 600 /volume1/photo/web-orders/_config/nas-sync.env
```

Энэ файл дахь токен нь сүүлийн 31 хоногийн бүх зургийг татах эрхтэй.

### Алхам 13. Шалгах — гурван үе шат

```bash
cd /volume1/photo/web-orders/_config

# 1) Тохиргоо, холболт, токен, дискний бичих эрх
python3 nas-sync.py --check

# 2) Юу татагдахыг харах (файл татахгүй)
python3 nas-sync.py --dry-run

# 3) Жинхэнэ
python3 nas-sync.py
```

`--check` ийм гаралт өгөх ёстой:

```
✓ storage  : «printmn-photos» бакет, …
✓ admin    : ADMIN_TOKEN бөглөгдсөн — NAS холбогдох боломжтой.
✓ payment  : Дансны шилжүүлэг бэлэн …
✗ notify   : Telegram мэдэгдэл унтарсан (заавал биш) …
✓ Токен:   зөв — 1 татах захиалга хүлээгдэж байна …
✓ Хавтас:  бичих эрхтэй — /volume1/photo/web-orders
```

Алхам 10-д баталгаажуулсан захиалгын зураг одоо ирсэн байх ёстой:

```
/volume1/photo/web-orders/2026-08-19/PMN-260819-0001 — Батбаяр/
├── ЗАХИАЛГА.txt
├── 01-print.jpg
└── _эх-файл/
    └── 01-original.jpg
```

### Алхам 14. Автоматжуулах

**Synology** — Control Panel → **Task Scheduler** → Create → Scheduled Task →
User-defined script:

| Талбар | Утга |
| --- | --- |
| Task | `Вэбийн зураг татах` |
| User | `root` |
| Schedule | Daily, **Repeat every 10 minutes**, 00:00–23:59 |
| Run command | `/usr/local/bin/python3 /volume1/photo/web-orders/_config/nas-sync.py` |

Python-ы зам өөр байж болно: `readlink -f $(which python3)`.

**Notification** таб → «Send run details by email» → **only when the script
terminates abnormally**.

**QNAP:**

```bash
echo '*/10 * * * * /opt/bin/python3 /share/photo/web-orders/_config/nas-sync.py >/dev/null 2>&1' \
  >> /etc/config/crontab
crontab /etc/config/crontab && /etc/init.d/crond.sh restart
```

### Алхам 15. Эрх хаах

File Station → `_config` хавтас → Properties → Permission → **ажилтны бүлгээс
хаана**. Ажилтанд зөвхөн `2026-*` хавтаснууд уншигдахад хангалттай — токен
тэдний гарт орох шаардлагагүй.

---

## Дууссаны дараах шалгах хуудас

- [ ] `/api/health` → `ok: true`
- [ ] `?deep=1` → `storage.ready: true` (түлхүүр үнэхээр ажиллаж байна)
- [ ] Утаснаас захиалга өгөөд зураг байршив
- [ ] Cloudflare дээр `uploads/` + `manifests/` объект харагдав
- [ ] Төлбөр баталгаажуулсны дараа NAS дээр хавтас үүсэв
- [ ] `ЗАХИАЛГА.txt` дотор нэр, утас, дүн зөв
- [ ] Task Scheduler 10 минут тутам ажиллаж байна (`_logs/sync.log` өсөж байна)
- [ ] Billing alert идэвхтэй
- [ ] `nas-sync.env` нь `chmod 600`
- [ ] NAS өөрөө өөр газар нөөцлөгдөж байна

---

## Түгээмэл гацаа

**«Зураг байршуулж чадсангүй» — хэрэглэгчийн талд**
CORS. Алхам 3. Бас `konica-web.vercel.app` биш өөр домэйнээр орж байгаа эсэхээ
шалга — CORS нь домэйн бүрээр тусдаа.

**`/api/health` → `ok: false`, гэхдээ хувьсагчийг бөглөсөн**
Redeploy хийгээгүй (Алхам 8). Vercel-ийн хувьсагч зөвхөн ШИНЭ deploy дээр
уншигддаг.

**`?deep=1` → 403**
Токен `Object Read & Write` биш эсвэл өөр бакетад заасан. Алхам 6-г давт.

**NAS: «ADMIN_TOKEN буруу байна (HTTP 401)»**
`nas-sync.env` дэх утга Vercel дээрхтэй зөрж байна. Хоосон зай, хашилт, мөр
таслалт орсон эсэхийг шалга.

**NAS: «латин бус (кирилл) үсэг байна»**
Жишээ утгыг солихоо мартсан. Алхам 12.

**NAS: татах юм байхгүй гэж бичээд байна**
Захиалга нь **төлөгдөөгүй** байна. Систем зориудаар ингэж хийгдсэн: төлбөр
баталгаажтал зураг ажилтанд ФИЗИКЭЭР ирдэггүй. Баталгаажуулбал дараагийн
ажиллалтад ирнэ.

**NAS-ыг дахин суулгасны дараа бүх зураг дахин татагдах уу**
Үгүй. `syncedAt` нь сервер дээр бичигддэг тул `synced.json` алдагдсан ч
давхардахгүй. Санаатай дахин татах бол:

```bash
python3 nas-sync.py --resync PMN-260819-0001
```

---

## Картгүй хувилбар

Cloudflare-т карт холбохыг хүсэхгүй бол хоёр зам:

**1. NAS дээрээ MinIO суулгах.** Synology Container Manager → `minio/minio`.
Дараа нь Vercel дээр `R2_ACCOUNT_ID`-ийн оронд:

```
S3_ENDPOINT=https://s3.printmn.mn:9000
S3_REGION=us-east-1
```

Код өөрчлөгдөхгүй — `api/_r2.ts` нь ердийн SigV4 бичдэг. **Гэхдээ** тогтмол IP,
HTTPS сертификат, порт нээх шаардлагатай болно, бас дэлгүүрийн интернэт эсвэл
цахилгаан унахад **вэб зураг хүлээн авахаа бүрмөсөн болино**. Дэлгүүрийн хувьд
энэ нь бодит эрсдэл.

**2. Backblaze B2.** Мөн S3-нийцтэй, `S3_ENDPOINT` солиод л ажиллана. Хадгалалт
хямд ($0.006/GB) ч **татахад мөнгө авдаг** — ажилтан эх файлыг байнга татдаг тул
R2-оос нийтдээ үнэтэй болох магадлалтай.

Миний зөвлөмж: **R2-ыг сонго, billing alert-аа тавь.** Хэвийн ачаалалд сарын
$3–4 буюу ~12,000₮ — картын эрсдэлээс хамаагүй бага толгойны өвчин.
