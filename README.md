# MATOS

Xaridor, sotuvchi va tikuvchini bir joyga yig‘adigan mato platformasi:

- **Katalog** — 9 ta mato, 35 ta rang. Material, rang, qalinlik bo‘yicha filtr, qidiruv, saralash.
- **Bepul namuna (Smart Swatch)** — bir buyurtmada 5 tagacha 10×10 sm bo‘lak.
- **Rasm orqali topish** — Instagram/Pinterest skrinshotidan rang, yuza va naqshni aniqlab, eng mos matolarni ko‘rsatadi. Tahlil brauzerning o‘zida bajariladi, rasm hech qayerga yuborilmaydi.
- **3D kiyib ko‘rish** — o‘lchamlaringizga (bo‘y, ko‘krak, bel, son) moslashadigan maneken, 11 ta fason, mato fotosuratidan olingan tekstura, shabada, 3 xil yorug‘lik va rasmni saqlash. Har bir fason uchun kerakli metraj hisoblanadi.
- **Tikuvchilar** — shahar va yo‘nalish bo‘yicha qidiruv, o‘lchamlar bilan buyurtma so‘rovi, atelyeni ro‘yxatga qo‘shish.
- **Sotuvchi paneli** — `#/admin` (demo parol: `matos-admin`). Saytdagi buyurtmalar, namuna so‘rovlari va tikuv so‘rovlari shu yerda ko‘rinadi; narx va “sotuvda” holati saytdagi katalogga darhol ta’sir qiladi.

## Ishga tushirish

```bash
bun install        # yoki npm install
bun run dev        # http://localhost:5173
bun run lint       # TypeScript tekshiruvi
bun run build      # dist/ papkasiga production build
```

`main` branchga push qilinganda GitHub Actions (`.github/workflows`) saytni GitHub Pages’ga joylaydi. `vite.config.ts` da `base: './'`, shuning uchun build ham `matos.uz`, ham `username.github.io/MATOS/` manzilida ishlaydi.

## Tuzilma

```
src/
  App.tsx               sahifalar va oynalar (hash router: #/catalog, #/fabric/:id, #/studio, #/tailors)
  state/app.tsx         til, valyuta, savat, namunalar, profil, o‘lchamlar (localStorage)
  pages/                HomePage, CatalogPage, ProductPage, StudioPage, TailorsPage
  components/           Header/Footer, CartDrawer, VisualSearchModal, AuthModal, ProfileModal, AdminPanel, ui/*
  three/                3D dvigatel: body.ts (parametrik maneken), garments.ts (11 fason),
                        geometry.ts, fabricTexture.ts, scene.ts (yorug‘lik, kamera, shabada)
  lib/                  format, i18n, router, orders (admin bilan umumiy), visualSearch, measure, colors
  data/                 fabrics.ts, garments.ts, tailors.ts, seed.ts
public/images/fabrics/  mato suratlari + 3D uchun tile.jpg (scripts orqali yaratilgan)
```

## Muhim eslatmalar

- Bu demo versiya: profil, buyurtma va namunalar brauzerning `localStorage`ida saqlanadi. Haqiqiy savdo uchun backend (buyurtmalar bazasi, SMS/Telegram xabarnoma, to‘lov) kerak.
- `public/images/fabrics` dagi suratlar `scripts/sync-fabric-store.mjs` orqali wearethefabricstore.com saytidan olingan. Ishga tushirishdan oldin o‘z suratlaringiz bilan almashtiring yoki ruxsat oling.
- Ipak, merinos va tvil ranglarining surati yo‘q — ular uchun to‘quv chizib ko‘rsatiladi (`src/lib/weave.ts`).
