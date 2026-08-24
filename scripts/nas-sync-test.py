#!/usr/bin/env python3
"""nas-sync.py-г хуурамч сервер дээр бүтнээр нь ажиллуулж шалгана."""
import json, os, pathlib, shutil, subprocess, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, HTTPServer

TOKEN = "test-token-0123456789"
PHOTO = b"\xff\xd8\xff" + b"x" * 500          # 503 байт "зураг"
POSTS = []                                    # серверт ирсэн POST-ууд

ORDERS = {
    "paid-new": {
        "ref": "manifests/2026-08-19/PMN-260819-0001-abcdefghijklmnop.json",
        "orderNumber": "PMN-260819-0001", "date": "2026-08-19",
        "createdAt": 1_760_000_000_000, "total": 24000,
        "customer": {"name": "Батбаяр", "phone": "99112233", "email": "", "note": "Гялгар"},
        "lines": [{"name": "10x15 зураг", "qty": 12, "total": 24000}],
        "payment": {"status": "paid", "amount": 24000, "method": "qpay", "paidAt": 1_760_000_100_000},
        "files": [
            {"key": "u/1", "kind": "print", "name": "01-print.jpg", "size": 503, "url": "/file/1"},
            {"key": "u/2", "kind": "original", "name": "01-original.jpg", "size": 503, "url": "/file/2"},
        ],
    },
    "unpaid": {
        "ref": "manifests/2026-08-19/PMN-260819-0002-abcdefghijklmnop.json",
        "orderNumber": "PMN-260819-0002", "date": "2026-08-19",
        "createdAt": 1_760_000_000_000, "total": 5000,
        "customer": {"name": "Нараа", "phone": "88112233", "email": "", "note": ""},
        "lines": [], "payment": {"status": "pending", "amount": 5000, "method": None},
        "files": [{"key": "u/3", "kind": "print", "name": "01-print.jpg", "size": 503, "url": None}],
    },
}
SYNCED = set()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send(self, status, body, raw=False):
        payload = body if raw else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/octet-stream" if raw else "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path.startswith("/file/"):
            return self._send(200, PHOTO, raw=True)
        if self.path.startswith("/api/health"):
            return self._send(200, {"ok": True, "summary": "OK", "missing": [], "checks": {
                "storage": {"ready": True, "detail": "«printmn-photos» бакет"},
                "admin": {"ready": True, "detail": "ADMIN_TOKEN бөглөгдсөн"},
                "payment": {"ready": True, "detail": "QPay бэлэн"},
                "notify": {"ready": False, "detail": "унтарсан"},
            }})
        if self.path.startswith("/api/admin"):
            if self.headers.get("x-admin-token") != TOKEN:
                return self._send(401, {"error": "Нууц үг буруу байна."})
            state = "pending-sync" if "pending-sync" in self.path else "paid"
            out = [o for o in ORDERS.values() if o["payment"]["status"] == "paid"]
            if state == "pending-sync":
                out = [o for o in out if o["orderNumber"] not in SYNCED]
            return self._send(200, {"orders": out, "state": state, "total": len(ORDERS)})
        self._send(404, {"error": "?"})

    def do_POST(self):
        if self.headers.get("x-admin-token") != TOKEN:
            return self._send(401, {"error": "Нууц үг буруу байна."})
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        POSTS.append(body)
        order = next((o for o in ORDERS.values() if o["ref"] == body.get("ref")), None)
        if not order:
            return self._send(404, {"error": "Захиалга олдсонгүй."})
        if body.get("action") == "synced":
            if order["payment"]["status"] != "paid":
                return self._send(409, {"error": "Төлөгдөөгүй."})
            SYNCED.add(order["orderNumber"])
            return self._send(200, {"syncedAt": 1_760_000_200_000, "printedAt": None})
        self._send(400, {"error": "?"})


fails = []
def ok(cond, label):
    print(("PASS  " if cond else "FAIL  ") + label)
    if not cond: fails.append(label)


server = HTTPServer(("127.0.0.1", 0), Handler)
base = f"http://127.0.0.1:{server.server_port}"
# Жинхэнэ presigned линк бүтэн хаягтай ирдэг тул хуурамч нь ч бүтэн байх ёстой.
for _order in ORDERS.values():
    for _file in _order["files"]:
        if _file["url"]:
            _file["url"] = base + _file["url"]
threading.Thread(target=server.serve_forever, daemon=True).start()

dest = tempfile.mkdtemp(prefix="nas-e2e-")
env = {**os.environ, "KONICA_API_BASE": base, "KONICA_ADMIN_TOKEN": TOKEN, "KONICA_DEST": dest}
SCRIPT = "/home/claude/konica-web/scripts/nas-sync.py"
run = lambda *args: subprocess.run([sys.executable, SCRIPT, *args], env=env,
                                   capture_output=True, text=True)

# ── 1. --check ───────────────────────────────────────────────────────────
r = run("--check")
print(r.stdout)
ok(r.returncode == 0, f"--check амжилттай (код {r.returncode})")
ok("✓ Токен" in r.stdout, "--check токеныг баталгаажуулна")
ok("✓ Хавтас" in r.stdout, "--check дискний бичих эрхийг шалгана")
ok(TOKEN not in r.stdout, "--check ТОКЕНЫГ ХЭВЛЭХГҮЙ")
ok(not POSTS, "--check юу ч ӨӨРЧЛӨХГҮЙ")

