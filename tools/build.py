#!/usr/bin/env python3
"""Build the static site from src/. Python 3 standard library only.

    python3 tools/build.py          write every page, sitemap.xml and robots.txt
    python3 tools/build.py --check  only compare; exit 1 if a generated file is out of date

src/layout.html          the document around every page ({{...}} placeholders)
src/partials/*.html      header-en, header-hr, footer-en, footer-hr ({{alt}} = the other language's page)
src/pages/**/*.html      one file per page: a <!--page ... --> block with its settings, then its body.
                         <!--#header--> and <!--#footer--> mark where the partials go.
src/data/prices.json     prices; {{price:key}} in a page becomes "from € X" / "od X €" or, if empty,
                         "Price in writing after the free check".
"""
import glob, html, json, os, re, sys

SITE = 'https://donebyzip-preview.vercel.app'  # DOMAIN: change to the real domain at launch
OG_ALT = {
    'en': 'zip. — People search for you. They find someone else.',
    'hr': 'zip. — Ljudi vas traže. Pronađu nekoga drugog.',
}  # the share images are assets/og/og-<lang>.jpg (tools/make-og.js)
# Wavy lines (waves() below). One switch:
#   'all-black'  behind every black (#000) area on every page, as one continuous layer (no seams between
#                neighbouring black sections). #141414 sections and cards cover it. On long-read pages
#                (long_read()) only behind the page header (title and subtitle) and a black footer (the
#                closing CTA), never behind the text.
#   'hero'       only where a page has <!--#waves--> (home hero and section 07; the closing CTA on
#                How it works and FAQ).
WAVES = 'all-black'

# The free check form (src/partials/form-en.html, form-hr.html; marker <!--#form--> in a page).
#   ''                      the button opens WhatsApp with the two fields as a ready message (now)
#   'https://formspree.io/f/xxxxxxxx'   the form is POSTed there (fields site, contact, language, page)
FORM_ENDPOINT = ''


def long_read(route):
    """Blog articles and the privacy policy: waves only behind their header."""
    return route.startswith(('/blog/', '/hr/blog/')) or route in ('/privacy', '/hr/privatnost')


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')


def read(path):
    return open(path, encoding='utf-8').read()


def url_path(route):
    return '/' if route == '/' else route + '/'


def out_file(route):
    return 'index.html' if route == '/' else route.strip('/') + '/index.html'


PRICE_TEXT = {
    'en': dict(empty='Price in writing after the free check', fmt='from € {n}', mo='/mo'),
    'hr': dict(empty='Cijena napismeno nakon besplatne provjere', fmt='od {n} €', mo='/mj'),
}


def price(prices, key, lang, src):
    if key not in prices:
        sys.exit('%s: {{price:%s}} is not in src/data/prices.json' % (src, key))
    p, t = prices[key], PRICE_TEXT[lang]
    amount = p.get('from')
    if amount in (None, ''):
        return t['empty']
    if not isinstance(amount, (int, float)) or amount <= 0:
        sys.exit('src/data/prices.json: "%s" from must be a number of euros or null' % key)
    n = ('{:,.0f}' if float(amount).is_integer() else '{:,.2f}').format(amount)
    if lang == 'hr':  # 1.200 / 1.234,50
        n = n.replace(',', ' ').replace('.', ',').replace(' ', '.')
    return t['fmt'].format(n=n) + (t['mo'] if p.get('monthly') else '')


def waves(uid, length=760.0, spacing=96.0, amp=24.0):
    """Soft parallel wavy lines as an inline SVG (behind the home hero and section 07).
    A repeating pattern in real pixels (patternUnits=userSpaceOnUse, no viewBox), so the waves have the
    same spacing and shape at every width and height and are never stretched: one tile is one wave period
    wide and holds two lines (the second a little out of phase, so they do not look ruled).
    Static, #1a1a1a, 1.25 px. uid keeps the pattern id unique on the page."""
    import math
    step = length / 8
    def line(y0, phase):
        xs = [k * step for k in range(-1, 10)]
        pts = [(x, y0 + amp * math.sin(2 * math.pi * x / length + phase)) for x in xs]
        d = 'M%.1f %.1f' % pts[1]
        for k in range(1, len(pts) - 2):
            p0, p1, p2, p3 = pts[k - 1], pts[k], pts[k + 1], pts[k + 2]
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            d += 'C%.1f %.1f %.1f %.1f %.1f %.1f' % (c1 + c2 + p2)
        return '<path d="%s"/>' % d
    tile_h = 2 * spacing
    pid = 'zw-wave-%s' % uid
    return ('<svg class="zw-waves" aria-hidden="true" focusable="false"><defs>'
            '<pattern id="%s" width="%g" height="%g" patternUnits="userSpaceOnUse">'
            '<g fill="none" stroke="#1a1a1a" stroke-width="1.25">%s%s</g></pattern></defs>'
            '<rect width="100%%" height="100%%" fill="url(#%s)"/></svg>'
            % (pid, length, tile_h, line(spacing / 2, 0.0), line(spacing * 1.5, 0.75), pid))


