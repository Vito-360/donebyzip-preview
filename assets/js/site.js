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

    /* Hero: the phone shows the empty search field; "plumber near me" is typed (0.7 s) and three other
       businesses appear (done by ~1.6 s, never more than 2 s). Starts when the phone is on screen, runs
       once, stays on the end state. Reduced motion: end state at once. Everything else in the hero is
       there from the first frame. */
    $$("[data-search]").forEach((zs) => {
      const q = zs.querySelector(".zs-q-t");
      const rows = [...zs.querySelectorAll(".zs-r")];
      const done = () => zs.classList.add("zs-done");
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
      const text = q.dataset.q;
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        q.textContent = "";
        zs.classList.add("zs-typing");
        let i = 0;
        const type = () => {
          q.textContent = text.slice(0, ++i);
          if (i < text.length) return setTimeout(type, Math.round(700 / text.length));
          rows.forEach((r, k) => setTimeout(() => r.classList.add("is-in"), 100 + k * 150));
          setTimeout(done, 100 + rows.length * 150 + 400);
        };
        setTimeout(type, 100);
      }, { threshold: 0.35 });
      io.observe(zs);
    });

    /* Section 02, card "Found": "restaurant near me" is typed into the empty field (~1 s, like the hero),
       then "Your business" appears. Starts when the card is on screen, runs once, stays on the end state.
       Reduced motion: end state at once. Without JS the end state shows. */
    $$("[data-find]").forEach((zf) => {
      const q = zf.querySelector(".zf-q");
      const res = zf.querySelector(".zf-res");
      const done = () => zf.classList.add("zs-done");
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
      const text = q.dataset.q;
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        q.textContent = "";
        zf.classList.add("zs-typing");
        let i = 0;
        const type = () => {
          q.textContent = text.slice(0, ++i);
          if (i < text.length) return setTimeout(type, Math.round(1000 / text.length));
          setTimeout(() => res.classList.add("is-in"), 300);
          setTimeout(done, 750);
        };
        setTimeout(type, 300);
      }, { threshold: 0.6 });
      io.observe(zf);
    });

    /* The free check form (hero and section 07; markup in src/partials/form-*.html, texts in its data-*).
       Field 1: any text of 3+ characters. Field 2: an email, or a number with 8+ digits (may start with +).
       data-endpoint empty: opens WhatsApp with a ready message. Set (Formspree): POST, then a thank-you
       message in place of the form, or an error with a WhatsApp link. A filled honeypot (_gotcha) is
       treated as sent and nothing goes out. */
    $$("[data-form]").forEach((form) => {
      const d = form.dataset;
      const site = form.elements.site;
      const contact = form.elements.contact;
      const btn = form.querySelector(".zf-btn");
      const status = form.querySelector(".zf-status");
      let tried = false;
      const okSite = (v) => v.trim().length >= 3;
      const isEmail = (v) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v.trim());
      const okContact = (v) => isEmail(v) || /^\+?\d{8,15}$/.test(v.trim().replace(/[\s\-().\/]/g, ""));
      const check = (input, ok, msg) => {
        const err = document.getElementById(input.getAttribute("aria-describedby"));
        const good = ok(input.value);
        input.setAttribute("aria-invalid", good ? "false" : "true");
        if (err.textContent !== (good ? "" : msg)) err.textContent = good ? "" : msg;
        return good;
      };
      const checkSite = () => check(site, okSite, d.errSite);
      const checkContact = () => check(contact, okContact, d.errContact);
      site.addEventListener("input", () => { if (tried || site.getAttribute("aria-invalid") === "true") checkSite(); });
      contact.addEventListener("input", () => { if (tried || contact.getAttribute("aria-invalid") === "true") checkContact(); });
      site.addEventListener("blur", () => { if (site.value.trim()) checkSite(); });
      contact.addEventListener("blur", () => { if (contact.value.trim()) checkContact(); });
      const waUrl = () => d.wa + "?text=" + encodeURIComponent(
        d.waMsg.replace("{site}", site.value.trim()).replace("{contact}", contact.value.trim()));
      const thanks = () => {
        const p = document.createElement("p");
        p.className = "zf-ok";
        p.setAttribute("role", "status");
        p.tabIndex = -1;
        p.textContent = d.ok;
        form.replaceWith(p);
        p.focus();
      };
      const fail = () => {
        status.textContent = d.fail + " ";
        const a = document.createElement("a");
        a.href = waUrl();
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = d.failLink;
        status.append(a);
      };
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        tried = true;
        status.textContent = "";
        const a = checkSite();
        const b = checkContact();
        if (!a || !b) return (a ? contact : site).focus();
        if (form.elements._gotcha.value) return thanks();
        if (!d.endpoint) {
          const url = waUrl();
          const w = window.open(url, "_blank");
          if (w) w.opener = null;
          else location.href = url;
          return;
        }
        const label = btn.textContent;
        btn.disabled = true;
        btn.textContent = d.sending;
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 15000);
        // an email in "contact" also goes as _replyto, so "Reply" in Formspree's email goes to the client
        const body = new FormData(form);
        if (isEmail(contact.value)) body.append("_replyto", contact.value.trim());
        body.append("_subject", "Free check: " + site.value.trim()); // subject of Formspree's email (EN and HR alike)
        fetch(d.endpoint, { method: "POST", body, headers: { Accept: "application/json" }, signal: ctl.signal })
          .then((r) => { if (!r.ok) throw new Error(r.status); thanks(); })
          .catch(() => { btn.disabled = false; btn.textContent = label; fail(); })
          .finally(() => clearTimeout(timer));
      });
    });

    /* <details class="mc">: shut and tappable on phones (< 768 px), always open and inert from 768 px up, where
       the page looks as it did. Without JS they stay open. */
    {
      const mq = matchMedia("(max-width: 47.99rem)");
      const mcs = $$("details.mc");
      const apply = () => mcs.forEach((d) => {
        const s = d.querySelector("summary");
        if (mq.matches) { d.open = false; s.removeAttribute("tabindex"); }
        else { d.open = true; s.tabIndex = -1; }
      });
      mcs.forEach((d) => d.querySelector("summary").addEventListener("click", (e) => { if (!mq.matches) e.preventDefault(); }));
      apply();
      mq.addEventListener("change", apply);
    }

    /* [data-mm="N"]: on phones (< 768 px) a list shows its first N items; a "More" / "Više" button (+/-,
       aria-expanded) opens the rest. From 768 px up and without JS everything shows; nothing leaves the HTML. */
    $$("[data-mm]").forEach((list, k) => {
      const n = +list.dataset.mm;
      const items = [...list.children].filter((c) => c.tagName === "LI");
      if (items.length <= n) return;
      items.slice(n).forEach((li) => li.classList.add("mm-x"));
      list.classList.add("mm");
      if (!list.id) list.id = "mm-" + k;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mm-btn";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", list.id);
      btn.innerHTML = (list.dataset.mmLabel || (document.documentElement.lang === "hr" ? "Više" : "More")) + '<span class="mc-ico" aria-hidden="true"></span>';
      btn.addEventListener("click", () => {
        const open = !list.classList.contains("mm-open");
        list.classList.toggle("mm-open", open);
        btn.setAttribute("aria-expanded", open);
      });
      list.after(btn);
    });

    /* Services dropdown in the header: click / Enter / Space toggles, Esc closes and returns focus,
       a click or focus outside closes it. */
    $$(".zn-dd").forEach((dd) => {
      const ddBtn = dd.querySelector(".zn-dd-btn");
      const ddPanel = dd.querySelector(".zn-dd-panel");
      const setDd = (open) => { ddBtn.setAttribute("aria-expanded", open); ddPanel.hidden = !open; };
      ddBtn.addEventListener("click", () => setDd(ddBtn.getAttribute("aria-expanded") !== "true"));
      dd.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && ddBtn.getAttribute("aria-expanded") === "true") { setDd(false); ddBtn.focus(); }
      });
      dd.addEventListener("focusout", (e) => { if (!dd.contains(e.relatedTarget)) setDd(false); });
      document.addEventListener("pointerdown", (e) => { if (!dd.contains(e.target)) setDd(false); });
    });

    /* FAQ: one open at a time. The open box keeps the closed colours (question #fafafa, answer #a1a1a9);
       only the + turns into a minus. */
    const accs = $$(".acc");
    const setAcc = (acc, open) => {
      acc.dataset.open = open;
      acc.querySelector("button").setAttribute("aria-expanded", open);
    };
    // phones: every question starts closed (the first one is open from 768 px up), without the closing animation
    if (matchMedia("(max-width: 47.99rem)").matches) {
      accs.forEach((a) => { if (a.dataset.open === "true") { a.classList.add("acc-now"); setAcc(a, false); } });
      requestAnimationFrame(() => requestAnimationFrame(() => accs.forEach((a) => a.classList.remove("acc-now"))));
    }
    accs.forEach((acc) =>
      acc.querySelector("button").addEventListener("click", () => {
        const wasOpen = acc.dataset.open === "true";
        accs.forEach((a) => setAcc(a, false));
        if (!wasOpen) setAcc(acc, true);
      }),
    );

    /* Sticky "Free check" button (every page, under 768 px; markup in the footer partials): shows after the
       first screen, hidden while a [data-cta] block, a form or a section's main (pink) button is on screen:
       the hero form, section 07, the footer, "Your business", the packages (but never while its box is open). It opens a small box: role="dialog", focus moves into it and back
       to the button; closes with X, Esc or a click outside. */
    const pill = $(".sticky-cta");
    const box = $("#zc-box");
    if (pill && box) {
      let pastHero = false;
      const visible = new Set();
      const isOpen = () => !box.hidden;
      const sync = () => {
        const s = (pastHero && visible.size === 0) || isOpen();
        pill.dataset.show = s;
        pill.setAttribute("aria-hidden", !s);
        pill.tabIndex = s ? 0 : -1;
      };
      const focusables = () => [...box.querySelectorAll("a[href],button")];
      const openBox = () => {
        box.hidden = false;
        pill.setAttribute("aria-expanded", "true");
        box.focus();
        sync();
      };
      const closeBox = (refocus = true) => {
        if (!isOpen()) return;
        box.hidden = true;
        pill.setAttribute("aria-expanded", "false");
        if (refocus) pill.focus({ preventScroll: true });
        sync();
      };
      pill.addEventListener("click", () => (isOpen() ? closeBox() : openBox()));
      box.querySelector(".zc-x").addEventListener("click", () => closeBox());
      box.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); closeBox(); }
        if (e.key === "Tab") {           // keep Tab inside the box while it is open
          const f = focusables(), first = f[0], last = f[f.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
      document.addEventListener("pointerdown", (e) => {
        if (isOpen() && !box.contains(e.target) && !pill.contains(e.target)) closeBox();
      });
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
      // hidden while a form, a [data-cta] block or a section's main button (pink, .btn-primary) is on screen
      $$("[data-cta], .zf-form, #app .btn-primary:not(header .btn-primary)").forEach((el) => io.observe(el));
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

  /* Tab title while the visitor is on another tab: "Problem?", "Zip it!", "Send it!", round and round,
     every 1.5 s (the same English words on HR pages). Back on the tab, the page's own title returns at once.
     The favicon does not change. */
  (() => {
    const words = ["Problem?", "Zip it!", "Send it!"];
    let own = document.title, timer = 0;
    document.addEventListener("visibilitychange", () => {
      clearInterval(timer);
      if (document.hidden) {
        own = document.title;
        let i = 0;
        document.title = words[i];
        timer = setInterval(() => { i = (i + 1) % words.length; document.title = words[i]; }, 1500);
      } else {
        document.title = own;
      }
    });
  })();

  /* "/work/#grbic-doo" opens that project's popup. */
  init(app);
  const fromHash = () => { if (location.hash.length > 1) openWork(location.hash.slice(1)); };
  addEventListener("hashchange", fromHash);
  fromHash();
})();

