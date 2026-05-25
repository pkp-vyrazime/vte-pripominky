# PLAN — Implementační plán pro Claude Code

Tento dokument je „kuchařka" pro Claude Code. Předpokladem je přečtený `SPEC.md`. Plán je rozdělen do fází; Claude Code by měl po každé fázi commitnout a otestovat lokálně před přechodem na další.

## Předpoklady

- Node.js 20+ nainstalován lokálně
- GitHub účet (pro hostování repa)
- Vercel účet napojený na GitHub (lze přihlásit přes GitHub)
- Upstash účet (zdarma, přihlášení přes GitHub)
- 100 PDF souborů `pripominka_001.pdf` až `pripominka_100.pdf` připraveno (mám je v `/Users/matej.prokop/Documents/vte/pripominky_100/`)

## Fáze 0 — Scaffolding (15 min)

1. `npx create-next-app@latest pripominky-vte` s volbami:
   - TypeScript: **Yes**
   - ESLint: **Yes**
   - Tailwind CSS: **Yes**
   - `src/` directory: **No**
   - App Router: **Yes**
   - Import alias: defaultní
2. `cd pripominky-vte`
3. Nainstalovat závislosti:
   ```
   npm install @upstash/redis
   ```
4. Vytvořit `.env.local.example` (viz SPEC sekce 8) a `.env.local` (s testovacími hodnotami).
5. Inicializovat git, první commit.
6. Vytvořit prázdné GitHub repo `pripominky-vte`, pushnout.

**Akceptační kritérium:** `npm run dev` spustí prázdnou Next.js stránku na `localhost:3000`.

## Fáze 1 — PDF soubory (5 min)

1. Vytvořit `public/pripominky/`.
2. Zkopírovat všech 100 PDF souborů z `/Users/matej.prokop/Documents/vte/pripominky_100/` do `public/pripominky/`.
3. Ověřit, že URL `http://localhost:3000/pripominky/pripominka_001.pdf` v lokálním devu PDF servíruje.

**Akceptační kritérium:** GET na PDF URL vrací 200 a soubor se otevře v prohlížeči.

## Fáze 2 — Konfigurace a knihovny (20 min)

### `app/lib/config.ts`
```typescript
export const CAPACITY = 100;
export const BROWSER_LIMIT = 5;
export const COOKIE_NAME = 'pripominky_count';
export const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 dní
export const REDIS_COUNTER_KEY = 'downloads:total';
```

### `app/lib/redis.ts`
```typescript
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

### `app/lib/cookies.ts`
- Funkce `signCount(count: number): string` → `"<count>.<hmac>"`
- Funkce `verifyCount(value: string): number | null` → parsuje a ověří HMAC, vrátí count nebo null
- Použít `crypto.createHmac('sha256', process.env.COOKIE_SECRET!)` (Node built-in, žádná závislost navíc)

**Akceptační kritérium:** Unit test (nebo `console.log` debug):
- `signCount(3)` vrátí např. `"3.a4f5..."`.
- `verifyCount("3.a4f5...")` vrátí 3.
- `verifyCount("3.WRONG")` vrátí null.

## Fáze 3 — API route `/api/generate` (45 min)

`app/api/generate/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { redis } from '@/app/lib/redis';
import { signCount, verifyCount } from '@/app/lib/cookies';
import { CAPACITY, BROWSER_LIMIT, COOKIE_NAME, COOKIE_MAX_AGE_S, REDIS_COUNTER_KEY } from '@/app/lib/config';

const INCR_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current == false then current = 0 else current = tonumber(current) end
if current >= tonumber(ARGV[1]) then return -1 end
return redis.call('INCR', KEYS[1])
`;

export async function POST() {
  // 1) Cookie counter
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
  const browserCount = cookieValue ? (verifyCount(cookieValue) ?? 0) : 0;

  if (browserCount >= BROWSER_LIMIT) {
    return NextResponse.json(
      {
        success: false,
        code: 'BROWSER_LIMIT',
        message: `Z tohoto prohlížeče již bylo staženo ${BROWSER_LIMIT} dokumentů. Sdílejte stránku s dalšími lidmi.`,
        browserCount,
      },
      { status: 429 }
    );
  }

  // 2) Atomický INCR v Redisu
  const result = await redis.eval(INCR_SCRIPT, [REDIS_COUNTER_KEY], [CAPACITY]) as number;

  if (result === -1) {
    return NextResponse.json(
      {
        success: false,
        code: 'EXHAUSTED',
        message: 'Všech 100 předpřipravených připomínek bylo rozebráno. Brzy doplníme další.',
        totalDownloads: CAPACITY,
      },
      { status: 410 }
    );
  }

  const docNumber = result;
  const newBrowserCount = browserCount + 1;

  // 3) Set cookie
  const response = NextResponse.json({
    success: true,
    docNumber,
    url: `/pripominky/pripominka_${String(docNumber).padStart(3, '0')}.pdf`,
    totalDownloads: docNumber,
    remaining: CAPACITY - docNumber,
    browserCount: newBrowserCount,
  });

  response.cookies.set(COOKIE_NAME, signCount(newBrowserCount), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_S,
  });

  return response;
}
```

