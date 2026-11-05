/* zip — the site's behaviour without React: menu, FAQ, collage, popups, countdown, WhatsApp pill. Every page is its own HTML file. */
(() => {
  const app = document.getElementById("app");

  function init(root) {
    const $ = (s) => root.querySelector(s);
    const $$ = (s) => [...root.querySelectorAll(s)];

    /* Mobile menu */
    const btn = $('button[aria-controls="nav-menu"]');
    const panel = $("#nav-menu");
    if (btn && panel) {
      const setMenu = (open) => {
        panel.dataset.open = open;
        panel.toggleAttribute("inert", !open);
        btn.setAttribute("aria-expanded", open);
        btn.querySelectorAll("i").forEach((i) => i.classList.toggle("-rotate-45", open));
      };
      btn.onclick = () => setMenu(panel.dataset.open !== "true");
      panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
      document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));
      document.addEventListener("pointerdown", (e) => {
        if (!panel.contains(e.target) && !btn.contains(e.target)) setMenu(false);
      });
    }

    /* FAQ: one open at a time, the open one turns white */
    const accs = $$(".acc");
    const setAcc = (acc, open) => {
      acc.dataset.open = open;
      acc.querySelector("button").setAttribute("aria-expanded", open);
      acc.classList.toggle("border-transparent", open);
      acc.classList.toggle("bg-fg", open);
      acc.classList.toggle("text-void", open);
      acc.classList.toggle("border-line", !open);
      acc.classList.toggle("bg-card-hi/60", !open);
      acc.classList.toggle("text-fg", !open);
      const plus = acc.querySelector(".acc-plus");
      plus.classList.toggle("bg-black/10", open);
      plus.classList.toggle("bg-white/10", !open);
      const p = acc.querySelector(".acc-panel p");
      p.classList.toggle("text-black/65", open);
      p.classList.toggle("text-fg-2", !open);
    };
    accs.forEach((acc) =>
      acc.querySelector("button").addEventListener("click", () => {
        const wasOpen = acc.dataset.open === "true";
        accs.forEach((a) => setAcc(a, false));
        if (!wasOpen) setAcc(acc, true);
      }),
    );

    /* Tilted work tiles: tap straightens one and shows its "Details" link */
    const tiles = $$(".tile");
    const UP = "[transform:translateY(-10px)_scale(1.07)]";
    const DOWN = ["[transform:rotateX(14deg)_rotateZ(var(--rot))]", "[@media(hover:hover)]:hover:[transform:translateY(-6px)_rotateZ(0deg)_scale(1.03)]"];
    tiles.forEach((tile, i) => {
      tile.querySelector("button").addEventListener("click", () => {
        const wasUp = tile.classList.contains(UP);
        tiles.forEach((t, j) => {
          const up = t === tile && !wasUp;
          t.classList.toggle(UP, up);
          DOWN.forEach((c) => t.classList.toggle(c, !up));
          t.style.zIndex = up ? 20 : j + 1;
          t.querySelector("button").setAttribute("aria-pressed", up);
          t.querySelector("[data-tile-link]").hidden = !up;
        });
      });
    });

    /* Sticky WhatsApp pill: after the hero, hidden while another [data-cta] block is on screen */
    const pill = $(".sticky-cta");
    if (pill) {
      let pastHero = false;
      const visible = new Set();
      const sync = () => {
        const s = pastHero && visible.size === 0;
        pill.dataset.show = s;
        pill.setAttribute("aria-hidden", !s);
        pill.tabIndex = s ? 0 : -1;
      };
      const onScroll = () => {
        if (!root.contains(pill)) return removeEventListener("scroll", onScroll);
        pastHero = scrollY > innerHeight * 0.85;
        sync();
      };
      addEventListener("scroll", onScroll, { passive: true });
      const io = new IntersectionObserver(
        (es) => { es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))); sync(); },
        { threshold: 0, rootMargin: "0px 0px -80px 0px" },
      );
      $$("[data-cta]").forEach((el) => io.observe(el));
      onScroll();
    }

    /* "Trusted" card: 3, 2, 1, 0, one second each; at 0 the warning shows, 2 s pause, then again.
       Runs only while the card is on screen. With reduced motion it stays "3 s". */
    $$("[data-countdown]").forEach((el) => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const num = el.querySelector(".zh-cd-n");
      let n = 3, timer = 0, on = false;
      const draw = () => { num.textContent = n; el.classList.toggle("is-zero", n === 0); };
      const tick = () => {
        if (!on) return;
        n = n === 0 ? 3 : n - 1;
        draw();
        timer = setTimeout(tick, n === 0 ? 2000 : 1000);
      };
      new IntersectionObserver(([e]) => {
        clearTimeout(timer);
        on = e.isIntersecting;
        if (on) { n = 3; draw(); timer = setTimeout(tick, 1000); }
      }, { threshold: 0.5 }).observe(el.closest("article") || el);
    });

    /* /work: each card opens its <dialog data-work> popup; arrows step through */
    const dialogs = $$("dialog[data-work]");
    $$("main ul > li > button").forEach((b, i) => b.addEventListener("click", () => openWork(dialogs[i]?.dataset.work)));
    dialogs.forEach((d, i) => {
      const [prev, next] = d.querySelectorAll("span.ml-auto button");
      const step = (dir) => openWork(dialogs[(i + dir + dialogs.length) % dialogs.length].dataset.work);
      prev?.addEventListener("click", () => step(-1));
      next?.addEventListener("click", () => step(1));
      d.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      });
      d.querySelector('button[aria-label="Close"],button[aria-label="Zatvori"]').onclick = () => d.close();
      d.addEventListener("click", (e) => e.target === d && d.close());
      d.addEventListener("close", () => {
        if (!app.querySelector("dialog[open]")) {
          document.body.style.overflow = "";
          history.replaceState(null, "", location.pathname + location.search);
        }
      });
    });

    glass(root);
  }

  function openWork(slug) {
    const d = slug && app.querySelector(`dialog[data-work="${CSS.escape(slug)}"]`);
    if (!d) return false;
    app.querySelectorAll("dialog[open]").forEach((x) => x !== d && x.close());
    if (!d.open) d.showModal();
    d.querySelector("p[tabindex]")?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    history.replaceState(null, "", "#" + slug);
    return true;
  }

  /* Liquid-glass edge refraction — Chromium only; Safari keeps the frosted .glass look */
  const cache = new Map();
  let uid = 0;
  function lensMap(w, h, r, band) {
    const key = `${w}x${h}x${r}x${band}`;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    const im = ctx.createImageData(w, h), d = im.data, cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + 0.5 - cx, py = y + 0.5 - cy;
      const qx = Math.abs(px) - (cx - r), qy = Math.abs(py) - (cy - r);
      const dist = r - (Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0));
      let nx = 0, ny = 0;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; nx = (qx / l) * Math.sign(px); ny = (qy / l) * Math.sign(py); }
      else if (qx > qy) nx = Math.sign(px);
      else ny = Math.sign(py);
      const m = dist < band ? Math.pow(1 - Math.max(dist, 0) / band, 2) : 0;
      const i = (y * w + x) * 4;
      d[i] = 128 - nx * m * 127; d[i + 1] = 128 - ny * m * 127; d[i + 2] = 128; d[i + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    const url = c.toDataURL();
    cache.set(key, url);
    return url;
  }
  function glass(root) {
    const ua = navigator.userAgent;
    if (!/Chrome\/\d+/.test(ua) || /Firefox|CriOS|FxiOS|EdgiOS/.test(ua)) return;
    if (matchMedia("(prefers-reduced-transparency: reduce)").matches) return;
    const NS = "http://www.w3.org/2000/svg";
    let svg = document.getElementById("glass-fx");
    if (!svg) {
      svg = document.createElementNS(NS, "svg");
      svg.id = "glass-fx";
      svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.setAttribute("aria-hidden", "true");
      svg.style.position = "absolute";
      svg.appendChild(document.createElementNS(NS, "defs"));
      document.body.appendChild(svg);
    }
    const defs = svg.firstChild;
    const apply = (el) => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (w < 8 || h < 8) return;
      const r = Math.min(h / 2, parseFloat(getComputedStyle(el).borderTopLeftRadius) || h / 2);
      const id = el.dataset.fid || (el.dataset.fid = `glass-f${++uid}`);
      let f = document.getElementById(id);
      if (!f) { f = document.createElementNS(NS, "filter"); f.id = id; f.setAttribute("color-interpolation-filters", "sRGB"); defs.appendChild(f); }
      const map = lensMap(w, h, Math.round(r), Math.min(22, Math.round(h * 0.42)));
      if (!map) return;
      f.innerHTML =
        `<feImage href="${map}" x="0" y="0" width="${w}" height="${h}" result="map"/>` +
        `<feDisplacementMap in="SourceGraphic" in2="map" scale="${Math.round(Math.min(46, h * 0.7))}" xChannelSelector="R" yChannelSelector="G"/>`;
      el.style.backdropFilter = `url(#${id}) blur(1.2px) saturate(1.7) brightness(1.08)`;
    };
    const ro = new ResizeObserver((es) => es.forEach((e) => apply(e.target)));
    root.querySelectorAll("[data-refract]").forEach((el) => ro.observe(el));
  }

  /* "/work/#grbic-doo" opens that project's popup. */
  init(app);
  const fromHash = () => { if (location.hash.length > 1) openWork(location.hash.slice(1)); };
  addEventListener("hashchange", fromHash);
  fromHash();
})();

