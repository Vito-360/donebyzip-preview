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
| Footer options for one page | in its `<!--page … -->` block: `footer_cta: off` (no CTA block). The footer is black (#000, with waves) while it has its CTA block and #141414 without it; `footer_band: band` or `footer_band: band-alt` overrides that |
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
  the page header (title and subtitle), fading out before the text, and behind the black footer with the
  closing CTA, fading in at its top. CSS: the `zw-all`, `zw-head`, `zw-clip`
  rules at the end of `assets/css/site.css`.
- **`'hero'`**: only where a page has the marker `<!--#waves-->`: the home hero and section 07 (EN and HR),
  and the closing "Send us your website" block on How it works and FAQ.

Closing CTA blocks are black (#000) like home section 07: "Send us your website" on How it works and FAQ
(EN/HR), and the footer with "Get it done by zip." on every page that has it.

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
- `null`: the Website package shows "from €[IZNOS]" / "od [IZNOS] €" (so the gap is obvious), the add-ons
  show no price. Under the three packages, once: "Exact price after the free check." / "Točnu cijenu dobijete
  nakon besplatne provjere."
- A number shows "from €1,200" / "od 1.200 €"; with `"monthly": true` it adds "/mo" / "/mj".
- Keys: `website`, `local-seo`, `google-ads`, `meta-ads`, `ai-assistant`, `booking-reminders`,
  `review-requests`, `maintenance`. In a page, `{{price:key}}` is replaced at build time.

Then run `python3 tools/build.py`.

## The free check form

Hero and section 07 on the home page (EN and HR) have the same form: website or business name, email or
WhatsApp number, button "Get the free check" / "Besplatna provjera", and a small WhatsApp link under it.
Markup and all its texts (labels, errors, messages): `src/partials/form-en.html` and `form-hr.html`; in a
page the marker `<!--#form-->` puts it there. Behaviour: `[data-form]` in `assets/js/site.js`.

Where it sends is one setting, `FORM_ENDPOINT` at the top of `tools/build.py`:

- `''`: the button opens WhatsApp with the two fields as a ready message.
- A Formspree address (now `https://formspree.io/f/mnpprlyv`): the form is sent there (fields `site`, `contact`, `language`, `page`; the hidden
  `_gotcha` field is the spam trap Formspree knows; when `contact` is an email it is also sent as `_replyto`,
  so "Reply" in Formspree's email goes to the client; `_subject` is "Free check: " + the first field, EN and HR
  alike, so the email's subject shows the site or business name). After success the form is replaced by
  "Got it. You'll hear from us within 24 hours."; on an error a WhatsApp link is shown.

To switch it on: make a form at formspree.io (it shows an address like `https://formspree.io/f/abcdwxyz`),
set its email to the one that should receive the requests, then in `tools/build.py`:

```python
FORM_ENDPOINT = 'https://formspree.io/f/abcdwxyz'
```

and run `python3 tools/build.py`. Send one test from the live preview (Formspree confirms the first one).

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

## Grane i objava

- `kopija` je radna grana: sve izmjene idu tamo, svaki commit dobije svoj Vercel preview.
- `main` je produkcija (https://donebyzip-preview.vercel.app/). Ažurira se tek kad Vito odobri, spajanjem
  `kopija` u `main` (merge, bez force-pusha i bez prepisivanja povijesti).

### Vraćanje stare verzije

Verzija stranice prije prvog spajanja `kopija` → `main` (6. 11. 2026) je commit `b30d598`, označen oznakom (tagom)
`stara-verzija`. Ako oznaka na GitHubu ne postoji, u naredbama ispod umjesto `stara-verzija` upišite `b30d598`.

**Najbrže, bez gita (Vercel):** projekt `donebyzip-preview` → Deployments → produkcijski deploy commita na koji
pokazuje `stara-verzija` (vidi `git rev-parse --short stara-verzija`) → izbornik "…" → "Promote to Production"
(ili "Instant Rollback"). Stranica se vrati za nekoliko sekundi, a `main` ostaje kakav jest; sljedeći push na
`main` opet objavljuje novu verziju.

**Trajno, preko gita** (novi commit na `main` čiji je sadržaj točno `stara-verzija`; povijest se ne prepisuje,
pa se i to može poništiti):

```bash
git fetch origin --tags
git checkout main
git pull origin main
git rm -r -q .
git checkout stara-verzija -- .
git commit -m "Vrati staru verziju (oznaka stara-verzija)"
git push origin main
```

Vercel nakon pusha sam napravi produkcijski deploy stare verzije. Nova verzija ostaje u povijesti i na grani
`kopija`; vraća se ponovnim spajanjem `kopija` u `main`.

## Prije objave

- [ ] **Cijene** u `src/data/prices.json`: Web stranica upisana (od 590 €, jednokratno); dodaci su još prazni
      (bez cijene se ne prikazuju; vidi "Prices" gore).
- [ ] **Prije/poslije koncepti**: sekcija još ne postoji, dodaje se na početnu kad budu gotovi.
- [ ] **Prazna polja u politici privatnosti** (`src/pages/privacy.html`, `src/pages/hr/privatnost.html`):
      ime voditelja obrade i ostala označena polja, te provjera popisa obrađivača.
- [ ] **Domena** u `tools/build.py` (`SITE`, komentar `DOMAIN:`): canonical, hreflang, sitemap, robots i og:image.
- [x] **Formspree račun i FORM_ENDPOINT** (vidi "The free check form"): upisan `https://formspree.io/f/mnpprlyv`.
      Provjeriti: prvi upis s live stranice potvrditi u Formspreeu i da upiti stižu na pravi e-mail.
- [ ] **Maknuti noindex**: `<meta name="robots" content="noindex, nofollow">` u `src/layout.html` i
      zaglavlje `X-Robots-Tag` u `vercel.json`.