**Akceptační kritéria:**
- `curl -X POST http://localhost:3000/api/generate -c cookies.txt` → vrátí `docNumber: 1`, nastaví cookie.
- 5x curl se stejnou cookie → 1, 2, 3, 4, 5; 6. vrátí 429.
- Spočítat klíč v Upstash konzoli — sedí s počtem volání.

## Fáze 4 — API route `/api/stats` (10 min)

`app/api/stats/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { redis } from '@/app/lib/redis';
import { CAPACITY, REDIS_COUNTER_KEY } from '@/app/lib/config';

export async function GET() {
  const total = (await redis.get<number>(REDIS_COUNTER_KEY)) ?? 0;
  return NextResponse.json(
    { total, remaining: Math.max(0, CAPACITY - total), capacity: CAPACITY },
    { headers: { 'Cache-Control': 'public, max-age=10, s-maxage=10' } }
  );
}
```

**Akceptační kritérium:** `curl http://localhost:3000/api/stats` vrátí JSON s aktuálním stavem.

## Fáze 5 — UI komponenty (90 min)

Pořadí implementace:

### 5.1 `app/page.tsx` (server component)
- Server-side fetch `/api/stats` (pomocí `fetch` s `cache: 'no-store'`)
- Předá `initialStats` do klient komponent
- Layout: flex column, full height, header / hero / CTA / stats footer

### 5.2 `app/components/Hero.tsx`
- H1 + sub-headline
- Pure HTML, žádný state

### 5.3 `app/components/GenerateButton.tsx` (`'use client'`)
- State: `idle | loading | success | exhausted | limit | error`
- Při kliknutí: POST `/api/generate`, zpracovat odpověď:
  - 200 → spustit stažení (`<a download>` trick), přepnout state na `success`, předat docNumber rodičovi
  - 429 → state `limit`
  - 410 → state `exhausted`
  - jiné → state `error`
- Renderuje různé panely podle stavu:
  - `idle` → CTA tlačítko
  - `loading` → spinner v tlačítku
  - `success` → InstructionsPanel
  - `exhausted` → ExhaustedPanel
  - `limit` → LimitPanel
  - `error` → krátká zpráva + tlačítko „Zkusit znovu"

### 5.4 `app/components/InstructionsPanel.tsx`
- Props: `docNumber: number`
- Hotový copy z SPEC sekce 5
- Tlačítka:
  - „Sdílet stránku" → `navigator.share?.()` nebo fallback na `navigator.clipboard.writeText(window.location.href)`
  - „Stáhnout znovu" → znovu spustí stažení stejného PDF (z URL z předchozí response)

### 5.5 `app/components/ExhaustedPanel.tsx`
- Statický panel se zprávou z SPEC
- Link na NÁVOD.pdf (umístit do `public/`, nebo externí na zastavte.cz)

### 5.6 `app/components/LimitPanel.tsx`
- Statický panel se zprávou z SPEC
- Tlačítko „Zkopírovat odkaz" → `navigator.clipboard.writeText(window.location.href)` + toast „Zkopírováno"
- Volitelně: WhatsApp share link

### 5.7 `app/components/StatsBar.tsx` (`'use client'`)
- Props: `initialTotal: number`
- State: `total: number`
- Při mountu: `setInterval(() => fetch('/api/stats').then(...), 15000)` — refresh každých 15 s
- Při úspěšném `/api/generate` zvedne se total optimisticky (přes prop / context z page)
- Render: „**47** občanů už si stáhlo připomínku" + progress bar `47/100`

### Styling

