# Printmn — систем бүтэц

`printmn-expo` (native app) ба `konica-web` (вэб) хоёр **нэг л** Firebase
Realtime Database дээр ажилладаг. Энэ баримт нь захиалгын урсгал болон
`/pmn` доторх өгөгдлийн загварыг тайлбарлана.

> Диаграмууд Mermaid хэлбэртэй — GitHub, VS Code дээр шууд рендэрлэгдэнэ.

---

## 1. Систем бүтэц

```mermaid
flowchart TB
    subgraph clients["Хэрэглэгчид"]
        customer["Үйлчлүүлэгч<br/>(браузер)"]
        staff["Ажилтан / Менежер<br/>(iOS · Android · iPad)"]
    end

    subgraph vercel["Vercel"]
        spa["React SPA<br/>Vite · Tailwind"]
        api["/api/order<br/>Edge Function"]
    end

    subgraph expo["Expo app — printmn-expo"]
        ui["Дэлгэцүүд<br/>Захиалга · Тайлан · Цаг"]
        ctx["DataContext<br/>санах ойн state"]
        cache["AsyncStorage<br/>offline кэш"]
        queue["writeQueue<br/>амжилтгүй бичилтүүд"]
    end

    fb[("Firebase RTDB<br/>/pmn")]
    tg["Telegram bot"]

    customer --> spa
    spa -->|"POST /api/order"| api
    api -->|"PATCH · RTDB_AUTH<br/>серверт нуугдсан"| fb
    api -.->|"мэдэгдэл"| tg

    staff --> ui
    ui <--> ctx
    ctx <--> cache
    ctx -->|"бичилт"| queue
    queue -->|"PUT/DELETE record-level"| fb
    fb -->|"30 сек тутам татна"| ctx

    classDef store fill:#eff6ff,stroke:#1a56db,color:#0f172a
    classDef edge fill:#fff7ed,stroke:#f59e0b,color:#0f172a
    class fb,cache store
    class api,tg edge
```

**Гол зарчим:** browser хэзээ ч Firebase рүү шууд хандахгүй. `RTDB_AUTH` бол
database secret буюу бүрэн admin эрх — bundle-д орвол сайт нээсэн хэн ч
`pmn`-ийг бүхэлд нь уншиж, устгаж чадна.

---

## 2. Вэб захиалгын зам (end-to-end)

```mermaid
sequenceDiagram
    autonumber
    actor U as Үйлчлүүлэгч
    participant W as React SPA
    participant A as /api/order
    participant F as Firebase RTDB
    participant T as Telegram
    participant App as Expo app

    U->>W: Үйлчилгээ сонгож маягт бөглөнө
    W->>W: Клиент талын шалгалт<br/>(нэр, 8 оронтой утас, и-мэйл)
    W->>A: POST { customer, lines[{id, qty}], delivery, vat }

    A->>A: Rate limit (IP, 5/мин)
    A->>A: buildOrder — каталогоос үнийг ДАХИН тооцно

    alt Баталгаажуулалт унасан
        A-->>W: 400 + шалтгаан
        Note over A,F: Firebase рүү огт хандахгүй
    else Зөв
        A->>F: GET worklogs?orderBy="date"&equalTo=өнөөдөр
        F-->>A: Өнөөдрийн мөрүүд → тоо
        A->>A: numberWorkLogs — no дараалал олгоно
        A->>F: PATCH /pmn { "orders/…", "worklogs/…" }<br/>нэг атомик multi-path

        alt Firebase 401/403
            F-->>A: Rules татгалзав
            A-->>W: 500 «Утсаар холбогдоно уу»
        else Амжилттай
            F-->>A: 200
            A-)T: Мэдэгдэл (best-effort)
            A-->>W: 201 { orderNumber, total }
            W->>U: Амжилтын дэлгэц + PMN-YYMMDD-NNNN
        end
    end

    Note over F,App: 30 секунд тутмын sync
    F-->>App: worklogs + orders
    App->>App: visibleWorkLogs(date === өнөөдөр)
    App->>App: newestFirst(no → id)
```

### Яагаад ийм алхмууд вэ

