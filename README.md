# MATOS

Xaridor, sotuvchi va tikuvchini bir joyga yig‘adigan mato platformasi. Uch qismdan iborat:

| Qism | Papka | Manzil (production) | Vazifasi |
|---|---|---|---|
| **Sayt** | `src/` | `matos.uz` (GitHub Pages) | Katalog, bepul namuna, rasm orqali qidirish, 3D kiyib ko‘rish, tikuvchilar, savat va buyurtma |
| **Sotuvchi paneli** | `admin/` | `admin.matos.uz` | Buyurtmalar, namunalar, tikuv so‘rovlari, matolar (surat yuklash bilan), atelyelar, mijozlar, sozlamalar |
| **API server** | `server/` | `api.matos.uz` | Ma’lumotlar bazasi (SQLite), profil va sessiyalar, buyurtmalar, ombor, suratlar, Telegram xabarnomasi |

`shared/` — uchalasi birga ishlatadigan turlar va boshlang‘ich ma’lumotlar (katalog, atelyelar, holatlar, telefon formati).

```
 matos.uz (sayt) ─────┐
                      ├──►  api.matos.uz  ──►  SQLite (server/data/matos.db) + server/data/uploads
 admin.matos.uz ──────┘          │
                                 └──►  Telegram: “Yangi buyurtma MT-1043”
```

Saytdagi har bir buyurtma, namuna so‘rovi, tikuv so‘rovi va yangi mijoz darhol panelda ko‘rinadi; panelda qo‘shilgan yoki o‘zgartirilgan mato (narx, rang, ombordagi metr) saytda darhol yangilanadi.

---

## 1. Kompyuterda ishga tushirish

**Kerak:** Node.js **22.18 yoki yangiroq** (tavsiya: 24 LTS) — https://nodejs.org

```bash
npm install      # bir marta (yoki: bun install)
npm run dev      # API + sayt + admin birga
```

| | Manzil |
|---|---|
| Sayt | http://localhost:5173 |
| Sotuvchi paneli | http://localhost:5174 — birinchi ishga tushishda `admin@matos.uz` / `matos-admin` |
| API | http://localhost:8080/api/health |

Baza `server/data/matos.db` faylida avtomatik yaratiladi va katalog (9 mato, 35 rang) hamda 6 ta atelye bilan to‘ldiriladi. Toza holatdan boshlash uchun `server/data` papkasini o‘chiring.

Alohida ishga tushirish: `npm run dev:api`, `npm run dev:store`, `npm run dev:admin`.

### `npm run dev` ishlamasa

| Belgisi | Yechim |
|---|---|
| `'vite' is not recognized` yoki “Kutubxonalar o‘rnatilmagan” | Avval `npm install`. Xato bersa, `node_modules` va `package-lock.json` ni o‘chirib, qayta `npm install`. |
| “Node.js … eskirgan” | nodejs.org dan LTS ni o‘rnating, terminalni yopib-oching, `node -v` ni tekshiring. |
| PowerShell: *running scripts is disabled on this system* | `npm.cmd install` va `npm.cmd run dev` deb yozing, yoki bir marta: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| *Port 5173/5174/8080 is already in use* | Boshqa oynada ishlab turgan `npm run dev` ni yoping (Ctrl+C). API porti: `server/.env` → `PORT=8081`. |
| Sayt ochiladi, lekin “Server bilan aloqa yo‘q” | API ishlayaptimi: http://localhost:8080/api/health. Terminaldagi `[api]` qatorlarini o‘qing. |

---

## 2. Buyruqlar

| Buyruq | Nima qiladi |
|---|---|
| `npm run dev` | Uchala qismni birga ishga tushiradi |
| `npm run build` | Saytni `dist/` ga yig‘adi (GitHub Pages shuni joylaydi) |
| `npm run build:admin` | Panelni `admin/dist/` ga yig‘adi |
| `npm run start:api` | API ni production rejimida ishga tushiradi |
| `npm test` | API ning 22 ta integratsion testi (haqiqiy server, vaqtinchalik baza) |
| `npm run lint` | Uchala qismning TypeScript tekshiruvi (strict) |
| `npm run admin:create -- email@domen.uz Parol123 [Ism] [--manager]` | Panelga xodim qo‘shish |
| `npm run admin:password -- email@domen.uz YangiParol123` | Xodim parolini tiklash |
| `npm run db:backup [-- papka]` | Bazaning zaxira nusxasi (`server/data/backups/`) |

---

## 3. Serverga joylash (production)

Sayt hozirgidek GitHub Pages’da qoladi (`main` ga push → `.github/workflows/deploy.yml`). API va panel uchun bitta VPS yetarli (1 GB RAM, Ubuntu 22.04/24.04).

**DNS (domen panelida):** `api.matos.uz` va `admin.matos.uz` uchun **A** yozuv → VPS IP manzili. `matos.uz` GitHub Pages’da qoladi.

### A variant — Docker + Caddy (eng oson, HTTPS avtomatik)

```bash
# VPS da (Docker o‘rnatilgan bo‘lsin)
git clone https://github.com/<siz>/MATOS.git /opt/matos && cd /opt/matos
cp .env.example server/.env && nano server/.env      # ADMIN_EMAIL, ADMIN_PASSWORD, Telegram
npm install && npm run build:admin                   # yoki admin/dist ni kompyuterdan yuklang
docker compose -f deploy/docker-compose.yml up -d --build
```

### B variant — Node + systemd + nginx

