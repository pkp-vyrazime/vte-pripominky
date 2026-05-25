# SPEC — Web pro distribuci připomínek k AOV 51, 62, 63

## 1. Cíl a kontext

Občanská iniciativa proti vymezení akceleračních oblastí pro větrné elektrárny **AOV 51 Řenče, AOV 62 Střížovice a AOV 63 Únětice** v Územním rozvojovém plánu. Termín pro připomínky: **1. 6. 2026**.

K dispozici máme **100 předgenerovaných PDF dokumentů** s různými připomínkami. Každý občan, kterému to dává smysl, si na webu klikne na CTA a stáhne si jeden z těchto dokumentů. Doplní jméno, datum narození, adresu, podepíše a odešle na ministerstvo (datovou schránkou, poštou nebo e-mailem s elektronickým podpisem).

**Web má:**
- Jasně komunikovat, co se po návštěvníkovi chce.
- Mít jedno výrazné CTA „Vygenerovat připomínku".
- Distribuovat 100 dokumentů sekvenčně — 1. klik = dokument 1, 2. klik = dokument 2, ..., 100. klik = dokument 100. Po 100. zobrazit zprávu „rozebráno, doplníme".
- Limitovat 5 stažení z jednoho prohlížeče.
- Ukazovat statistiku „kolik lidí už si stáhlo".
- Vejít se na jednu obrazovku bez scrollování na mobilu i desktopu.
- Být nasaditelný na Vercel free tier během několika minut.

## 2. Tech stack

| Vrstva | Volba | Proč |
|---|---|---|
| Framework | **Next.js 14 (App Router)** + TypeScript | Vercel-native, server actions, API routes, statické soubory |
| Styling | **Tailwind CSS** | Rychlý a konzistentní design, žádné CSS soubory navíc |
| Storage (counter) | **Upstash Redis** (free tier) | Atomické `INCR`, integrace s Vercel jedním klikem, free tier zvládne miliony requestů |
| Hosting | **Vercel** Hobby (free) | Automatický deploy z GitHubu, edge runtime, free SSL |
| PDF storage | **statické soubory v `/public/pripominky/`** | Vercel CDN, nulové náklady, jednoduché |
| Rate limit | **HttpOnly cookie + signed value** | Klient side state per browser, žádná persistance v DB |

Žádná databáze. Žádný build step navíc. Žádné runtime závislosti nad rámec Next.js + jednoho Upstash SDK volání.

## 3. Architektura a tok dat

```
┌────────────────────────────────────────────────────────────────────┐
│  Návštěvník                                                        │
│  └─ Klikne „Vygenerovat připomínku"                                │
└──────────────┬─────────────────────────────────────────────────────┘
               │ POST /api/generate
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js API route  /api/generate                                   │
│  1. Přečte HttpOnly cookie  `pripominky_count`  (signed)            │
│  2. Pokud count >= 5  →  return 429 + zpráva                        │
│  3. Atomický Redis Lua script:                                      │
│       IF counter < 100  →  INCR, return N                           │
│       ELSE              →  return -1 (vyčerpáno)                    │
│  4. Pokud N == -1      →  return 410 + zpráva „rozebráno"           │
│  5. Pokud N v 1..100   →  Set-Cookie count+1                        │
│                          →  return { docNumber: N,                  │
│                                       url: "/pripominky/...pdf",    │
│                                       total: N }                    │
└──────────────┬──────────────────────────────────────────────────────┘
               │ JSON response
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend                                                           │
│  - Spustí stažení PDF (vytvoří <a download> a klikne)              │
│  - Zobrazí instrukční panel:                                        │
│       „Stáhli jste si dokument #42 ze 100"                          │
│       Co dál: vyplňte → podepište → odešlete                        │
│  - Aktualizuje counter v patičce                                    │
└─────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────┐
│  Návštěvník                                                        │
│  └─ Načte stránku                                                  │
└──────────────┬─────────────────────────────────────────────────────┘
               │ GET /api/stats
               ▼
┌────────────────────────────────────────────────────────────────────┐
│  Next.js API route  /api/stats                                     │
│  - Redis GET „downloads:total"                                     │
│  - return { total: N, remaining: max(0, 100 - N) }                 │
└────────────────────────────────────────────────────────────────────┘
```

## 4. API specifikace

### `POST /api/generate`

**Request:** žádné tělo, cookie `pripominky_count` automaticky odesláno.

