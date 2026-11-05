#!/usr/bin/env python3
"""Put the drawn character (on a green screen) onto the hero photo.

    python3 tools/compose-hero.py                 # uses src/images/hero-photo.jpg + hero-character-green.jpg
    python3 tools/compose-hero.py --photo P --character C [--head-top 640 --center-x 395 ...]

Writes
    assets/img/hero-character.webp        (a) the character pure white, as in the videos  <- used on the site
    assets/img/hero-character-warm.webp   (b) the white body slightly warmed by the scene's light
    both 900 x 1125 (4:5), WebP.

Needs Pillow and numpy (pip install pillow numpy). Not part of the site build.

How it works
1. Key out the green: the character is black and white, so for every pixel
   alpha = 1 - (G - max(R, B)) / (the same for the background green). Edge pixels are un-mixed from the green,
   and their colour is made neutral grey, so there is no green fringe. Anything clearly not green is fully opaque.
2. The figure is cut at the knees (--knee-frac of its height; the drawing has no knee line) and scaled so the
   head top is at --head-top and the knees sit on the bottom edge of the photo. --center-x places it
   horizontally; it must stay in the left half (the window on the right stays clear).
3. --blur boxes (x0,y0,x1,y1 in photo pixels) are blurred first, e.g. a chalk board across the street.
4. Cover-scale to 900 x 1125 and save. No shadows are added.
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_W, OUT_H = 900, 1125


def key_out(img):
    """RGB on green -> RGBA, neutral colours, no green spill."""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # background colour from the four corners
    h, w = r.shape
    corners = np.concatenate([a[:20, :20].reshape(-1, 3), a[:20, -20:].reshape(-1, 3),
                              a[-20:, :20].reshape(-1, 3), a[-20:, -20:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    green = g - np.maximum(r, b)
    bg_green = bg[1] - max(bg[0], bg[2])
    alpha = 1.0 - np.clip((green - 18.0) / (bg_green - 18.0 - 12.0), 0.0, 1.0)  # <18: opaque, near bg: clear
    alpha[green < 18.0] = 1.0
    # un-mix from the green using R and B (the character itself is grey), then make it neutral
    safe = np.maximum(alpha, 1e-3)
    fr = (r - (1 - alpha) * bg[0]) / safe
    fb = (b - (1 - alpha) * bg[2]) / safe
    grey = np.clip((fr + fb) / 2.0, 0, 255)
    grey[alpha >= 1.0] = np.clip(((r + g + b) / 3.0)[alpha >= 1.0], 0, 255)  # opaque: keep its own grey
    # The whole figure is outlined in black, so every half-transparent edge pixel is outline: make it black.
    # (Un-mixing JPEG ringing would otherwise leave a faint light halo around the line.)
    grey[alpha < 1.0] = 0.0
    out = np.dstack([grey, grey, grey, alpha * 255.0])
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), 'RGBA')


def warm(layer, photo, box, strength=0.25, top=0.95, bottom=0.82):
    """(b): tint the white towards the scene's lamp light and let it fall off towards the floor."""
    p = np.asarray(photo.convert('RGB')).astype(np.float32)
    x0, y0, x1, y1 = box
    sample = p[max(0, y0):y1, max(0, x0):x1].reshape(-1, 3)
    bright = sample[sample.sum(1) > np.percentile(sample.sum(1), 90)]  # the lit parts of the wall behind him
    tint = bright.mean(0) / bright.mean(0).max()
    a = np.asarray(layer).astype(np.float32)
    h = a.shape[0]
    fall = np.linspace(top, bottom, h)[:, None]
    for c in range(3):
        a[..., c] = a[..., c] * ((1 - strength) + strength * tint[c]) * fall
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), 'RGBA')


def blur_boxes(photo, boxes, radius=6, feather=10):
    for x0, y0, x1, y1 in boxes:
        blurred = photo.filter(ImageFilter.GaussianBlur(radius))
        mask = Image.new('L', photo.size, 0)
        mask.paste(255, (x0, y0, x1, y1))
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
        photo = Image.composite(blurred, photo, mask)
    return photo


def cover(img, w, h):
    s = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--photo', default=os.path.join(ROOT, 'src/images/hero-photo.jpg'))
    ap.add_argument('--character', default=os.path.join(ROOT, 'src/images/hero-character-green.jpg'))
    ap.add_argument('--head-top', type=float, default=640, help='photo y of the top of the head (below the shelves)')
    ap.add_argument('--center-x', type=float, default=382, help='photo x of the middle of the figure')
    ap.add_argument('--knee-frac', type=float, default=0.79, help='knees, as a fraction of the drawn figure height')
    ap.add_argument('--blur', default='795,418,897,478', help='boxes to blur, "x0,y0,x1,y1;..." in photo pixels')
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets/img'))
    ap.add_argument('--quality', type=int, default=84)
    o = ap.parse_args()

    photo = Image.open(o.photo).convert('RGB')
    if o.blur:
        photo = blur_boxes(photo, [tuple(int(v) for v in b.split(',')) for b in o.blur.split(';')])

    layer = key_out(Image.open(o.character))
    alpha = np.asarray(layer)[..., 3]
    ys, xs = np.where(alpha > 128)
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    knee = int(top + o.knee_frac * (bottom - top))
    layer = layer.crop((left, top, right + 1, knee))

    scale = (photo.height - o.head_top) / layer.height
    layer = layer.resize((round(layer.width * scale), photo.height - round(o.head_top)), Image.LANCZOS)
    x = round(o.center_x - layer.width / 2)
    y = photo.height - layer.height
    if x < 0 or x + layer.width > photo.width / 2:
        sys.exit('The figure spans x %d..%d: it must stay inside the left half (0..%d).' % (x, x + layer.width, photo.width // 2))
    print('figure in photo pixels: x %d..%d, y %d..%d (%.0f%% of the height)' % (
        x, x + layer.width, y, photo.height, 100 * layer.height / photo.height))

    versions = {
        'hero-character.webp': layer,
        'hero-character-warm.webp': warm(layer, photo, (x - 150, y - 250, x + layer.width + 150, y + 200)),
    }
    os.makedirs(o.out, exist_ok=True)
    for name, fig in versions.items():
        comp = photo.convert('RGBA')
        comp.alpha_composite(fig, (x, y))
        final = cover(comp.convert('RGB'), OUT_W, OUT_H)
        path = os.path.join(o.out, name)
        final.save(path, 'WEBP', quality=o.quality, method=6)
        print(path, final.size, os.path.getsize(path) // 1024, 'KB')


if __name__ == '__main__':
    main()
