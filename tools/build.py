#!/usr/bin/env python3
"""Build the static site from src/. Python 3 standard library only.

    python3 tools/build.py          write every page, sitemap.xml and robots.txt
    python3 tools/build.py --check  only compare; exit 1 if a generated file is out of date

src/layout.html          the document around every page ({{...}} placeholders)
src/partials/*.html      header-en, header-hr, footer-en, footer-hr ({{alt}} = the other language's page)
src/pages/**/*.html      one file per page: a <!--page ... --> block with its settings, then its body.
                         <!--#header--> and <!--#footer--> mark where the partials go.
"""
import glob, json, os, re, sys

SITE = 'https://donebyzip-preview.vercel.app'  # DOMAIN: change to the real domain at launch
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')


def read(path):
    return open(path, encoding='utf-8').read()


def url_path(route):
    return '/' if route == '/' else route + '/'


def out_file(route):
    return 'index.html' if route == '/' else route.strip('/') + '/index.html'


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
        for kind in ('header', 'footer'):
            marker = '<!--#%s-->' % kind
            if body.count(marker) != 1:
                sys.exit('%s: needs exactly one %s' % (p['src'], marker))
            body = body.replace(marker, partial['%s-%s' % (kind, p['lang'])].replace('{{alt}}', p['alt']))
        app_data = ''.join(' data-%s="%s"' % (k, p[k]) for k in
                           ('required', 'invalidemail', 'sending', 'success', 'errorserver'))
        page = layout
        for k, v in (('lang', p['lang']), ('title', p['title']), ('description', p['description']),
                     ('canonical', SITE + url_path(p['route'])), ('alternates', alternates),
                     ('hash_redirect', hash_redirect), ('app_data', app_data), ('content', body)):
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