**Response 200 OK:**
```json
{
  "success": true,
  "docNumber": 42,
  "url": "/pripominky/pripominka_042.pdf",
  "totalDownloads": 42,
  "remaining": 58,
  "browserCount": 1
}
```

**Response 429 Too Many Requests** (klient už si stáhl 5):
```json
{
  "success": false,
  "code": "BROWSER_LIMIT",
  "message": "Z tohoto prohlížeče již bylo staženo 5 dokumentů. Sdílejte stránku s dalšími lidmi.",
  "browserCount": 5
}
```

**Response 410 Gone** (všech 100 vyčerpáno):
```json
{
  "success": false,
  "code": "EXHAUSTED",
  "message": "Všech 100 předpřipravených připomínek bylo rozebráno. Brzy doplníme další.",
  "totalDownloads": 100
}
```

**Response 500:** generická chyba, zobrazí se „Něco se pokazilo, zkuste to za chvíli znovu".

### `GET /api/stats`

**Response 200 OK:**
```json
{
  "total": 47,
  "remaining": 53,
  "capacity": 100
}
```

Cache: `Cache-Control: public, max-age=10` (krátce, abychom zbytečně netloukli do Redisu při refreshích).

## 5. UI specifikace

### Layout (single screen, no scroll)

```
┌────────────────────────────────────────────────────┐
│                                                    │
│   [Hero header — větší písmo, krátký nadpis]       │
│   „Zachráníme krajinu jižního Plzeňska."           │
│                                                    │
│   [Sub-headline — 2–3 řádky vysvětlení]            │
│   „Ministerstvo plánuje vymezit u našich obcí tři  │
│   akcelerační oblasti pro 250m vysoké větrné       │
│   elektrárny. Termín pro připomínky: 1. 6. 2026."  │
│                                                    │
│                                                    │
│   ┌───────────────────────────────────────────┐    │
│   │     VYGENEROVAT PŘIPOMÍNKU                │    │
│   │   (velké zelené / modré tlačítko)         │    │
│   └───────────────────────────────────────────┘    │
│                                                    │
│   Po stažení doplníte jméno, podepíšete a          │
│   odešlete. Trvá to 5 minut.                       │
│                                                    │
│                                                    │
│   ┌──────────────────────────────────────────┐     │
│   │  47 občanů už si stáhlo připomínku       │     │
│   │  ▓▓▓▓▓░░░░░░░░░░ 47 / 100                │     │
│   └──────────────────────────────────────────┘     │
│                                                    │
│   [Drobný text v patičce: kontakt, zdroje]         │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Klíčové texty (copy)

**H1:** Zachraňme krajinu jižního Plzeňska
**Sub-H1:** Vláda chce u našich obcí vymezit tři akcelerační oblasti pro 250 m vysoké větrné elektrárny. Občané mohou podat připomínku do 1. 6. 2026.
**CTA tlačítko:** Vygenerovat moji připomínku
**Pod CTA:** Vyberte si jednu ze 100 připravených připomínek. Doplníte jméno, podepíšete a odešlete na ministerstvo. Trvá to 5 minut.
**Counter:** „X občanů už si stáhlo připomínku." + progress bar X/100

### Stav po kliknutí (modal nebo panel přes CTA)

```
┌────────────────────────────────────────────────────┐
│ ✓ Stáhli jste si dokument #42 ze 100              │
│                                                    │
│ Co teď udělat:                                     │
│                                                    │
│ 1. Otevřete PDF a doplňte:                         │
│      jméno a příjmení                              │
│      datum narození                                │
│      adresu trvalého pobytu                        │
│      datum a podpis                                │
│                                                    │
│ 2. Odešlete na Ministerstvo pro místní rozvoj:     │
│      • datovou schránkou: 26iaava                  │
│      • nebo doporučeně poštou:                     │
│        Ministerstvo pro místní rozvoj,             │
│        Odbor územního plánování,                   │
│        Staroměstské náměstí 6, 110 00 Praha 1      │
│      • nebo e-mailem s elektronickým podpisem      │
│        na podatelna@mmr.gov.cz                     │
│                                                    │
│ Termín: do 1. 6. 2026                              │
│                                                    │
│ [Sdílet stránku]  [Stáhnout znovu]                 │
└────────────────────────────────────────────────────┘
```

### Stav „rozebráno" (po 100 stažení)

```
┌────────────────────────────────────────────────────┐
│ Všech 100 připomínek je rozebráno                  │
│                                                    │
│ Děkujeme za zájem. V krátké době doplníme další    │
│ připomínky. Vraťte se prosím za pár hodin nebo     │
│ napište na [kontakt] a pošleme vám připomínku      │
│ e-mailem.                                          │
│                                                    │
│ Pokud máte chuť, můžete připomínku napsat sami     │
│ podle [tohoto návodu](link na NÁVOD.pdf).          │
└────────────────────────────────────────────────────┘
```

### Stav „překročen limit prohlížeče" (po 5 stažení)

```
┌────────────────────────────────────────────────────┐
│ Z tohoto prohlížeče je už staženo 5 dokumentů.     │
│                                                    │
│ Sdílejte prosím stránku s dalšími lidmi —          │
│ čím víc různých občanů pošle připomínku,           │
│ tím větší dopad.                                   │
│                                                    │
│ [Zkopírovat odkaz]    [Sdílet na WhatsAppu]        │
└────────────────────────────────────────────────────┘
```

### Vizuální styl

- **Barvy:** primární zeleno-modrá kampaňová (např. `#0F766E` teal nebo `#1E40AF` modrá). Pozadí čistě bílé. CTA tlačítko jasné, kontrastní.
- **Typografie:** systémové sans-serif fonty přes Tailwind (`font-sans`), nebo Inter z Google Fonts.
- **Obrázek (volitelně):** subtilní fotka krajiny jižního Plzeňska v pozadí, nebo SVG ilustrace (větrná elektrárna škrtnutá / kopce). Pokud fotka, držet ji decentní (60% opacity, světlý overlay).
- **Mobile-first:** layout funguje na 360px šířky bez scrollování (vše vejde nad fold).
- **Velký dotykový CTA:** min. 56 px výška, plná šířka kontejneru na mobilu.
- **Žádné cookie bannery** (HttpOnly funkční cookie nevyžaduje souhlas dle českého výkladu GDPR pro technicky nezbytné cookies; v patičce stručná zmínka).