- Tailwind utility classes
- Hlavní barva (primární): `teal-700` (#0F766E) nebo `blue-700` (#1D4ED8) — zvolit jednu a držet
- Background: čistě bílá nebo `slate-50`
- Hero text: `text-4xl md:text-5xl font-bold` na H1
- CTA: `w-full md:w-auto px-12 py-5 text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl`
- Vše vejít do `max-w-2xl mx-auto`
- Responzivní: `flex flex-col min-h-screen justify-between p-6 md:p-10`

**Akceptační kritérium:**
- Otevřít stránku na mobilu (DevTools Responsive 360×640): vidím celý obsah bez scrollování.
- Kliknutí na CTA → stáhne se PDF + zobrazí se instrukční panel.
- 6. kliknutí → zobrazí se limit panel.

## Fáze 6 — Meta, OG, finální polish (30 min)

### `app/layout.tsx`
- `<html lang="cs">`
- Meta tagy:
  - `<title>Zachraňme krajinu jižního Plzeňska — připomínky k AOV</title>`
  - `<meta name="description" content="...">`
  - Open Graph + Twitter cards pro pěkné sdílení (obrázek `/public/og.png` 1200×630)
- Žádný globální header (vejde se vše na page).
- Stručná patička: kontakt + odkazy na zdroje (zastavte.cz, krajinalidi.cz, mmr.gov.cz)

### Vytvořit OG obrázek
- Buď ručně v Canva/Figma 1200×630 px, nebo dynamicky přes `@vercel/og` (overkill pro MVP).

### Lighthouse audit
- Spustit Lighthouse v Chrome DevTools.
- Cíl: ≥ 90 ve všech kategoriích na mobilu.
- Pravděpodobné drobnosti: alt texty, `lang="cs"`, kontrast.

## Fáze 7 — Deploy na Vercel (15 min)

1. Push do GitHub main branche.
2. Na vercel.com → New Project → import repo `pripominky-vte`.
3. Framework: auto-detect Next.js. Klik na Deploy.
4. Po prvním deployi (build proběhne, ale Redis ještě nepřipojen):
   - Project Settings → Integrations → Marketplace → **Upstash for Redis** → Add to project
   - Vercel automaticky nastaví `UPSTASH_REDIS_REST_URL` a `UPSTASH_REDIS_REST_TOKEN`
5. Doplnit `COOKIE_SECRET`:
   - Lokálně vygenerovat: `openssl rand -hex 32` → zkopírovat
   - Vercel → Project → Settings → Environment Variables → Add `COOKIE_SECRET`
6. Spustit redeploy (Deployments → ... → Redeploy).
7. Otestovat na produkční URL (např. `https://pripominky-vte.vercel.app`):
   - První klik → stáhne PDF 001
   - Stats sekce ukáže 1/100

## Fáze 8 — Smoke test po deployi (15 min)

Manuálně projít acceptance criteria z SPEC sekce 10:
- [ ] Mobile layout (DevTools Responsive 360×640) bez scrollu.
- [ ] Desktop layout (1440×900) bez scrollu.
- [ ] Klik na CTA stáhne PDF.
- [ ] InstructionsPanel se zobrazí s adresou a datovou schránkou.
- [ ] 6. klik z prohlížeče → LimitPanel.
- [ ] Statistika v patičce se mění.
- [ ] Stránka odpoví do 1 s.

**Stress test (volitelně):**
```
for i in $(seq 1 50); do curl -X POST https://...vercel.app/api/generate & done; wait
```
Zkontrolovat v Upstash konzoli, že `downloads:total` přesně sedí. Žádný dokument nevypadl, žádné duplicitní docNumber.

## Fáze 9 — Předání (5 min)

- Předat URL uživateli.
- Krátký Slack/e-mail update: „nasazeno, můžeme rozšiřovat".
- Dokumentovat v README:
  - Jak přidat dalších N PDF (přidat do `public/pripominky/`, zvýšit `CAPACITY` v `app/lib/config.ts`, redeploy).
  - Jak resetovat counter (Upstash konzole → DEL `downloads:total`).

## Časový odhad

| Fáze | Doba | Kdo |
|---|---|---|
| 0 — Scaffolding | 15 min | Claude Code |
| 1 — PDF soubory | 5 min | Claude Code |
| 2 — Lib | 20 min | Claude Code |
| 3 — `/api/generate` | 45 min | Claude Code |
| 4 — `/api/stats` | 10 min | Claude Code |
| 5 — UI | 90 min | Claude Code |
| 6 — Meta + Lighthouse | 30 min | Claude Code |
| 7 — Deploy | 15 min | Uživatel (klikání na Vercelu) |
| 8 — Smoke test | 15 min | Uživatel |
| 9 — Předání | 5 min | — |
| **Celkem** | **~4 h** | |

Realisticky **half-day projekt**. Pokud Claude Code pojede paralelně a uživatel mezitím připraví Vercel a Upstash účty, lze stihnout za 2–3 hodiny od „start" do „web je živý".

## Příkazy pro Claude Code — TL;DR

```bash
# Fáze 0
npx create-next-app@latest pripominky-vte
cd pripominky-vte
npm install @upstash/redis

# Fáze 1
mkdir -p public/pripominky
cp /Users/matej.prokop/Documents/vte/pripominky_100/*.pdf public/pripominky/

# Fáze 2–6: viz výše

# Fáze 7
git add . && git commit -m "feat: připomínky k AOV — MVP"
git push origin main
# → dál na vercel.com
```

## Co dělat, když něco nefunguje

| Problém | Pravděpodobná příčina | Řešení |
|---|---|---|
| `/api/generate` vrací 500 | Špatné Upstash env vars | Zkontrolovat v Vercel Settings → Environment Variables; redeploy |
| Counter zůstává na 0 | Redis volání neproběhlo (timeout, špatný token) | Otestovat `redis.get('downloads:total')` přímo v API route s `console.log` |
| Cookie se nenastavuje | `Secure` flag na localhostu | Použít `secure: process.env.NODE_ENV === 'production'` (viz kód) |
| 6. klik prošel místo blokace | HMAC podpis nebo `verifyCount` chyba | Log `cookieValue` a `parsed` v `/api/generate`; ověřit COOKIE_SECRET je stejný v lokálu a produkci |
| Layout scrolluje na mobilu | Nějaký prvek je moc velký | DevTools → Outline elements, najít největší padding/margin |
| Stats se nemění v UI | `cache: 'force-cache'` v fetch | Změnit na `cache: 'no-store'` nebo `next: { revalidate: 10 }` |