| Алхам | Шалтгаан |
| --- | --- |
| Үнийг сервер дээр дахин тооцох | Клиентэд итгэвэл 500₮-ийн ажлыг 1₮-өөр захиалж болно. Зөвхөн тохиролцооны категорид (`Медаль & Цом`, `Хувцас хэвлэл`) хэрэглэгчийн үнийг хязгаарын дотор хүлээж авна |
| Нэг атомик PATCH | Order, WorkLog-ыг тусад нь PUT хийвэл эхнийх нь орж, хоёр дахь нь унаж, орлого чимээгүй алдагдана |
| `no` дараалал | `newestFirst` эхлээд `no`-гоор эрэмбэлдэг — дугааргүй мөр 0 болж жагсаалтын доод талд орно |
| Огноо Улаанбаатарын цагаар | Vercel UTC-ээр явдаг. Локал огноо авбал шөнийн 00:00–08:00-д ирсэн захиалга өмнөх өдрөөр бичигдэж, `date === today` шүүлтүүрээс унана |
| Тооллыг баталгаажуулалтын дараа | Эс тэгвээс хог хүсэлт бүр Firebase рүү нэмэлт ачаалал үүсгэнэ |

---

## 2.1 Зургийн зам — браузераас зургийн машин хүртэл

Хэрэглэгчийн зураг **Firebase рүү огт ордоггүй**. Cloudflare R2 (S3-тэй
нийцтэй) руу браузераас **шууд** очиж, ажилтан `/admin`-аас татаж авдаг.

```mermaid
sequenceDiagram
    autonumber
    actor U as Үйлчлүүлэгч
    participant W as React SPA
    participant Up as /api/upload
    participant R2 as Cloudflare R2
    participant A as /api/order
    participant F as Firebase RTDB
    actor S as Ажилтан
    participant Ad as /api/admin

    U->>W: Хэмжээ сонгож зургаа оруулна
    W->>W: canvas — цаасны харьцаанд төвөөр тайрч<br/>300dpi хэвлэлийн JPEG үүсгэнэ

    W->>Up: POST { files[{kind, ext, size, type}] }
    Up->>Up: Тоо, хэмжээ, MIME шалгана
    Up->>Up: uploadId үүсгэж ТҮЛХҮҮРийг сервер тодорхойлно
    Up-->>W: { uploadId, date, urls[] }<br/>presigned PUT, 20 мин

    loop Файл бүрээр (print + original)
        W->>R2: PUT uploads/огноо/uploadId/NN-kind.jpg
        R2-->>W: 200
    end

    W->>A: POST { customer, lines, uploadId, date, files[] }
    A->>A: Түлхүүр бүр uploads/огноо/uploadId/ угтвартай эсэх
    A->>F: PATCH orders + worklogs<br/>note дээр «🖼 N зураг вэбээр ирсэн»
    A->>R2: PUT manifests/…json<br/>payment.status = 'pending'
    A-->>W: 201 { orderNumber, total, төлбөрийн заавар }

    Note over U,S: 🔒 Төлбөр баталгаажтал зураг ажилтанд харагдахгүй

    U->>U: QPay QR уншуулах эсвэл данс руу шилжүүлэх
    A->>R2: payment.status = 'paid'<br/>(QPay callback эсвэл ажилтан гараар)

    S->>Ad: GET /api/admin (x-admin-token)
    Ad->>R2: ListObjectsV2 manifests/огноо/
    Ad->>R2: manifest бүрийг унших
    alt Төлөгдсөн
        Ad-->>S: Захиалгууд + presigned GET (1 цаг)
        S->>R2: Зургуудыг татаж ZIP болгоно
        S->>S: Зургийн машинд оруулж хэвлэнэ
    else Төлөөгүй
        Ad-->>S: Захиалга харагдана, линк ОГТ үүсэхгүй
    end
```

### Яагаад ийм байдлаар вэ