## 6. Rate limiting — detail

### Cookie

- **Název:** `pripominky_count`
- **Hodnota:** `<count>.<signature>`, kde signature je HMAC-SHA256 z `count` s tajným klíčem `COOKIE_SECRET`
- **Atributy:** `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` (30 dní)
- **Server-side logika:**
  ```
  if cookie missing or signature invalid:
      count = 0
  else:
      count = parsed
  if count >= 5:
      return 429
  count = count + 1
  Set-Cookie pripominky_count=<count>.<new_signature>
  ```

Podpisování zabrání jednoduchému editování cookie v DevTools (uživatel by si počitadlo nemohl jednoduše nastavit zpátky na 0). Vyčistit cookie ručně samozřejmě jde, ale to je akceptovaný strop.

### Atomický counter (Redis Lua)

```lua
-- KEYS[1] = "downloads:total"
-- ARGV[1] = capacity (100)
local current = redis.call('GET', KEYS[1])
if current == false then current = 0 else current = tonumber(current) end
if current >= tonumber(ARGV[1]) then return -1 end
return redis.call('INCR', KEYS[1])
```

Vrací buď nové číslo (1..100), nebo -1 při vyčerpání. Garantuje, že žádný dokument není přidělen dvěma uživatelům a žádný se nepřeskočí, ani když 1000 lidí klikne ve stejnou milisekundu.

## 7. Struktura souborů

```
pripominky-vte/
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── .env.local.example
├── public/
│   └── pripominky/
│       ├── pripominka_001.pdf
│       ├── pripominka_002.pdf
│       ├── ...
│       └── pripominka_100.pdf
└── app/
    ├── layout.tsx           ← HTML shell, meta tagy, OG
    ├── page.tsx             ← landing page (server component) — fetches /api/stats
    ├── globals.css          ← Tailwind base
    ├── components/
    │   ├── Hero.tsx
    │   ├── GenerateButton.tsx   ← klient, POST /api/generate
    │   ├── InstructionsPanel.tsx
    │   ├── ExhaustedPanel.tsx
    │   ├── LimitPanel.tsx
    │   └── StatsBar.tsx
    ├── lib/
    │   ├── redis.ts         ← Upstash Redis klient
    │   ├── cookies.ts       ← signature helper (sign/verify)
    │   └── config.ts        ← konstanty (capacity=100, limit=5)
    └── api/
        ├── generate/route.ts
        └── stats/route.ts
```

## 8. Environment variables

