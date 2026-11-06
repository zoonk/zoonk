// Deterministic timeline engine: everything is a function of time t, seeked frame by frame.
(function () {
  gsap.registerPlugin(CustomEase);
  CustomEase.create("zo", "M0,0 C0.22,1 0.36,1 1,1"); // Zoonk --ease-out
  CustomEase.create("glide", "M0,0 C0.45,0 0.15,1 1,1");
  CustomEase.create("swing", "M0,0 C0.45,0 0.55,1 1,1");
  CustomEase.create(
    "spring",
    "M0,0 C0.08,0.35 0.16,0.95 0.3,1.04 0.42,1.08 0.55,1.02 0.7,1 0.85,0.995 1,1 1,1",
  );

  const stage = document.getElementById("stage");
  const params = new URLSearchParams(location.search);
  const tl = gsap.timeline({ paused: true });
  const dyns = [];

  const Z = {
    stage,
    tl,
    W: stage.offsetWidth,
    H: stage.offsetHeight,
    vertical: stage.offsetHeight > stage.offsetWidth,
    BAR: 2.4, // 100 BPM, 4/4
    dyn: (f) => dyns.push(f),
  };
  Z.BEAT = Z.BAR / 4;

  Z.el = (tag, cls, parent, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  Z.div = (cls, parent, html) => Z.el("div", cls, parent, html);
  Z.layer = (parent = stage, cls = "") => Z.div(`layer ${cls}`, parent);

  Z.icon = (name, size = 18, sw = 2, extra = "") =>
    `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ""}</svg>`;

  // Split text into word spans; supports <b> markup by keeping words inside tags.
  Z.words = (el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((c) => {
        if (c.nodeType === 3) {
          const parts = c.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(" "));
            else {
              const s = document.createElement("span");
              s.className = "w";
              s.textContent = p;
              frag.appendChild(s);
            }
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1 && !c.classList.contains("w")) walk(c);
      });
    };
    walk(el);
    return [...el.querySelectorAll(".w")];
  };

  Z.reveal = (el, t, o = {}) => {
    const ws = el._words ?? (el._words = Z.words(el));
    const { stagger = 0.06, dur = 0.9, y = 0.42, blur = 10 } = o;
    gsap.set(el, { autoAlpha: 1 });
    tl.fromTo(
      ws,
      { opacity: 0, yPercent: y * 100, filter: `blur(${blur}px)` },
      { opacity: 1, yPercent: 0, filter: "blur(0px)", duration: dur, ease: "zo", stagger },
      t,
    );
    return t + dur + stagger * (ws.length - 1);
  };
  Z.unreveal = (el, t, o = {}) => {
    const { dur = 0.5, y = -0.2, blur = 8 } = o;
    tl.to(
      el,
      {
        opacity: 0,
        yPercent: y * 100,
        filter: `blur(${blur}px)`,
        duration: dur,
        ease: "power2.in",
      },
      t,
    );
    tl.set(el, { visibility: "hidden" }, t + dur);
  };

  Z.fadeIn = (el, t, dur = 0.7, from = {}) =>
    tl.fromTo(
      el,
      { autoAlpha: 0, ...from },
      { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: dur, ease: "zo" },
      t,
    );
  Z.fadeOut = (el, t, dur = 0.5, to = {}) =>
    tl.to(el, { autoAlpha: 0, duration: dur, ease: "power2.in", ...to }, t);

  Z.window = (el, t0, t1) => {
    gsap.set(el, { autoAlpha: 0 });
    tl.set(el, { autoAlpha: 1 }, t0);
    if (t1 !== undefined) tl.set(el, { autoAlpha: 0 }, t1);
  };

  Z.rand = (seed) => {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  };

  // Returns the time the last character lands.
  Z.type = (el, text, t0, o = {}) => {
    const { cps = 15, caret = true, caretUntil, seed = 7, before = "" } = o;
    const r = Z.rand(seed);
    const times = [];
    let t = t0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      let d = (1 / cps) * (0.6 + r() * 0.8);
      if (ch === " ") d *= 1.25;
      if (".,?".includes(text[i - 1] ?? "")) d += 0.18;
      t += d;
      times.push(t);
    }
    const end = t;
    const caretEnd = caretUntil ?? end + 1.2;
    const span = Z.el("span", "typed", null);
    const car = Z.el("span", "caret", null);
    el.innerHTML = before;
    el.appendChild(span);
    if (caret) el.appendChild(car);
    Z.dyn((tt) => {
      let n = 0;
      while (n < times.length && times[n] <= tt) n++;
      span.textContent = text.slice(0, n);
      if (caret) {
        const typing = tt >= t0 && tt <= end + 0.05;
        const on = tt < caretEnd && (typing || Math.floor((tt - t0) * 1.8) % 2 === 0);
        car.style.opacity = tt < t0 - 0.6 ? 0 : on ? 1 : 0;
      }
    });
    Z.typeTimes = Z.typeTimes || [];
    times.forEach((x) => Z.typeTimes.push(x));
    return end;
  };

  Z.count = (el, from, to, t0, dur, o = {}) => {
    const { fmt = (v) => Math.round(v).toLocaleString("en-US"), ease = "power2.out" } = o;
    const e = gsap.parseEase(ease);
    Z.dyn((t) => {
      const p = Math.min(1, Math.max(0, (t - t0) / dur));
      el.textContent = fmt(from + (to - from) * e(p));
    });
  };

  // Read by scripts/cues.mjs for the mix.
  Z.cues = [];
  Z.sfx = (name, t) => Z.cues.push({ name, t: +t.toFixed(4) });

  Z.tap = (target, t, o = {}) => {
    const { parent = target, x = "50%", y = "50%", sound = true } = o;
    const dot = Z.div("tapdot", parent);
    dot.style.left = x;
    dot.style.top = y;
    gsap.set(dot, { autoAlpha: 0, scale: 0.6 });
    tl.to(dot, { autoAlpha: 1, scale: 1, duration: 0.18, ease: "power2.out" }, t - 0.18);
    tl.to(target, { scale: 0.96, duration: 0.12, ease: "power2.out" }, t);
    tl.to(target, { scale: 1, duration: 0.35, ease: "zo" }, t + 0.12);
    tl.to(dot, { autoAlpha: 0, scale: 1.6, duration: 0.45, ease: "power2.out" }, t + 0.08);
    if (sound) Z.sfx("tap", t);
  };

  Z.end = (t) => {
    Z.duration = t;
  };

  window.Z = Z;
  window.__seek = (t) => {
    tl.seek(t, true);
    dyns.forEach((f) => f(t));
  };
  window.__ready = new Promise((resolve, reject) => {
    window.__build = async (build) => {
      await document.fonts.ready;
      try {
        build(Z);
      } catch (error) {
        reject(error);
        return;
      }
      const imgs = [...document.images].map((i) =>
        i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)),
      );
      await Promise.all(imgs);
      await document.fonts.ready;
      window.__duration = Z.duration ?? tl.duration();
      window.__cues = Z.cues;
      window.__seek(+(params.get("t") ?? 0));
      resolve();
    };
  });
})();