| Шийдэл | Шалтгаан |
| --- | --- |
| Браузер R2 руу ШУУД PUT | Vercel function-ий хүсэлтийн бие 4.5MB-аар хязгаарлагдсан. Утсаар авсан нэг зураг л ихэвчлэн үүнээс том тул сервер дундуур явуулах боломжгүй |
| Түлхүүрийг зөвхөн сервер тодорхойлно | Клиентээс ирсэн замд итгэвэл дурын хүн `uploads/…/01-print.jpg`-ыг дарж бичих боломжтой |
| `/api/order` дээр угтварыг шалгана | Эс тэгвээс хэн ч бусдын зургийн түлхүүрийг өөрийн manifest-даа бичээд admin хуудсаар татаж авна |
| Индекс R2 дотроо (`manifests/`) | `database.rules.json` нь native app-ын мэдэлд. Шинэ зангилаа нэмбэл rules татгалзаж, захиалга бүхэлдээ унах эрсдэлтэй |
| Зураг байршсаны ДАРАА захиалга бичнэ | Эсрэг дараалал бол зураг унахад ажилтан зураггүй ажлын мөр хараад хэрэглэгч рүү залгах хэрэг гарна. Ингэвэл хэрэглэгч дахин оролдоод л болно |
| Manifest унасан ч 201 буцаана | Захиалга аль хэдийн Firebase-д орсон. Алдаа буцаавал хэрэглэгч дахин илгээж, орлого давхардана. Оронд нь Telegram дээр анхааруулна |
| `print` + `original` хоёуланг хадгална | Хэрэглэгч гар аргаар тайрдаггүй тул автомат тайралт чухал хэсгийг таслах эрсдэлтэй. Эх файлаас ажилтан дахин бэлдэнэ |
| Bucket нийтэд хаалттай | Бүх хандалт 20 мин (PUT) / 1 цаг (GET) амьдардаг presigned URL-ээр. Линк алдагдсан ч бүхэл сан задрахгүй |
| Төлбөрийн түгжээ нь **линк олгох** үе шат дээр | Интерфейс дээр товч идэвхгүй болгох нь хамгаалалт биш — DevTools нээсэн хэн ч тойрно. Presigned URL нь сервер дээр, төлбөр шалгасны дараа л үүснэ |
| Зураг төлбөрөөс ӨМНӨ байрших | Хэрэглэгч банкны апп руу шилжих үед браузер хаагдвал файл алдагдана. Байршуулчихаад линкийг түгжих нь илүү тэсвэртэй |
| QPay callback-д итгэхгүй, `payment/check` дуудна | Callback бол нийтэд нээлттэй хаяг — хэн ч дуудаж «төлөгдлөө» гэж бичүүлэх боломжтой |

---

## 3. Апп доторх шуурхай захиалга

Харьцуулбал: апп дээр каталогоос дарахад `buildQuickOrder` мөн адил **хос**
бичлэг үүсгэдэг. Ялгаа нь бичилт нь дараалалд ордогт оршино.

```mermaid
sequenceDiagram
    autonumber
    actor S as Ажилтан
    participant O as OrdersScreen
    participant L as orderLogic
    participant C as DataContext
    participant Q as writeQueue
    participant F as Firebase RTDB

    S->>O: Каталогоос үйлчилгээ дарна
    O->>L: buildQuickOrder({ desc, unitPrice, qty, payType })
    L->>L: nextId() × 2 — id давхцахаас сэргийлнэ
    L-->>O: { order, workLog } хосоор

    O->>C: setOrders + setWorkLogs
    C->>C: Санах ой + AsyncStorage шууд шинэчлэгдэнэ
    Note over S,C: UI тэр дороо хариулна — сүлжээ хүлээхгүй

    C->>Q: enqueueRecordWrite('orders', id, …)
    C->>Q: enqueueRecordWrite('worklogs', id, …)

    alt Онлайн
        Q->>F: PUT /pmn/orders/<id>
        Q->>F: PUT /pmn/worklogs/<id>
    else Офлайн
        Q->>Q: Дараалалд хадгална, backoff-оор дахин оролдоно
    end
```

---

## 4. Офлайн бичилтийн дараалал

```mermaid
stateDiagram-v2
    [*] --> Queued: enqueueRecordWrite

    Queued --> Superseded: Ижил record дахин бичигдэв
    Superseded --> [*]

    Queued --> Sending: Онлайн болов
    Sending --> Sent: 200
    Sent --> [*]

    Sending --> Retrying: Сүлжээний алдаа
    Retrying --> Sending: backoff 1с → 5с → 15с → 60с
    Retrying --> Dropped: 6 удаа оролдов
    Dropped --> [*]

    Sending --> Kept: 401 / 403
    Kept --> Kept: Rules татгалзсан — дахин оролдоод ашиггүй

    note right of Kept
        Түр зуурын алдаа vs татгалзсан
        бичилтийг ялгах ёстой: эхнийхийг
        дахин илгээнэ, хоёр дахийг хадгална.
    end note
```

---

## 5. Өгөгдлийн загвар — `/pmn`