# ── 2. --dry-run ─────────────────────────────────────────────────────────
r = run("--dry-run")
ok(r.returncode == 0, f"--dry-run амжилттай (код {r.returncode})")
ok("PMN-260819-0001" in r.stdout, "--dry-run татах захиалгыг нэрлэнэ")
ok(not POSTS, "--dry-run сервер рүү юу ч бичихгүй")
ok(not os.path.exists(os.path.join(dest, "2026-08-19")), "--dry-run файл татахгүй")

# ── 3. Жинхэнэ ажиллалт ──────────────────────────────────────────────────
r = run()
print(r.stdout)
ok(r.returncode == 0, f"татаж дууслаа (код {r.returncode})")
folder = os.path.join(dest, "2026-08-19", "PMN-260819-0001 — Батбаяр")
ok(os.path.isfile(os.path.join(folder, "01-print.jpg")), "хэвлэх зураг ирлээ")
ok(os.path.isfile(os.path.join(folder, "_эх-файл", "01-original.jpg")), "эх файл тусдаа хавтсанд")
ok(os.path.isfile(os.path.join(folder, "ЗАХИАЛГА.txt")), "ЗАХИАЛГА.txt үүслээ")
slip = open(os.path.join(folder, "ЗАХИАЛГА.txt"), encoding="utf-8").read()
ok("99112233" in slip and "Гялгар" in slip, "хуудсанд утас, тэмдэглэл орсон")
ok(not os.path.exists(os.path.join(dest, "2026-08-19", "PMN-260819-0002 — Нараа")),
   "ТӨЛӨГДӨӨГҮЙ захиалга татагдаагүй")
ok([p for p in POSTS if p.get("action") == "synced"], "сервер рүү «татсан» гэж мэдэгдлээ")
ok(POSTS[0]["ref"] == ORDERS["paid-new"]["ref"], "зөв ref-ээр мэдэгдлээ")

# ── 4. Дахин ажиллуулахад давхардахгүй ───────────────────────────────────
before = len(POSTS)
r = run()
ok(r.returncode == 0, "хоёр дахь ажиллалт амжилттай")
ok(len(POSTS) == before, "татсан захиалгыг ДАХИН татахгүй (сервер шүүсэн)")

# ── 5. Төлөв файл алга болоход сервер барина ─────────────────────────────
shutil.rmtree(os.path.join(dest, "_state"))
before = len(POSTS)
r = run()
ok(len(POSTS) == before,
   "synced.json устсан ч сервер дахин татуулахгүй (syncedAt барив)")

# ── 6. Буруу токен ───────────────────────────────────────────────────────
bad = subprocess.run([sys.executable, SCRIPT], capture_output=True, text=True,
                     env={**env, "KONICA_ADMIN_TOKEN": "wrong-token-9876543"})
ok(bad.returncode == 1, f"буруу токен → код 1 ({bad.returncode})")
ok("401" in bad.stdout + bad.stderr, "буруу токеныг тодорхой хэлнэ")

# ── 7. Жишээ токеныг солихоо мартсан (кирилл) ────────────────────────────
cyr = subprocess.run([sys.executable, SCRIPT], capture_output=True, text=True,
                     env={**env, "KONICA_ADMIN_TOKEN": "энд-жинхэнэ-токеноо-тавина"})
ok(cyr.returncode == 2, f"кирилл токен → код 2 ({cyr.returncode})")
ok("Traceback" not in cyr.stderr, "traceback биш, ойлгомжтой мессеж")
ok("кирилл" in cyr.stderr, "юу болсныг нэрлэж хэлнэ")

# ── 8. Windows Notepad-ын BOM ────────────────────────────────────────────
#
# Notepad файлыг ихэвчлэн BOM-той хадгалдаг. Энгийн `utf-8`-аар уншвал эхний
# түлхүүр нь `\ufeffKONICA_API_BASE` болж, скрипт «тохиргоо дутуу» гэж
# гомдоно — атал файл нүдээр харахад төгс зөв харагдана.
import importlib.util as _ilu

_spec = _ilu.spec_from_file_location("nas_sync_mod", SCRIPT)
_mod = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

_bom_dir = tempfile.mkdtemp()
_bom = os.path.join(_bom_dir, "nas-sync.env")
with open(_bom, "wb") as handle:
    handle.write("\ufeffKONICA_API_BASE=https://jishee.mn\n".encode("utf-8"))
    handle.write("KONICA_ADMIN_TOKEN=abc123\n".encode("utf-8"))
    handle.write("KONICA_DEST=\\\\SERVER\\photo\n".encode("utf-8"))

_config = _mod.load_config(pathlib.Path(_bom))
ok(_config.get("KONICA_API_BASE") == "https://jishee.mn",
   f"BOM-той тохиргоог зөв уншина ({list(_config)[:1]})")
ok(_config.get("KONICA_DEST") == "\\\\SERVER\\photo",
   "UNC зам (\\\\SERVER\\photo) гэмтэлгүй уншигдана")
shutil.rmtree(_bom_dir, ignore_errors=True)

shutil.rmtree(dest, ignore_errors=True)
print("\n=== ДҮН ===")
print("БҮГД ТЭНЦЛЭЭ" if not fails else f"УНАСАН ({len(fails)}): " + " | ".join(fails))
sys.exit(1 if fails else 0)
