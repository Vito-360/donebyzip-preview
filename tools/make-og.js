// Makes the two share images (1200 x 630 JPG): assets/og/og-en.jpg and assets/og/og-hr.jpg.
// Needs Playwright with Chromium (not a dependency of the site). Run from the repo root:
//   node tools/make-og.js
// It serves nothing: the page below reads the font from assets/fonts/ (inlined in memory only).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const FONT = (sub) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'assets/fonts/bricolage-grotesque-' + sub + '.woff2')).toString('base64');
const TEXT = {
  en: 'People search for you. They find someone else.',
  hr: 'Ljudi vas traže. Pronađu nekoga drugog.',
};

const page = (headline) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:B;font-weight:200 800;src:url(${FONT('latin')}) format("woff2");unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:B;font-weight:200 800;src:url(${FONT('latin-ext')}) format("woff2");unicode-range:U+0100-02BA}
html,body{margin:0;width:1200px;height:630px;background:#000;overflow:hidden}
body{position:relative;font-family:B,sans-serif}
.bar{position:absolute;left:0;top:0;bottom:0;width:16px;background:#ff3d8b}
.in{position:absolute;left:96px;right:96px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:40px}
h1{margin:0;color:#fafafa;font-weight:800;letter-spacing:-.03em;font-size:88px;line-height:.98;text-wrap:balance}
p{margin:0;color:#a1a1a9;font-weight:400;font-size:32px;letter-spacing:-.01em}
</style></head><body><div class="bar"></div><div class="in"><h1>${headline}</h1><p>donebyzip.com</p></div></body></html>`;

(async () => {
  fs.mkdirSync(path.join(ROOT, 'assets/og'), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const [lang, text] of Object.entries(TEXT)) {
    await p.setContent(page(text), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    const ok = await p.evaluate(() => document.fonts.check('800 88px B'));
    if (!ok) throw new Error('Bricolage Grotesque did not load');
    const out = path.join(ROOT, 'assets/og/og-' + lang + '.jpg');
    await p.screenshot({ path: out, type: 'jpeg', quality: 90 });
    console.log(out);
  }
  await b.close();
})();
