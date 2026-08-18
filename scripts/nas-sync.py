#!/usr/bin/env python3
"""
nas-sync.py — вэбээр ирсэн ТӨЛӨГДСӨН захиалгын зургийг NAS руу татаж авна.

Яагаад /api/admin-аар татдаг вэ (R2 руу шууд хандахгүй):

  1. Төлбөрийн түгжээ сервер дээр хэвээр үлдэнэ. `/api/admin` төлөгдөөгүй
     захиалганд татах линк ОГТ буцаадаггүй тул NAS нь төлөгдөөгүй зургийг
     ФИЗИКЭЭР татаж чадахгүй. Хэрэв rclone-оор R2-оос шууд sync хийвэл энэ
     дүрэм тойрч гарна — төлөөгүй хүний зураг ажилтны хавтсанд ирнэ.
  2. NAS дээр R2-ийн түлхүүр хадгалахгүй. Зөвхөн ADMIN_TOKEN. Хэрэв NAS эвдэрч
     орвол объект сангийн бүрэн эрх алдагдахгүй.
  3. Захиалагчийн нэр, утас, мөрүүд, дүн бүгд хамт ирнэ — ажилтанд зориулсан
     ЗАХИАЛГА.txt хуудсыг шууд үүсгэнэ.
  4. Гуравдагч сан (rclone, boto3) шаардлагагүй — Python 3 стандарт сан хангалттай.

Холболт нь ЗӨВХӨН гадагш чиглэсэн (NAS → интернэт). Тиймээс NAS-ыг интернэтэд
гаргах, тогтмол IP авах, HTTPS сертификат тохируулах, порт нээх шаардлагагүй.

Хэрэглээ:
    ./nas-sync.py                  # тохиргоог ~/.config эсвэл --config-оос уншина
    ./nas-sync.py --days 14        # сүүлийн 14 өдрийг шалгана
    ./nas-sync.py --dry-run        # юу татахыг харуулна, татахгүй
    ./nas-sync.py --resync PMN-260818-4821   # нэг захиалгыг дахин татна

Гарах код: 0 = амжилттай, 1 = алдаа гарсан, 2 = тохиргоо буруу.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

# ── Тогтмолууд ─────────────────────────────────────────────────────────────

DEFAULT_DAYS = 7
HTTP_TIMEOUT = 60          # секунд, нэг хүсэлт
DOWNLOAD_TIMEOUT = 300     # секунд, нэг файл (30MB хүртэл байж болно)
MAX_RETRIES = 3
RETRY_BACKOFF = 5          # секунд, дараа нь 10, 20 ...
USER_AGENT = "konica-nas-sync/1.0"

# Windows/macOS/DSM бүгдэд аюулгүй файлын нэр болгоно.
_UNSAFE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_SPACES = re.compile(r"\s+")


# ── Туслах функцууд ────────────────────────────────────────────────────────

def log(message: str, *, logfile: Path | None = None) -> None:
    """Дэлгэц болон файл руу зэрэг бичнэ. Cron дор ажиллахад файл нь чухал."""
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{stamp}] {message}"
    print(line, flush=True)
    if logfile is not None:
        try:
            logfile.parent.mkdir(parents=True, exist_ok=True)
            with logfile.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")
        except OSError:
            pass  # лог бичиж чадахгүй байгаа нь ажлыг зогсоох шалтгаан биш


def safe_name(value: str, *, fallback: str = "unnamed", limit: int = 60) -> str:
    """
    Хавтас/файлын нэрэнд ашиглах аюулгүй мөр.

    Кирилл үсгийг хадгална (ажилтан хавтсаа нэрээр нь олох ёстой) — зөвхөн
    файлын системд хориотой тэмдэгтүүдийг л зайлуулна.
    """
    value = unicodedata.normalize("NFC", str(value or "")).strip()
    value = _UNSAFE.sub("-", value)
    value = _SPACES.sub(" ", value).strip(" .")
    value = value[:limit].strip(" .")
    return value or fallback


def http_json(url: str, token: str) -> dict:
    """/api/admin руу GET хийж JSON буцаана. Түр алдаанд дахин оролдоно."""
    request = urllib.request.Request(
        url,
        headers={"x-admin-token": token, "user-agent": USER_AGENT},
        method="GET",
    )
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            # 401/403 дахин оролдоод нэмэргүй — токен буруу байна.
            if error.code in (401, 403):
                raise RuntimeError(
                    f"ADMIN_TOKEN буруу байна (HTTP {error.code}). "
                    "Vercel дээрх утгатай тааруулна уу."
                ) from error
            if error.code == 503:
                raise RuntimeError(
                    "Сервер дээр ADMIN_TOKEN эсвэл зургийн сан тохируулаагүй байна "
                    "(HTTP 503)."
                ) from error
            last_error = error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_BACKOFF * (2 ** attempt))
    raise RuntimeError(f"/api/admin руу холбогдож чадсангүй: {last_error}")


def download(url: str, target: Path) -> int:
    """
    Файлыг татаж, БҮРЭН татагдсаны дараа л эцсийн нэр рүү нь шилжүүлнэ.

    Шууд эцсийн нэр рүү бичвэл дунд нь тасарсан үед ажилтан хагас зураг
    хэвлэх эрсдэлтэй — cron дараагийн удаа «аль хэдийн байна» гэж алгасна.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"user-agent": USER_AGENT})
    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES):
        temp_path: Path | None = None
        try:
            with urllib.request.urlopen(request, timeout=DOWNLOAD_TIMEOUT) as response:
                handle, temp_name = tempfile.mkstemp(
                    dir=str(target.parent), prefix=".part-"
                )
                temp_path = Path(temp_name)
                with os.fdopen(handle, "wb") as out:
                    shutil.copyfileobj(response, out, length=1024 * 256)
            size = temp_path.stat().st_size
            if size == 0:
                raise RuntimeError("хоосон файл ирлээ")
            temp_path.replace(target)
            return size
        except Exception as error:  # noqa: BLE001 — сүлжээний ямар ч алдаа
            last_error = error
            if temp_path is not None and temp_path.exists():
                temp_path.unlink(missing_ok=True)
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_BACKOFF * (2 ** attempt))

    raise RuntimeError(f"{target.name} татаж чадсангүй: {last_error}")


