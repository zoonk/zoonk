// Scene helpers: text, cards, the phone, and real-screen stills and sequences.
(function () {
  const { div, tl } = Z;
  const K = {};
  const lang = new URLSearchParams(location.search).get("lang") === "pt" ? "pt" : "en";
  Z.lang = lang;
  Z.C = COPY[lang];
  const ROOT = "../../assets/real";
  K.zu = (name, size) =>
    `<img src="../../assets/svg/${name}.svg" style="width:${size}px;height:${size}px;display:block">`;

  // Headlines break only at <br>; the font shrinks until each line fits the column.
  K.fit = (el, maxW, min = 56) => {
    el.style.whiteSpace = "nowrap";
    let size = parseFloat(el.style.fontSize);
    while (el.scrollWidth > maxW + 1 && size > min) {
      size -= 2;
      el.style.fontSize = `${size}px`;
    }
  };
  K.say2 = (L, o, tIn, tOut) => {
    const r = K.say(L, { stagger: 0.045, subAt: tIn + 0.35, ...o }, tIn, tOut);
    K.fit(r.h, o.w);
    return r;
  };

  // A screen image filling the phone below the status bar.
  K.still = (screen, name, o = {}) => {
    const box = div("abs", screen);
    box.style.cssText = "left:0;top:50px;width:390px;height:794px;overflow:hidden;background:#fff";
    const img = Z.el("img", "", box);
    img.src = `${ROOT}/${o.lang ?? lang}/${name}.png`;
    img.style.cssText = "display:block;width:390px;height:794px";
    gsap.set(box, { autoAlpha: 0 });
    return box;
  };

  // A captured interaction: frames shown in turn between t0 and t1, weighted by their hold.
  K.seq = (screen, name, t0, t1, o = {}) => {
    const man = MANIFESTS[o.lang ?? lang][name];
    if (!man) throw new Error(`no sequence ${lang}/${name}`);
    const box = div("abs", screen);
    box.style.cssText = "left:0;top:50px;width:390px;height:794px;overflow:hidden;background:#fff";
    const frames =
      o.from !== undefined || o.to !== undefined ? man.slice(o.from ?? 0, o.to ?? man.length) : man;
    const imgs = frames.map((f) => {
      const img = Z.el("img", "", box);
      img.src = `${ROOT}/${o.lang ?? lang}/seq/${name}/${f.f}`;
      img.style.cssText =
        "position:absolute;left:0;top:0;width:390px;height:794px;visibility:hidden";
      return img;
    });
    const weights = frames.map((f) => (o.even ? 1 : (f.hold ?? 1)));
    const total = weights.reduce((a, b) => a + b, 0);
    const starts = [];
    let acc = 0;
    weights.forEach((w) => {
      starts.push(t0 + ((t1 - t0) * acc) / total);
      acc += w;
    });
    let shown = -1;
    Z.dyn((t) => {
      let k = 0;
      while (k + 1 < starts.length && starts[k + 1] <= t) k++;
      if (k !== shown) {
        if (shown >= 0) imgs[shown].style.visibility = "hidden";
        imgs[k].style.visibility = "visible";
        shown = k;
      }
    });
    gsap.set(box, { autoAlpha: 0 });
    return box;
  };

  // Plays a list of screens in one phone: [{ at, el, trans }], each replacing the previous one.
  K.track = (items) => {
    items.forEach((it, i) => {
      const trans = it.trans ?? "fade";
      if (i === 0 || trans === "cut") tl.set(it.el, { autoAlpha: 1 }, it.at);
      else if (trans === "push") {
        tl.fromTo(
          it.el,
          { autoAlpha: 1, xPercent: 100 },
          { xPercent: 0, duration: 0.55, ease: "zo" },
          it.at,
        );
        Z.sfx("swipe", it.at);
      } else if (trans === "up") {
        tl.fromTo(
          it.el,
          { autoAlpha: 1, yPercent: 100 },
          { yPercent: 0, duration: 0.55, ease: "zo" },
          it.at,
        );
      } else
        tl.fromTo(
          it.el,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.3, ease: "power1.inOut" },
          it.at,
        );
      const prev = items[i - 1];
      if (prev)
        tl.set(
          prev.el,
          { autoAlpha: 0 },
          it.at + (trans === "cut" ? 0 : trans === "fade" ? 0.3 : 0.55),
        );
    });
  };

  // Tap feedback at screen coordinates (CSS px of the 390-wide screen, y measured from the app's top).
  K.tapAt = (screen, x, y, t, o = {}) => {
    const dot = div("tapdot", screen);
    dot.style.left = `${x}px`;
    dot.style.top = `${y + 50}px`;
    dot.style.zIndex = 40;
    gsap.set(dot, { autoAlpha: 0, scale: 0.6 });
    tl.to(dot, { autoAlpha: 1, scale: 1, duration: 0.16, ease: "power2.out" }, t - 0.16);
    tl.to(dot, { autoAlpha: 0, scale: 1.6, duration: 0.4, ease: "power2.out" }, t + 0.08);
    if (o.sound !== false) Z.sfx("tap", t);
  };

  // Marker on a region of a still (CSS px of the screen).
  K.ring = (screen, x, y, w, h, t, t1) => {
    const r = div("abs", screen);
    r.style.cssText = `left:${x}px;top:${y + 50}px;width:${w}px;height:${h}px;border-radius:14px;box-shadow:0 0 0 3px oklch(0.74 0.14 70 / 85%), 0 0 0 9px oklch(0.74 0.14 70 / 20%);z-index:35`;
    tl.fromTo(
      r,
      { autoAlpha: 0, scale: 1.04 },
      { autoAlpha: 1, scale: 1, duration: 0.45, ease: "zo" },
      t,
    );
    if (t1) tl.to(r, { autoAlpha: 0, duration: 0.3 }, t1);
    return r;
  };

  K.LOGO = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path class="lg-brain" fill="currentColor" d="M331.882 4.627C259.154 16.853 193.98 67.272 168.876 130.725c-6.31 15.95-12.526 40.912-14.05 56.416l-1.222 12.423-12.572 3.9C87.59 220.045 39.77 264.927 17.725 319.19 7.047 345.48 3.087 362.402 1.822 387.16c-1.96 38.368 6.185 76.855 21.97 103.796l6.75 11.526-6.704 11.475c-29.582 50.622-31.893 131.42-5.469 191.171 9.354 21.147 21.45 38.88 38.95 57.09 17.322 18.027 31.46 29.09 47.495 37.165 11.159 5.62 38.625 14.893 44.11 14.893 2.18 0 3.167 3.786 4.819 18.465 5.663 50.333 22.96 85.732 59.575 121.928 47.22 46.682 106.142 69.667 169.52 66.133 34.785-1.939 58.61-10.977 76.168-28.895 13.63-13.91 21.762-28.324 26.559-47.081 3.225-12.609 3.465-19.67 3.47-101.441l.004-87.889 21.164-23.248c11.64-12.788 21.777-23.249 22.524-23.249 1.839 0 3.669 77.886 3.674 156.318.004 71.69 1.064 80.29 12.553 101.845 7.129 13.374 25.608 30.674 40.705 38.107 34.564 17.016 92.624 18.884 136.192 4.386 77.556-25.808 139.29-102.032 143.489-177.165l.894-16.002 14.927-3.684c64.348-15.887 120.738-80.205 134.659-153.595 5.738-30.245 4.951-72.148-1.851-98.62-3.408-13.261-15.797-39.677-23.161-49.38l-5.692-7.5 6.245-8.18c23.57-30.877 33.948-82.3 25.998-128.809-13.223-77.353-65.6-139.298-137.726-162.885l-11.59-3.79-1.11-14.443c-5.72-74.425-63.763-142.956-145.448-171.729-28.076-9.889-45.9-12.53-77.663-11.501-42.6 1.377-67.79 10.056-87.621 30.181-13.556 13.756-21.407 29.065-23.872 46.541-1.145 8.13-1.717 46.58-1.498 100.58l.354 87.42-12.987 13.22c-13.71 13.951-28.892 26.88-31.571 26.88-.942 0-1.609-45.134-1.626-110.102-.034-120.395-.299-124.132-10.175-143.654-10.368-20.493-27.586-35.408-49.342-42.737-24.74-8.334-68.104-11.033-97.602-6.074"/><path class="lg-bolt" fill="var(--bolt, #fff)" d="M665.277 182.274C647.06 198.458 525.398 317.085 371.91 468.325c-62.032 61.124-89.914 89.74-89.897 92.261.068 9.163-1.31 8.99 63.517 8.043 97.479-1.42 101.737-1.333 107.175 2.234 3.532 2.316 4.742 4.557 4.742 8.773 0 3.362-8.627 25.617-21.24 54.791-87.36 202.056-91.184 211.43-86.271 211.43.7 0 22.243-20.725 47.874-46.058C511.507 687.426 617.164 584.106 648.7 554.462c43.961-41.326 83.96-81.339 90.934-90.966 4.625-6.383 5.17-8.145 3.506-11.309-1.085-2.061-2.841-4.328-3.903-5.037s-35.152-1.3-75.757-1.316l-73.825-.026-3.614-3.948c-7.127-7.787-6.743-9.616 10.664-50.744 9.122-21.55 21.412-51.276 27.31-66.06 5.9-14.785 18.107-44.394 27.127-65.799 35.37-83.923 36.684-87.397 34.029-90.051-2.081-2.081-4.996-.165-19.894 13.068"/></svg>`;

  // A scene is a full-frame layer that cross-fades in at t0 and out at t1.
  K.scene = (t0, t1, o = {}) => {
    const L = Z.layer(Z.stage, o.dark ? "dark" : "");
    if (o.bg) L.style.background = o.bg;
    gsap.set(L, { autoAlpha: 0 });
    const fin = o.fadeIn ?? 0.5;
    const fout = o.fadeOut ?? 0.45;
    if (fin === 0) {
      if (t0 <= 0) gsap.set(L, { autoAlpha: 1 });
      else tl.set(L, { autoAlpha: 1 }, t0);
    } else tl.to(L, { autoAlpha: 1, duration: fin, ease: "power1.inOut" }, t0 - fin * 0.5);
    if (t1 !== undefined) {
      if (fout === 0) tl.set(L, { autoAlpha: 0 }, t1);
      else tl.to(L, { autoAlpha: 0, duration: fout, ease: "power1.inOut" }, t1 - fout * 0.5);
    }
    if (o.drift)
      tl.fromTo(
        L,
        { scale: 1 },
        { scale: 1 + o.drift, duration: t1 - t0 + 0.6, ease: "none" },
        t0 - 0.3,
      );
    return L;
  };

  K.text = (L, o) => {
    const box = div("abs", L);
    const align = o.align ?? "left";
    box.style.cssText = `left:${o.x}px;top:${o.y}px;width:${o.w}px;text-align:${align};transform:translateY(${o.anchor === "top" ? 0 : -50}%)`;
    const h = div("hero", box, o.title);
    h.style.fontSize = `${o.size ?? 88}px`;
    h.style.textAlign = align;
    if (o.color) h.style.color = o.color;
    let s = null;
    if (o.sub) {
      s = div("sub", box, o.sub);
      s.style.fontSize = `${o.subSize ?? 38}px`;
      s.style.marginTop = `${o.gap ?? 26}px`;
      s.style.textAlign = align;
      if (o.subW) s.style.maxWidth = `${o.subW}px`;
      if (align === "center" && o.subW) s.style.margin = `${o.gap ?? 26}px auto 0`;
    }
    return { box, h, s };
  };

  // Reveal headline, then sub; exit both before tOut.
  K.say = (L, o, tIn, tOut) => {
    const r = K.text(L, o);
    gsap.set([r.h, r.s].filter(Boolean), { autoAlpha: 0 });
    const e = Z.reveal(r.h, tIn, { stagger: o.stagger ?? 0.07 });
    if (r.s)
      Z.reveal(r.s, o.subAt ?? Math.min(e - 0.3, tIn + 0.7), { stagger: 0.03, y: 0.3, blur: 6 });
    if (tOut !== undefined) {
      Z.unreveal(r.h, tOut - 0.55);
      if (r.s) Z.unreveal(r.s, tOut - 0.5);
    }
    return r;
  };

  K.phoneIn = (p, t, from = {}) => {
    tl.fromTo(
      p.phone,
      { y: from.y ?? 160, autoAlpha: 0, rotate: from.rotate ?? 0 },
      { y: 0, autoAlpha: 1, rotate: 0, duration: from.dur ?? 1.3, ease: "zo" },
      t,
    );
    Z.sfx("whoosh", t);
  };

  K.card = (L, o) => {
    const wrap = div("abs", L);
    wrap.style.left = `${o.x}px`;
    wrap.style.top = `${o.y}px`;
    const c = div("float", wrap, o.html ?? "");
    c.style.position = "relative";
    if (o.zoom) c.style.zoom = o.zoom;
    if (o.w) c.style.width = `${o.w}px`;
    if (o.pad !== undefined) c.style.padding = `${o.pad}px`;
    return c;
  };
  K.cardIn = (c, t, o = {}) => {
    tl.fromTo(
      c,
      { autoAlpha: 0, y: o.y ?? 40, scale: o.scale ?? 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: o.dur ?? 0.9, ease: "zo" },
      t,
    );
    if (o.sound !== false) Z.sfx("pop", t);
  };

  // Typing sounds come from the typing log; called once at the end of a build.
  K.typeSfx = () => (Z.typeTimes ?? []).forEach((t) => Z.sfx("key", t));

  // Device frame at 414x868 CSS px with a 390-wide screen; the app area starts 50px down.
  const SIGNAL = `<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#111"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#111"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#111"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#111"/></svg>`;
  const WIFI = `<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5l2.4-2.9a3.6 3.6 0 0 0-4.8 0z" fill="#111"/><path d="M3.7 6.9a6.3 6.3 0 0 1 8.6 0l1.3-1.6a8.4 8.4 0 0 0-11.2 0z" fill="#111"/><path d="M1.2 3.9a10 10 0 0 1 13.6 0L16 2.4a12 12 0 0 0-16 0z" fill="#111"/></svg>`;
  const BATT = `<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#111" opacity=".4"/><rect x="2" y="2" width="18" height="9" rx="2" fill="#111"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="#111" opacity=".45"/></svg>`;

  K.phone = (parent, o = {}) => {
    const phone = div("phone", parent);
    const screen = div("screen", phone);
    const sb = div(
      "statusbar",
      screen,
      `<span>9:41</span><span class="icons">${SIGNAL}${WIFI}${BATT}</span>`,
    );
    div("cam", screen).style.cssText =
      "position:absolute;top:16px;left:50%;width:13px;height:13px;margin-left:-6.5px;border-radius:50%;background:#0b0b0d;box-shadow:inset 0 0 0 2px #1b1b20;z-index:21";
    div("home-ind", screen);
    if (o.x !== undefined) phone.style.left = `${o.x - 207}px`;
    if (o.y !== undefined) phone.style.top = `${o.y - 434}px`;
    if (o.scale) gsap.set(phone, { scale: o.scale });
    return { phone, screen, statusbar: sb };
  };

  window.K = K;
})();