```bash
sudo apt install -y nginx certbot python3-certbot-nginx rsync
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs
sudo useradd -r -m -d /opt/matos matos
sudo -u matos git clone https://github.com/<siz>/MATOS.git /opt/matos
cd /opt/matos && sudo -u matos cp .env.example server/.env && sudo -u matos nano server/.env
sudo -u matos mkdir -p server/data
sudo cp deploy/matos-api.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now matos-api
npm install && npm run build:admin && sudo mkdir -p /var/www/matos-admin && sudo cp -r admin/dist/. /var/www/matos-admin/
sudo cp deploy/nginx.conf /etc/nginx/sites-available/matos && sudo ln -s /etc/nginx/sites-available/matos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.matos.uz -d admin.matos.uz
```

API ga npm kutubxonalari kerak emas — u faqat Node.js’ning o‘zida ishlaydi (`node:http`, `node:sqlite`, `node:crypto`).

**Avtomatik deploy:** `deploy/github/deploy-server.yml` ni `.github/workflows/` ga ko‘chiring va GitHub’da `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` secret’larini qo‘shing. Har bir push’da testlar o‘tadi, panel yig‘iladi va serverga yuklanadi; baza va `server/.env` tegilmaydi.

**Zaxira nusxa (cron):** `0 3 * * * cd /opt/matos && node --disable-warning=ExperimentalWarning server/src/cli.ts backup`

### Sozlamalar (`server/.env`)

| O‘zgaruvchi | Ma’nosi |
|---|---|
| `PORT`, `HOST` | API porti va interfeysi (nginx orqasida `127.0.0.1`) |
| `PUBLIC_URL` | API ning tashqi manzili, masalan `https://api.matos.uz` |
| `CORS_ORIGINS` | API dan foydalanadigan saytlar (vergul bilan) |
| `TRUST_PROXY=1` | nginx/Caddy orqasida mijozning haqiqiy IP sini olish |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Birinchi ishga tushishda yaratiladigan ega hisobi (parol ≥ 10 belgi) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Yangi buyurtma/so‘rov haqida Telegram xabari |
| `DATA_DIR` | Baza va suratlar papkasi |

Domenlar boshqacha bo‘lsa, sayt va panel uchun `.env.production` faylida `VITE_API_URL`, `VITE_ADMIN_URL`, `VITE_STORE_URL` ni yozing (GitHub Actions uchun — repository variables).

---

## 4. Xavfsizlik va ishonchlilik

- Parollar `scrypt` bilan xeshlanadi; sessiya tokenlari bazada faqat SHA-256 ko‘rinishida saqlanadi, chiqishda bekor qilinadi.
- Narx, yetkazish va ombor qoldig‘i serverda hisoblanadi — brauzerdan kelgan narxga ishonilmaydi. Buyurtma va ombordan ayirish bitta tranzaksiyada.
- `Idempotency-Key`: “Tasdiqlash” ikki marta bosilsa ham bitta buyurtma yaratiladi.
- Kirish, ro‘yxatdan o‘tish, buyurtma va arizalarga IP bo‘yicha limit; CORS faqat ruxsat etilgan domenlar uchun.
- Yuklangan fayl rasm ekanligi birinchi baytlari bo‘yicha tekshiriladi (JPG/PNG/WEBP, ≤ 8 MB).
- Bloklangan mijozning barcha sessiyalari darhol yopiladi. Bekor qilingan buyurtma metraji omborga qaytadi.
- Panel ikki rolni biladi: **ega** (xodimlarni ham boshqaradi) va **menejer**.

---

## 5. API qisqacha

Ochiq: `GET /api/catalog` (ETag bilan), `GET /api/tailors`, `POST /api/orders`, `POST /api/tailor-requests`, `POST /api/tailors/apply`
Mijoz: `POST /api/auth/register|login|logout`, `GET|PATCH /api/me`, `GET /api/me/orders`
Panel (`/api/admin/*`, Bearer token): `auth/login`, `stats`, `orders` (+ `export` CSV), `tailor-requests`, `tailors`, `fabrics`, `uploads`, `customers`, `settings`, `staff`

Xatolar bir xil ko‘rinishda: `{ "error": { "code": "out_of_stock", "message": "…", "fields": { … } } }`

---

## 6. Tuzilma

```
shared/        types.ts, catalog.ts (boshlang‘ich katalog), tailors.ts, garments.ts, status.ts, phone.ts, pricing.ts
server/src/    index.ts, app.ts, routes.ts, http.ts, db.ts (sxema va migratsiyalar), config.ts, cli.ts
               modules/  catalog, orders, tailors, auth, reports, settings, uploads
               lib/      validate, crypto, rateLimit, telegram, log, errors
server/test/   api.test.ts
src/           sayt: pages/, components/, three/ (3D), lib/ (api, catalog, format, visualSearch…), state/app.tsx
admin/src/     panel: pages/ (Dashboard, Orders, TailorRequests, Fabrics, FabricEditor, Tailors, Customers, Settings)
deploy/        nginx.conf, matos-api.service, docker-compose.yml, Caddyfile, github/deploy-server.yml
scripts/       dev.mjs (hammasini ishga tushirish), api.mjs, check.mjs, sync-fabric-store.mjs
```

## 7. Eslatmalar

- `public/images/fabrics` dagi suratlar wearethefabricstore.com saytidan olingan. Ishga tushirishdan oldin ruxsat oling yoki o‘z suratlaringiz bilan almashtiring (panelda har bir rangga surat yuklash mumkin).
- Hozircha to‘lov qabul qilishda (naqd/karta) amalga oshiriladi. Onlayn to‘lov (Payme/Click) va SMS tasdiqlash keyingi bosqichda `server/src/modules` ga qo‘shiladi.
