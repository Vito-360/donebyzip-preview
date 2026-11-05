# zip — donebyzip.com (preview)

Static site, no framework, no build step on Vercel. Every page is a real HTML file
(`/work/` → `work/index.html`), generated from `src/` by a small Python script
(standard library only) and committed to the repo.

## Editing

| What | Where |
|---|---|
| Text and layout of one page | `src/pages/…html` (e.g. `src/pages/work.html`, `src/pages/hr/radovi.html`) |
| Page title, description, form messages, the other-language page | the `<!--page … -->` block at the top of that file |
| Header / footer (one copy per language) | `src/partials/header-en.html`, `header-hr.html`, `footer-en.html`, `footer-hr.html` |
| `<head>`, tags shared by every page | `src/layout.html` |
| Footer options for one page | in its `<!--page … -->` block: `footer_cta: off` (no CTA block), `footer_band: band` (black instead of #141414) |
| Styles (compiled Tailwind + a few own rules at the end) | `assets/css/site.css` |
| Behaviour: menu, FAQ, popups, collage, form, WhatsApp pill | `assets/js/site.js` |
| Images, fonts | `assets/img/`, `assets/fonts/` (Bricolage Grotesque, woff2, OFL) |
| Domain used in canonical, hreflang, sitemap | `SITE` at the top of `tools/build.py` (comment `DOMAIN:`) |

Do not edit `index.html`, `*/index.html`, `sitemap.xml` or `robots.txt` by hand: they are generated.

## Home page

`src/pages/index.html` (EN) and `src/pages/hr/index.html` (HR), sections 01–07 in order:
hero, three problems, what the free check looks like, work, packages, questions, WhatsApp.

### Hero

No photo in the hero (decision after review, Nov 2026). Soft wavy lines instead: an inline SVG made by
`waves()` in `tools/build.py`, #1a1a1a, 1.25 px, static. It is a repeating pattern in real pixels (one wave
period wide, two lines high), so the waves look the same at every width and are never stretched.

### Waves: where they go (one setting)

`WAVES` at the top of `tools/build.py`:

- **`'all-black'`** (now, on trial): behind every black (#000) area on every page. It is one layer behind the
  whole page (`<div id="app" class="zw-all">`), so the lines run on without a seam where two black sections
  meet; black sections are transparent over it, #141414 sections and cards cover it. Exception, long-read
  pages (`long_read()` in `build.py`: blog articles EN/HR, `/privacy/`, `/hr/privatnost/`): waves only behind
  the page header (title and subtitle), fading out before the text. CSS: the `zw-all`, `zw-head`, `zw-clip`
  rules at the end of `assets/css/site.css`.
- **`'hero'`**: only where a page has the marker `<!--#waves-->`: the home hero and section 07 (EN and HR),
  and the closing "Send us your website" block on How it works and FAQ.

To go back to the hero and section 07 only: set `WAVES = 'hero'` in `tools/build.py`, then run
`python3 tools/build.py` and commit. Nothing else needs to change (the `zw-all`/`zw-head` CSS is then unused).
If the closing block on How it works and FAQ should not have waves either, delete `<!--#waves-->` from
`src/pages/how-it-works.html`, `faq.html`, `hr/kako-radi.html` and `hr/pitanja.html`.

The character-on-photo tool is kept for later: `tools/compose-hero.py` with its sources in `src/images/`
(not deployed). It writes `assets/img/hero-character.webp`; to use it again, put an `<img>` back in the hero.

### Prices

All prices are in **`src/data/prices.json`**, one entry per package or add-on:

```json
"website":     {"from": null, "monthly": false},
"maintenance": {"from": 29,   "monthly": true}
```

- `from`: amount in euros as a number (`790`, `1200`, `49.5`), or `null`.
- `null` shows "Price in writing after the free check" / "Cijena napismeno nakon besplatne provjere".
- A number shows "from € 1,200" / "od 1.200 €"; with `"monthly": true` it adds "/mo" / "/mj".
- Keys: `website`, `local-seo`, `google-ads`, `meta-ads`, `ai-assistant`, `booking-reminders`,
  `review-requests`, `maintenance`. In a page, `{{price:key}}` is replaced at build time.

Then run `python3 tools/build.py`.

## Share images (og:image)

`assets/og/og-en.jpg` (every EN page) and `assets/og/og-hr.jpg` (every HR page), 1200 × 630.
They are made from HTML by `node tools/make-og.js` (needs Playwright + Chromium; change the headline
in that file). The alt text is `OG_ALT` in `tools/build.py`.

## Building

```bash
python3 tools/build.py
```

Writes all pages, `sitemap.xml` and `robots.txt`. Commit the result. To check that nothing is out
of date (e.g. before a merge):

```bash
python3 tools/build.py --check
```

## Adding a page

1. Copy a page in `src/pages/` to the new path (`src/pages/blog/new-post.html`).
2. Change `route`, `title`, `description` and `alt` (the matching page in the other language,
   which must point back with its own `alt`).
3. Run `python3 tools/build.py`. The page, its hreflang pair and its sitemap entry are generated.

## Addresses

Pages end with a slash (`/work/`, `/hr/blog/`); `vercel.json` has `"trailingSlash": true`, so `/work`
redirects to `/work/`. Links inside a page (`#contact`, `#faq`) stay as they were. `/work/#grbic-doo`
opens that project's popup. Old addresses (`/#/blog/...`, `/#/hr#faq`) are sent to the new ones by a
small script at the top of every page.

`vercel.json` still sends `X-Robots-Tag: noindex, nofollow` and every page has
`<meta name="robots" content="noindex, nofollow">`: remove both when the site goes live.

## Prije objave

- [ ] **Cijene** u `src/data/prices.json` (sada su sve prazne; vidi "Prices" gore).
- [ ] **Prije/poslije koncepti**: sekcija još ne postoji, dodaje se na početnu kad budu gotovi.
- [ ] **Prazna polja u politici privatnosti** (`src/pages/privacy.html`, `src/pages/hr/privatnost.html`):
      ime voditelja obrade i ostala označena polja, te provjera popisa obrađivača.
- [ ] **Domena** u `tools/build.py` (`SITE`, komentar `DOMAIN:`): canonical, hreflang, sitemap, robots i og:image.
- [ ] **Maknuti noindex**: `<meta name="robots" content="noindex, nofollow">` u `src/layout.html` i
      zaglavlje `X-Robots-Tag` u `vercel.json`.