```
UPSTASH_REDIS_REST_URL=...        # z Upstash dashboardu
UPSTASH_REDIS_REST_TOKEN=...      # z Upstash dashboardu
COOKIE_SECRET=...                 # náhodný 32+ bajtový string (`openssl rand -hex 32`)
NEXT_PUBLIC_CAPACITY=100          # info pro UI
```

Na Vercelu: `Project → Settings → Environment Variables`. Upstash umí pomocí Vercel Marketplace integrace tyto proměnné nastavit automaticky.

## 9. Deploy

1. Vytvořit GitHub repo `pripominky-vte`, push lokálního kódu.
2. Na vercel.com → New Project → import repa.
3. Marketplace → Upstash for Redis → Add to project (1 klik). Vercel automaticky nastaví `UPSTASH_REDIS_REST_URL` a `UPSTASH_REDIS_REST_TOKEN`.
4. Doplnit `COOKIE_SECRET` ručně (vygenerovat lokálně příkazem `openssl rand -hex 32`).
5. Deploy. URL bude např. `https://pripominky-vte.vercel.app`.
6. Volitelně: přiřadit vlastní doménu (např. `zastavte-vte.cz`) v Vercel Settings → Domains.

Celý deploy zabere 5–10 minut po pushnutí kódu.

## 10. Acceptance criteria

Web je hotový, když platí všechno z následujícího:

- [ ] Z mobilu (360px šířka) i desktopu (1440px) je vidět celý layout bez scrollování — H1, sub-H1, CTA, counter v patičce.
- [ ] Kliknutím na CTA se stáhne PDF a zobrazí se instrukční panel s adresou ministerstva, datovou schránkou a termínem.
- [ ] První kliknutí (čistý prohlížeč) stáhne `pripominka_001.pdf`, druhé `pripominka_002.pdf`, ..., 100. stáhne `pripominka_100.pdf`.
- [ ] 101. kliknutí (z libovolného prohlížeče) vrátí 410 a UI zobrazí panel „rozebráno".
- [ ] 6. kliknutí ze stejného prohlížeče vrátí 429 a UI zobrazí panel „limit dosažen", i kdyby v poolu byly další dokumenty.
- [ ] Cookie `pripominky_count` má HttpOnly, Secure, SameSite=Lax. Hodnota je podepsaná HMAC.
- [ ] Counter v patičce ukazuje aktuální stav (s krátkou cache, ale aktualizuje se).
- [ ] Atomický counter: simulovaných 50 paralelních volání `/api/generate` přidělí 50 unikátních dokumentů (žádný duplicitní, žádný přeskočený).
- [ ] Žádný PDF dokument není dostupný „raw" přes URL bez jeho přidělení? — **NE, toto je akceptovaný kompromis** (PDFs jsou statické v `/public`, kdokoli může uhodnout URL `/pripominky/pripominka_017.pdf`). Hlídání by vyžadovalo Vercel Blob nebo signed URLs; není to v rozsahu MVP a riziko zneužití je nízké, protože i kdyby si je někdo stáhl všechny ručně, jen by si je sám pro sebe uložil.
- [ ] Lighthouse skóre na mobilu ≥ 90 (Performance + Accessibility + Best Practices).
- [ ] Funguje bez JavaScriptu na úrovni „vidím, o co jde a kam mám napsat" (CTA bez JS samozřejmě nefunguje, ale ostatní obsah je v HTML).

## 11. Out of scope (záměrně vynecháno z MVP)

- Captcha — přidává friction, pro 100 dokumentů a friendly publikum nepotřebné.
- Vícejazyčnost.
- Admin dashboard.
- Logování IP adres (rate limit je čistě cookie-based).
- Signed PDF URLs / DRM (PDFs jsou statické a veřejné — viz acceptance criteria).
- Backup / fallback, pokud Redis spadne (Upstash má 99.99% SLA na free tier, akceptovatelné riziko).

## 12. Po nasazení — provozní pokyny

- Sledovat `/api/stats` (např. otevřít stránku jednou za hodinu). Když je `total` blízko 100, vygenerovat nových 100 PDF (skript `generate.py` máme připraven) a buď je doplnit do `/public/pripominky/` (101–200) + zvýšit `capacity` na 200 + redeployovat, nebo `DEL downloads:total` v Upstash konzoli (nuluje counter, začne znova od 1 = znovu dostane doc 001).
- Lepší přístup: rozšířit pool. Tj. přidat soubory 101–200 a nastavit env `NEXT_PUBLIC_CAPACITY=200`. Bezvýpadkové, žádný uživatel nedostane stejný dokument jako kdokoli předtím.