Firebase RTDB бол баримт бичгийн сан — **гадаад түлхүүр албадан хэрэгждэггүй**.
Доорх холбоосууд нь кодоор баримталдаг зохицол, сан өөрөө шалгадаггүй.

```mermaid
erDiagram
    ORDERS {
        number id PK "Date.now() суурьтай, nextId()"
        string paymentType "Данс Бэлэн Карт Бусад"
        string desc "Ажлын нэр (тоо ширхэгтэй)"
        number price "Нийт дүн"
        string time "HH_mm"
        string source "web — зөвхөн вэбээс ирсэнд"
        number createdAt "epoch ms, зөвхөн вэб"
        string orderNumber "PMN-YYMMDD-NNNN, зөвхөн вэб"
    }

    WORKLOGS {
        number id PK
        string date "YYYY-MM-DD — indexOn"
        number no "Өдрийн дараалал, эрэмбийн түлхүүр"
        string job
        string price "Тоон утга ч мөр хэлбэрээр"
        string unitPrice
        number quantity
        string payType "indexOn"
        string paymentStatus
        string status "indexOn — Болсон, Маргааш авна…"
        string color "ColorLabel.color руу заана"
        string customer
        string phone
        string note
        string deadline
        string delivery
        boolean isDelivery
        boolean isTomorrow
        boolean hasVat "10% НӨАТ"
        string orderDate "indexOn"
        string agreedPrice "Тохиролцсон үнэ"
        string source "web"
        string orderNumber "Хос ORDERS-тэй холбох цорын ганц утас"
    }

    SERVICES {
        number id PK
        string name "indexOn"
        string price "Дэлгэцийн мөр — 8,500₮"
        string category "indexOn"
        string image
    }

    INVENTORY {
        number id PK
        string name "indexOn"
        string price
        string stock "5 ба доош бол сэрэмжлүүлэг"
        string category "indexOn"
        string image
    }

    LOGS {
        number id PK "Ирцийн бүртгэл"
        string name "indexOn — Employee.name"
        string date "indexOn"
        string month "indexOn — YYYY-MM"
        string time
        string status
        number penalty "Хоцролтын торгууль"
        boolean isLate
        boolean checked
        array completedTasks "HabitTask.id жагсаалт"
        number completedScore
        number totalPossibleScore
    }

    EMPLOYEES {
        number id PK
        string name "indexOn, 1..60 тэмдэгт"
        string pin "яг 4 оронтой"
        array restDays "0=Ням … 6=Бям"
    }

    TASKS {
        number id PK
        string text
        string type "cleaning habit"
        number score "Сарын урамшуулалд оруулах оноо"
        boolean done
    }

    COLORLABELS {
        number id PK
        string color "hex — WorkLog.color-той тааруулна"
        string label
    }

    CALCTYPES {
        number id PK
        string name "Хулдаас Стенд Өргөн_фото"
        number base "м² тутмын суурь үнэ"
    }

    TIMESETTINGS {
        string startTime "HH_mm — ганц бичлэг"
        number penaltyPerMin
        number onTimeScore
        number onLeaveScore
        number workingDays
    }

    CHAT {
        string id PK
        string sender "Менежер iPad эсвэл ажилтны нэр"
        string text "4000 тэмдэгт хүртэл"
        number at "indexOn — epoch ms, эрэмбийн түлхүүр"
        string deviceId "indexOn — эзэмшигчийг тодорхойлно"
        string time
        string image "base64, 400KB хүртэл"
    }

    INVOICES {
        string number PK "Нэхэмжлэхийн дугаарын бүртгэл"
        string deviceId "indexOn"
        number at "indexOn"
        string customer
    }

    ORDERS |o--o| WORKLOGS : "хосоороо үүсдэг (вэбэд orderNumber-ээр холбоотой)"
    WORKLOGS }o--|| SERVICES : "job нэрээр (id-гаар БИШ)"
    WORKLOGS }o--|| COLORLABELS : "color hex-ээр"
    LOGS }o--|| EMPLOYEES : "name-ээр (id-гаар БИШ)"
    LOGS }o--o{ TASKS : "completedTasks[]"
    EMPLOYEES ||--o{ CHAT : "sender нэрээр"
    TIMESETTINGS ||--o{ LOGS : "хоцролт, оноог тооцно"
    CALCTYPES ||--o{ WORKLOGS : "м² тооцоолуураар үүссэн ажил"
```