# ── Тохиргоо ───────────────────────────────────────────────────────────────

def load_config(path: Path | None) -> dict[str, str]:
    """
    `KEY=value` хэлбэрийн энгийн файл уншина. Орчны хувьсагч давуу эрхтэй,
    тиймээс cron дотор ч, гараар ч дарж болно.
    """
    config: dict[str, str] = {}
    if path is not None and path.exists():
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            config[key.strip()] = value.strip().strip('"').strip("'")
    for key in ("KONICA_API_BASE", "KONICA_ADMIN_TOKEN", "KONICA_DEST"):
        if os.environ.get(key):
            config[key] = os.environ[key]
    return config


# ── Захиалгын хуудас ───────────────────────────────────────────────────────

def order_slip(order: dict) -> str:
    """Ажилтан хэвлэхийн өмнө хардаг товч хуудас."""
    customer = order.get("customer") or {}
    created = order.get("createdAt")
    created_text = (
        datetime.fromtimestamp(created / 1000).strftime("%Y-%m-%d %H:%M")
        if isinstance(created, (int, float)) and created > 0
        else "—"
    )
    payment = order.get("payment") or {}
    paid_at = payment.get("paidAt")
    paid_text = (
        datetime.fromtimestamp(paid_at / 1000).strftime("%Y-%m-%d %H:%M")
        if isinstance(paid_at, (int, float)) and paid_at > 0
        else "—"
    )

    lines = [
        "════════════════════════════════════════════",
        f"  ЗАХИАЛГА  {order.get('orderNumber', '—')}",
        "════════════════════════════════════════════",
        "",
        f"  Захиалагч : {customer.get('name') or '—'}",
        f"  Утас      : {customer.get('phone') or '—'}",
        f"  И-мэйл    : {customer.get('email') or '—'}",
        f"  Ирсэн     : {created_text}",
        f"  Төлсөн    : {paid_text}  ({payment.get('method') or '—'})",
        "",
        "  ── Захиалгын мөрүүд ──────────────────────",
    ]
    for line in order.get("lines") or []:
        name = str(line.get("name", "—"))
        qty = line.get("qty", 0)
        total = line.get("total", 0)
        lines.append(f"  {name:<28} x{qty:<4} {total:>10,}₮")

    lines += [
        "  ──────────────────────────────────────────",
        f"  {'НИЙТ':<28} {'':<5} {order.get('total', 0):>10,}₮",
        "",
    ]

    note = (customer.get("note") or "").strip()
    if note:
        lines += ["  ── Захиалагчийн тэмдэглэл ────────────────", f"  {note}", ""]

    prints = [f for f in order.get("files") or [] if f.get("kind") == "print"]
    lines += [
        "  ── Файл ──────────────────────────────────",
        f"  Хэвлэх зураг : {len(prints)} ширхэг (энэ хавтсанд)",
        "  Эх файл      : _эх-файл/ дотор (тайралт буруу үед хэрэглэнэ)",
        "",
        "  ⚠️  Хэвлэсний дараа ажилтны апп дээр «хэвлэсэн» гэж тэмдэглэнэ үү.",
        "",
    ]
    return "\n".join(lines)