PRICE_NAME = {'website': {'en': 'Website', 'hr': 'Web stranica'}}


def price_sentence(prices, key, lang, src):
    """For FAQ answers: nothing while the price is empty, else " Website: from € 790." """
    p = prices.get(key) or {}
    if p.get('from') in (None, ''):
        return ''
    name = PRICE_NAME.get(key, {}).get(lang, key)
    return ' %s: %s.' % (name, price(prices, key, lang, src))


def form(tpl, n, route):
    """The free check form with its ids made unique on the page (n) and the sending set by FORM_ENDPOINT."""
    ep = FORM_ENDPOINT.strip()
    if ep and not ep.startswith('https://'):
        sys.exit('tools/build.py: FORM_ENDPOINT must be empty or an https:// address')
    action = ('action="%s" method="post"' % html.escape(ep) if ep
              else 'action="https://wa.me/385981834111" method="get" target="_blank"')
    return (tpl.replace('{{fid}}', str(n)).replace('{{form_endpoint}}', html.escape(ep))
            .replace('{{form_action}}', action).replace('{{page}}', url_path(route)))


def load_pages():
    pages = []
    for path in sorted(glob.glob(os.path.join(SRC, 'pages', '**', '*.html'), recursive=True)):
        text = read(path)
        m = re.match(r'<!--page\n(.*?)\n-->', text, re.S)
        if not m:
            sys.exit('%s: missing <!--page ... --> block' % path)
        meta = dict(line.split(': ', 1) for line in m.group(1).split('\n'))
        meta['body'] = text[m.end():]
        meta['src'] = os.path.relpath(path, ROOT)
        pages.append(meta)
    return pages