### Анхаарах зүйлс

- **`ORDERS ↔ WORKLOGS` холбоо сул.** Апп дээр `buildQuickOrder` хоёр бичлэгийг
  тус тусын `id`-тайгаар үүсгэдэг — хооронд нь заасан талбар байхгүй. Зөвхөн
  вэбээс ирсэн хос `orderNumber`-ээр холбогдоно. Хэрэв ирээдүйд тохируулга
  (reconciliation) хэрэгтэй бол апп талд ч мөн адил талбар нэмэх нь зөв алхам.
- **Үнэ мөр хэлбэртэй.** `'8,500₮'` гэж хадгалагддаг тул тооцоо бүр
  `parsePrice()`-аар дамжина (тоо биш бүх тэмдэгтийг хасаад `Number`).
- **`WORKLOGS.job` нь чөлөөт текст.** `SERVICES`-ийн нэрээс хуулагддаг ч
  түүхий мөр — үйлчилгээний нэр өөрчлөгдвөл хуучин ажлын бүртгэл хэвээр үлдэнэ.
  Тайланд энэ нь давуу тал (түүх гажихгүй), нэгтгэлд сул тал.
- **`LOGS.name → EMPLOYEES.name`.** Ажилтны нэр солигдвол өмнөх ирцийн бүртгэл
  тасарна. `id`-гаар холбох нь илүү найдвартай.
- **`INVENTORY` ба `SERVICES` тусдаа.** Эхнийх нь агуулахын үлдэгдэлтэй бараа,
  хоёр дахь нь үйлчилгээний үнэ. Вэб зөвхөн `SERVICES`-ийг ашигладаг.
- **`TIMESETTINGS` ганц бичлэг** — жагсаалт биш, `/pmn/timesettings` шууд объект.

---

## 6. Эрхийн хуваарилалт

`permissions.ts → MATRIX` дээрх бодит эрхүүд:

```mermaid
flowchart LR
    manager["manager<br/>Менежер"]
    ipad["ipad<br/>Тоолуурын таблет"]
    worker["worker<br/>Ажилтан"]

    subgraph shared["Гурвуулаа"]
        home["Нүүр"]
        daily["Цаг · Дадал"]
        inv["Бараа үнэ"]
        svc["Хэвлэл үнэ"]
        chat["Чат"]
    end

    subgraph counter["manager + ipad"]
        orders["Захиалга"]
        report["Тайлан"]
        perf["Үзүүлэлт"]
        quote["Үнийн санал"]
        admin["Админ"]
        edit["Каталог, ажлын бүртгэл засах"]
        exp["Excel гаргах"]
    end

    subgraph only["Зөвхөн manager"]
        del["Ажлын бүртгэл УСТГАХ"]
        emp["Ажилтан удирдах"]
        settings["Тохиргоо солих"]
    end

    manager --> shared & counter & only
    ipad --> shared & counter
    worker --> shared

    classDef danger fill:#fef2f2,stroke:#dc2626,color:#0f172a
    class only danger
```

Хоёр зүйл онцлох нь зүйтэй:

- Вэбээс ирсэн захиалга **Захиалга** таб дээр гарна — тэр таб `worker`-т
  байхгүй тул зөвхөн `manager` / `ipad` харна.
- Ажлын бүртгэл **устгах** нь зөвхөн `manager`-т. Захиалга бүртгэх, засах нь
  тоолуурын ажил, устгах нь тийм биш: устгасан мөр өдрийн орлогыг өөртэйгөө
  хамт аваад явдаг бөгөөд апп-д буцаах арга байхгүй.

---

## 7. Хаанаас юу уншихад тохиромжтой

| Асуулт | Файл |
| --- | --- |
| Захиалга Firebase рүү яаж бичигддэг вэ | `konica-web/api/order.ts`, `api/_shared.ts` |
| Апп доторх шуурхай захиалга | `printmn-expo/src/features/orders/orderLogic.ts` |
| Самбарын шүүлт, эрэмбэ | `printmn-expo/src/features/worklogs/workLogLogic.ts` |
| Офлайн дараалал | `printmn-expo/src/services/sync/writeQueue.ts` |
| Rules ба индексүүд | `printmn-expo/firebase/database.rules.json` |
| Үнийн тооцоо, НӨАТ | `printmn-expo/src/utils/price.ts`, `konica-web/src/lib/price.ts` |