# ── Үндсэн логик ───────────────────────────────────────────────────────────

def sync_order(order: dict, dest_root: Path, logfile: Path, dry_run: bool) -> bool:
    """
    Нэг захиалгыг татаж, хавтас болгоно. Бүрэн амжилттай бол True.

    Хэсэгчлэн амжилттай бол False буцаана — ингэснээр төлөв файлд «дууссан»
    гэж бичигдэхгүй бөгөөд дараагийн ажиллалт дутуу файлыг гүйцээнэ.
    """
    number = order.get("orderNumber") or "UNKNOWN"
    date = order.get("date") or datetime.now().strftime("%Y-%m-%d")
    customer_name = safe_name((order.get("customer") or {}).get("name") or "", fallback="")

    folder_name = f"{number} — {customer_name}" if customer_name else number
    folder = dest_root / date / safe_name(folder_name, fallback=number, limit=90)
    originals = folder / "_эх-файл"

    files = order.get("files") or []
    downloadable = [f for f in files if f.get("url")]

    if not downloadable:
        log(f"  {number}: татах линк алга (төлөгдөөгүй байж магадгүй) — алгаслаа",
            logfile=logfile)
        return False

    if dry_run:
        log(f"  {number}: {len(downloadable)} файл татах байсан → {folder}",
            logfile=logfile)
        return False

    total_bytes = 0
    fetched = 0
    failed = 0

    for index, entry in enumerate(downloadable, start=1):
        kind = entry.get("kind")
        raw_name = entry.get("name") or f"{index:02d}-{kind}.jpg"
        target_dir = originals if kind == "original" else folder
        target = target_dir / safe_name(raw_name, fallback=f"{index:02d}.jpg", limit=80)

        # Аль хэдийн бүрэн татагдсан файлыг дахин татахгүй — cron 10 минут
        # тутам ажилладаг тул энэ шалгалт урсгалыг эрс багасгана.
        expected = entry.get("size")
        if target.exists() and isinstance(expected, int) and target.stat().st_size == expected:
            continue

        try:
            total_bytes += download(entry["url"], target)
            fetched += 1
        except Exception as error:  # noqa: BLE001
            failed += 1
            log(f"  {number}: {target.name} — {error}", logfile=logfile)

    if failed:
        log(f"  {number}: {fetched} татагдсан, {failed} алдаатай — дараа дахин оролдоно",
            logfile=logfile)
        return False

    # Хуудсыг үргэлж шинэчилнэ (төлбөрийн тэмдэглэл өөрчлөгдсөн байж болно).
    try:
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "ЗАХИАЛГА.txt").write_text(order_slip(order), encoding="utf-8")
    except OSError as error:
        log(f"  {number}: ЗАХИАЛГА.txt бичиж чадсангүй — {error}", logfile=logfile)
        return False

    if fetched:
        log(f"  ✓ {number}: {fetched} файл ({total_bytes / 1_048_576:.1f} MB) → {folder.name}",
            logfile=logfile)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Вэбийн төлөгдсөн захиалгын зургийг NAS руу татна."
    )
    parser.add_argument("--config", type=Path, default=None,
                        help="KEY=value тохиргооны файл")
    parser.add_argument("--days", type=int, default=None,
                        help=f"Сүүлийн хэдэн өдрийг шалгах (өгөгдмөл {DEFAULT_DAYS}, дээд тал нь 31)")
    parser.add_argument("--dest", type=Path, default=None, help="Хадгалах үндсэн хавтас")
    parser.add_argument("--dry-run", action="store_true",
                        help="Юу татахыг харуулна, файл татахгүй")
    parser.add_argument("--resync", metavar="ЗАХИАЛГА",
                        help="Нэг захиалгыг төлөв үл харгалзан дахин татна")
    arguments = parser.parse_args()

    # ── Тохиргоо цуглуулах ──────────────────────────────────────────────
    config_path = arguments.config
    if config_path is None:
        for candidate in (
            Path("/volume1/photo/web-orders/_config/nas-sync.env"),  # Synology
            Path("/share/photo/web-orders/_config/nas-sync.env"),    # QNAP
            Path.home() / ".config" / "konica" / "nas-sync.env",
        ):
            if candidate.exists():
                config_path = candidate
                break

    config = load_config(config_path)
    api_base = (config.get("KONICA_API_BASE") or "").rstrip("/")
    token = config.get("KONICA_ADMIN_TOKEN") or ""
    dest_root = arguments.dest or Path(config.get("KONICA_DEST") or "")

    missing = []
    if not api_base:
        missing.append("KONICA_API_BASE")
    if not token:
        missing.append("KONICA_ADMIN_TOKEN")
    if not str(dest_root):
        missing.append("KONICA_DEST")
    if missing:
        print(
            "Тохиргоо дутуу байна: " + ", ".join(missing) + "\n"
            f"Уншсан файл: {config_path or '(олдсонгүй)'}\n"
            "nas-sync.env дотор эсвэл орчны хувьсагчаар өгнө үү.",
            file=sys.stderr,
        )
        return 2

    dest_root = Path(dest_root)
    logfile = dest_root / "_logs" / "sync.log"
    state_path = dest_root / "_state" / "synced.json"
    lock_path = dest_root / "_state" / "sync.lock"

    try:
        dest_root.mkdir(parents=True, exist_ok=True)
        state_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        print(f"Хадгалах хавтас үүсгэж чадсангүй: {error}", file=sys.stderr)
        return 2

    # ── Давхар ажиллахаас сэргийлэх ─────────────────────────────────────
    # Cron 10 минут тутам ажилладаг ч том захиалга илүү удаж магадгүй.
    # Хоёр хувь зэрэг ажиллавал нэг файлыг хоёулаа татаж, урсгал дэмий үрнэ.
    if lock_path.exists():
        age = time.time() - lock_path.stat().st_mtime
        if age < 3600:
            log(f"Өмнөх ажиллалт дуусаагүй байна ({age / 60:.0f} минут) — алгаслаа",
                logfile=logfile)
            return 0
        log("Хуучирсан түгжээ олдлоо — цэвэрлээд үргэлжлүүлнэ", logfile=logfile)
        lock_path.unlink(missing_ok=True)

    try:
        lock_path.write_text(str(os.getpid()), encoding="utf-8")
    except OSError:
        pass

    try:
        # ── Төлөв унших ─────────────────────────────────────────────────
        synced: set[str] = set()
        if state_path.exists():
            try:
                payload = json.loads(state_path.read_text(encoding="utf-8"))
                synced = set(payload.get("orders") or [])
            except (json.JSONDecodeError, OSError) as error:
                log(f"Төлөв файл уншигдсангүй ({error}) — шинээр эхэлнэ", logfile=logfile)

        if arguments.resync:
            synced.discard(arguments.resync)

        days = arguments.days or int(config.get("KONICA_DAYS") or DEFAULT_DAYS)
        days = max(1, min(31, days))

        log(f"Эхэллээ — сүүлийн {days} өдөр, {api_base}", logfile=logfile)

        try:
            payload = http_json(f"{api_base}/api/admin?days={days}", token)
        except RuntimeError as error:
            log(f"АЛДАА: {error}", logfile=logfile)
            return 1

        orders = payload.get("orders") or []

        # Төлбөр орсон бөгөөд татах линктэй захиалгууд.
        # `url` нь зөвхөн төлөгдсөн үед л сервер талаас ирдэг — өөрөөр хэлбэл
        # энэ шүүлтүүр нь тав тухын зүйл, жинхэнэ түгжээ нь серверт байна.
        pending = [
            order for order in orders
            if (order.get("payment") or {}).get("status") == "paid"
            and (order.get("orderNumber") not in synced or order.get("orderNumber") == arguments.resync)
        ]

        unpaid = sum(
            1 for order in orders if (order.get("payment") or {}).get("status") != "paid"
        )

        log(
            f"{len(orders)} захиалга ирлээ — {len(pending)} шинэ төлөгдсөн, "
            f"{unpaid} төлөгдөөгүй (алгасна)",
            logfile=logfile,
        )

        if not pending:
            log("Татах шинэ зураг алга.", logfile=logfile)
            return 0

        succeeded = 0
        for order in pending:
            if sync_order(order, dest_root, logfile, arguments.dry_run):
                synced.add(order.get("orderNumber"))
                succeeded += 1

        if not arguments.dry_run:
            try:
                state_path.write_text(
                    json.dumps(
                        {"orders": sorted(o for o in synced if o), "updatedAt": int(time.time())},
                        ensure_ascii=False,
                        indent=1,
                    ),
                    encoding="utf-8",
                )
            except OSError as error:
                log(f"АНХААР: төлөв хадгалагдсангүй ({error}) — дараа дахин татна",
                    logfile=logfile)

        if arguments.dry_run:
            log(f"Туршилтын горим — {len(pending)} захиалга татагдах байсан.",
                logfile=logfile)
            return 0

        log(f"Дууслаа — {succeeded}/{len(pending)} захиалга бэлэн.", logfile=logfile)
        return 0 if succeeded == len(pending) else 1

    finally:
        lock_path.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
