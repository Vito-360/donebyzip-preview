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
| Styles (compiled Tailwind + a few own rules at the end) | `assets/css/site.css` |
| Behaviour: menu, FAQ, popups, collage, form, WhatsApp pill | `assets/js/site.js` |
| Images, fonts | `assets/img/`, `assets/fonts/` (Geist, woff2) |
| Domain used in canonical, hreflang, sitemap | `SITE` at the top of `tools/build.py` (comment `DOMAIN:`) |

Do not edit `index.html`, `*/index.html`, `sitemap.xml` or `robots.txt` by hand: they are generated.

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