def build():
    layout = read(os.path.join(SRC, 'layout.html'))
    partial = {os.path.basename(p)[:-5]: read(p).rstrip('\n')
               for p in glob.glob(os.path.join(SRC, 'partials', '*.html'))}
    pages = load_pages()
    prices = json.load(open(os.path.join(SRC, 'data', 'prices.json'), encoding='utf-8'))
    by_path = {url_path(p['route']): p for p in pages}
    routes = [p['route'] for p in pages]

    # Old addresses were "/#/route#anchor": send them to "/route/#anchor" before anything renders.
    hash_redirect = ('(function(h){if(h.indexOf("#/")!==0)return;var p=h.slice(1).split("#"),r=p[0];'
                     'if(%s.indexOf(r)<0)r="/";location.replace((r==="/"?"/":r+"/")+(p[1]?"#"+p[1]:""))})(location.hash)'
                     % json.dumps(sorted(routes), separators=(',', ':')))

    out = {}
    for p in pages:
        alt = by_path.get(p['alt'].split('#')[0])
        if not alt or url_path(alt['alt'].rstrip('/') or '/') != url_path(p['route']):
            sys.exit('%s: alt %s is not a page that points back' % (p['src'], p['alt']))
        en, hr = (p, alt) if p['lang'] == 'en' else (alt, p)
        alternates = '\n'.join([
            '<link rel="alternate" hreflang="en" href="%s">' % (SITE + url_path(en['route'])),
            '<link rel="alternate" hreflang="hr" href="%s">' % (SITE + url_path(hr['route'])),
            '<link rel="alternate" hreflang="x-default" href="%s">' % (SITE + url_path(en['route'])),
        ])
        body = p['body']
        # optional page settings for the footer: "footer_cta: off" drops its CTA block. The footer is black
        # (band, with waves) while it carries the CTA block, else #141414 (band-alt); "footer_band: band"
        # or "footer_band: band-alt" overrides that
        footer_cta = p.get('footer_cta', 'on') != 'off'
        footer_band = p.get('footer_band', 'band' if footer_cta else 'band-alt')
        for kind in ('header', 'footer'):
            marker = '<!--#%s-->' % kind
            if body.count(marker) != 1:
                sys.exit('%s: needs exactly one %s' % (p['src'], marker))
            part = partial['%s-%s' % (kind, p['lang'])].replace('{{alt}}', p['alt']).replace('{{footer_band}}', footer_band)
            part = re.sub(r'<!--if:footer_cta-->(.*?)<!--/if:footer_cta-->', lambda m: m.group(1) if footer_cta else '', part, flags=re.S)
            body = body.replace(marker, part)
        n_forms = iter(range(1, 100))
        body = re.sub(r'<!--#form-->', lambda m: form(partial['form-' + p['lang']], next(n_forms), p['route']), body)
        body = re.sub(r'\{\{price-sentence:([a-z0-9-]+)\}\}', lambda m: price_sentence(prices, m.group(1), p['lang'], p['src']), body)
        body = re.sub(r'\{\{price:([a-z0-9-]+)\}\}', lambda m: price(prices, m.group(1), p['lang'], p['src']), body)
        app_attr = ''
        if WAVES == 'hero':
            n_waves = iter(range(1, 100))
            body = re.sub(r'<!--#waves-->', lambda m: waves(next(n_waves)), body)
        elif WAVES == 'all-black':
            body = body.replace('<!--#waves-->', '')
            if long_read(p['route']):
                m = re.compile(r'<header(?![^>]*\bclass=)([^>]*)>').search(body, body.index('<main'))
                if not m:
                    sys.exit('%s: long-read page needs a <header> (title and subtitle) inside <main>' % p['src'])
                body = body[:m.start()] + '<header class="zw-head"%s>' % m.group(1) + waves('head') + body[m.end():]
                if body.count('<main id="main" class="') != 1:
                    sys.exit('%s: long-read page needs <main id="main" class="...">' % p['src'])
                body = body.replace('<main id="main" class="', '<main id="main" class="zw-clip ')
                if footer_band == 'band':  # a black footer (the closing CTA) gets its own layer, fading in at the top
                    if body.count('<footer class="band ') != 1:
                        sys.exit('%s: expected one <footer class="band ...">' % p['src'])
                    i = body.index('>', body.index('<footer class="band ')) + 1
                    body = body.replace('<footer class="band ', '<footer class="zw-foot band ')
                    i += len('zw-foot ')
                    body = body[:i] + waves('foot') + body[i:]
            else:
                app_attr = ' class="zw-all"'
                body = waves('page') + body
        else:
            sys.exit('tools/build.py: WAVES must be "all-black" or "hero"')
        page = layout
        for k, v in (('lang', p['lang']), ('title', p['title']), ('description', p['description']),
                     ('canonical', SITE + url_path(p['route'])), ('alternates', alternates),
                     ('hash_redirect', hash_redirect), ('app_attr', app_attr),
                     ('og_image', '%s/assets/og/og-%s.jpg' % (SITE, p['lang'])), ('og_alt', OG_ALT[p['lang']]), ('content', body)):
            page = page.replace('{{%s}}' % k, v)
        left = re.findall(r'\{\{\w+\}\}', page)
        if left:
            sys.exit('%s: unfilled %s' % (p['src'], left))
        out[out_file(p['route'])] = page

    # sitemap.xml with the EN/HR pair of every page
    urls = []
    for p in sorted(pages, key=lambda p: (p['lang'] != 'en', p['route'])):
        alt = by_path[p['alt'].split('#')[0]]
        en, hr = (p, alt) if p['lang'] == 'en' else (alt, p)
        urls.append('  <url>\n    <loc>%s</loc>\n'
                    '    <xhtml:link rel="alternate" hreflang="en" href="%s"/>\n'
                    '    <xhtml:link rel="alternate" hreflang="hr" href="%s"/>\n'
                    '    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>\n  </url>'
                    % (SITE + url_path(p['route']), SITE + url_path(en['route']),
                       SITE + url_path(hr['route']), SITE + url_path(en['route'])))
    out['sitemap.xml'] = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                          'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + '\n'.join(urls) + '\n</urlset>\n')
    out['robots.txt'] = 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' % SITE
    return out


def main():
    out = build()
    check = '--check' in sys.argv
    stale = []
    for rel, text in out.items():
        path = os.path.join(ROOT, rel)
        old = read(path) if os.path.exists(path) else None
        if old != text:
            stale.append(rel)
            if not check:
                os.makedirs(os.path.dirname(path) or ROOT, exist_ok=True)
                open(path, 'w', encoding='utf-8', newline='\n').write(text)
    if check:
        if stale:
            sys.exit('Out of date (run python3 tools/build.py): ' + ', '.join(stale))
        print('All %d generated files are up to date.' % len(out))
    else:
        print('%d files, %d written.' % (len(out), len(stale)))


if __name__ == '__main__':
    main()
