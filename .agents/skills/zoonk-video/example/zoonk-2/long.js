// The Zoonk 2.0 YouTube film (16:9). Scene times sit on the bar grid (Z.BAR).
__build((Z) => {
  const { div, tl, icon } = Z;
  const C = Z.C;
  const B = Z.BAR;
  const TX = 150;
  const TW = 760;
  const PX = 1390;
  const PY = 545;
  const PS = 1.12;
  let cur = 0;
  const seg = (bars) => {
    const a = cur;
    cur += bars * B;
    return [a, cur];
  };
  const phoneAt = (L, o = {}) => {
    const p = K.phone(L, { x: o.x ?? PX, y: o.y ?? PY });
    gsap.set(p.phone, { scale: o.scale ?? PS });
    return p;
  };
  const left = (L, pair, tIn, tOut, o = {}) =>
    K.say2(
      L,
      {
        x: TX,
        y: o.y ?? 520,
        w: o.w ?? TW,
        title: pair[0],
        sub: pair[1],
        size: o.size ?? 88,
        subSize: 38,
      },
      tIn,
      tOut,
    );
  // Camera on the phone: zoom so screen point (sx, sy) sits at the phone's resting center.
  const focus = (p, t, scale, sy, dur = 1.0) =>
    tl.to(
      p.phone,
      { scale, y: (434 - (sy + 62)) * scale - (434 - 434), duration: dur, ease: "swing" },
      t,
    );
  // Phone translate that centers screen point sy (CSS px from the app's top) at a given zoom.
  const fy = (sy, sc) => -(62 + sy - 434) * sc;
  const T = {
    en: {
      build: [293, 323],
      dontKnow: [96, 680],
      mean: [129, 202],
      check: [195, 756],
      apply: [110, 584],
      speaker: [168, 93],
      chip: [120, 508],
    },
    pt: {
      build: [286, 347],
      dontKnow: [88, 680],
      mean: [90, 202],
      check: [195, 756],
      apply: [110, 584],
      speaker: [100, 93],
      chip: [150, 508],
    },
  }[Z.lang];
  const unfocus = (p, t, dur = 0.9) =>
    tl.to(p.phone, { scale: PS, y: 0, duration: dur, ease: "swing" }, t);

  // 1. Cold open + the gap
  {
    const [, t1] = seg(4);
    const L = K.scene(0, t1, { fadeIn: 0, fadeOut: 0 });
    const box = div("abs", L);
    box.style.cssText =
      "left:240px;width:1440px;top:385px;min-height:240px;border:3px solid var(--ink);box-shadow:0 0 0 7px oklch(0 0 0 / 8%), 0 40px 80px -30px rgb(0 0 0/18%);border-radius:40px;padding:38px 46px;background:#fff";
    box.innerHTML = `<div style="display:flex;gap:22px;font-size:66px;letter-spacing:-0.03em;line-height:1.2"><b style="font-weight:560;white-space:nowrap">${C.iWantTo}</b><span class="gt" style="font-weight:420"></span></div>
      <div class="row" style="justify-content:space-between;margin-top:26px"><span style="color:var(--muted-fg)">${icon("paperclip", 36, 1.8)}</span><div class="btn" style="height:72px;padding:0 34px;font-size:28px;border-radius:20px">${C.build}</div></div>`;
    const el = box.querySelector(".gt");
    const r = Z.rand(11);
    const plan = [
      { text: C.goals[0], at: 0.25, eraseAt: 1.75 },
      { text: C.goals[1], at: 2.0, eraseAt: 3.85 },
      { text: C.goals[2], at: 4.1 },
    ].map((it) => {
      const times = [];
      let t = it.at;
      for (let i = 0; i < it.text.length; i++) {
        t += (1 / 24) * (0.6 + r() * 0.8);
        times.push(t);
      }
      times.forEach((x) => Z.sfx("key", x));
      if (it.eraseAt) Z.sfx("erase", it.eraseAt);
      return { ...it, times, end: t };
    });
    const span = Z.el("span", "", el);
    const car = Z.el("span", "caret", el);
    Z.dyn((tt) => {
      let txt = "";
      for (const p of plan) {
        if (tt < p.at) break;
        let n = 0;
        while (n < p.times.length && p.times[n] <= tt) n++;
        txt = p.text.slice(0, n);
        if (p.eraseAt && tt >= p.eraseAt)
          txt = txt.slice(0, Math.max(0, Math.round(txt.length * (1 - (tt - p.eraseAt) / 0.22))));
      }
      span.textContent = txt;
      const typing = plan.some((p) => tt >= p.at && tt <= p.end + 0.08);
      car.style.opacity = typing || Math.floor(tt * 1.9) % 2 === 0 ? 1 : 0;
    });
    tl.fromTo(box, { y: 0 }, { y: -8, duration: 6, ease: "none" }, 0);
    const g0 = 2.5 * B;
    tl.to(
      box,
      {
        y: -280,
        scale: 0.62,
        opacity: 0,
        filter: "blur(6px)",
        duration: 0.8,
        ease: "power2.inOut",
      },
      g0 - 0.2,
    );
    C.questions.forEach((q, i) => {
      const e = div("hero abs", L, q);
      e.style.cssText += `;left:0;right:0;top:${310 + i * 150}px;font-size:96px`;
      gsap.set(e, { autoAlpha: 0 });
      Z.reveal(e, g0 + 0.25 + i * 0.85, { stagger: 0.05, dur: 0.6 });
      if (i < 2)
        tl.to(e, { color: "oklch(0.75 0.01 286)", duration: 0.5 }, g0 + 0.25 + (i + 1) * 0.85);
    });
  }

  // 2. Reveal
  {
    const [t0, t1] = seg(2);
    const L = K.scene(t0, t1, { dark: true, fadeIn: 0, fadeOut: 0 });
    const glow = div("abs", L);
    glow.style.cssText =
      "left:960px;top:420px;width:900px;height:900px;margin:-450px 0 0 -450px;border-radius:50%;background:radial-gradient(closest-side, oklch(0.5 0.12 260 / 35%), transparent 70%)";
    const logo = div("abs", L, K.LOGO);
    logo.style.cssText =
      "left:860px;top:300px;width:200px;height:200px;color:#fff;--bolt:var(--ink)";
    const wm = div(
      "abs hero",
      L,
      `Zoonk <span style="color:var(--on-ink-muted);font-weight:500">2.0</span>`,
    );
    wm.style.cssText += ";left:0;right:0;top:560px;font-size:128px;color:#fff";
    const tag = div("abs sub", L, C.tagline);
    tag.style.cssText += ";left:0;right:0;top:730px;font-size:46px;color:var(--on-ink-muted)";
    gsap.set([wm, tag], { autoAlpha: 0 });
    tl.fromTo(
      logo,
      { scale: 0.5, autoAlpha: 0, filter: "blur(20px)" },
      { scale: 1, autoAlpha: 1, filter: "blur(0px)", duration: 1.1, ease: "zo" },
      t0 + 0.05,
    );
    tl.fromTo(
      glow,
      { scale: 0.4, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 1.8, ease: "zo" },
      t0,
    );
    tl.fromTo(
      wm,
      { autoAlpha: 0, y: 30, filter: "blur(12px)" },
      { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "zo" },
      t0 + 0.5,
    );
    Z.reveal(tag, t0 + 1.1, { stagger: 0.05, dur: 0.6 });
    tl.to([logo, wm, tag], { scale: 1.03, duration: 4.5, ease: "none" }, t0 + 0.6);
    Z.sfx("hit", t0);
  }

  // 3. How it works: one phone
  {
    const [t0] = seg(0);
    const [a0, a1] = seg(2);
    const [b0, b1] = seg(2);
    const [c0, c1] = seg(2.5);
    const [d0, d1] = seg(2);
    const [e0, e1] = seg(2.5);
    const L = K.scene(t0, e1, { fadeIn: 0 });
    const p = phoneAt(L);
    K.phoneIn(p, t0 - 0.05, { y: 120, dur: 0.8 });
    const s = p.screen;
    left(L, C.tellGoal, a0 + 0.15, a1);
    left(L, C.checks, b0 + 0.1, b1);
    left(L, C.time, c0 + 0.1, c1);
    left(L, C.follow, d0 + 0.1, d1);
    left(L, C.missed, e0 + 0.1);
    const typing = K.seq(s, "typing", a0 + 0.5, a0 + 3.6);
    const understood = K.still(s, "understood");
    const diag = K.still(s, "diagnostic");
    const diagPicked = K.still(s, "diagnostic-picked");
    const sched = K.still(s, "schedule");
    const t0d = K.still(s, "today");
    const t1d = K.still(s, "today-done1");
    const t2d = K.still(s, "today-done2");
    const t3d = K.still(s, "today-done3");
    const changed = K.still(s, "today-changed");
    K.tapAt(s, T.build[0], T.build[1], a0 + 3.95);
    K.track([
      { at: a0, el: typing },
      { at: b0, el: understood, trans: "push" },
      { at: b0 + 1.5, el: diag, trans: "push" },
      { at: b0 + 3.2, el: diagPicked, trans: "fade" },
      { at: c0, el: sched, trans: "push" },
      { at: d0, el: t0d, trans: "push" },
      { at: d0 + 1.3, el: t1d, trans: "fade" },
      { at: d0 + 2.3, el: t2d, trans: "fade" },
      { at: d0 + 3.3, el: t3d, trans: "fade" },
      { at: e0, el: changed, trans: "push" },
    ]);
    [d0 + 1.3, d0 + 2.3, d0 + 3.3].forEach((x) => Z.sfx("check", x));
    K.tapAt(s, T.dontKnow[0], T.dontKnow[1], b0 + 3.15);
    K.ring(s, 10, 413, 370, 88, c0 + 1.5);
    Z.sfx("tick", c0 + 1.5);
    // camera
    tl.to(p.phone, { scale: 1.3, y: fy(300, 1.3), duration: 2.6, ease: "swing" }, a0 + 0.6);
    unfocus(p, a0 + 3.8, 0.8);
    tl.to(p.phone, { scale: 1.55, y: fy(440, 1.55), duration: 1.0, ease: "swing" }, c0 + 0.6);
    unfocus(p, c1 - 0.6, 0.8);
    tl.to(p.phone, { scale: 1.3, y: fy(470, 1.3), duration: 1.0, ease: "swing" }, e0 + 0.6);
  }

  // 4. Whatever you're working toward
  {
    const [t0, t1] = seg(1);
    const L = K.scene(t0, t1);
    K.say2(L, { x: 0, y: 330, w: 1920, align: "center", title: C.whatever, size: 88 }, t0 + 0.1);
    const ics = [
      ["graduation-cap", "var(--mock)"],
      ["languages", "var(--conv)"],
      ["briefcase-business", "var(--success)"],
      ["lightbulb", "var(--brain)"],
    ];
    ics.forEach(([ic, c], i) => {
      const card = K.card(L, { x: 99 + i * 438, y: 500, w: 340, pad: 30, zoom: 1.2 });
      card.style.cssText += ";height:250px;display:flex;flex-direction:column";
      card.innerHTML = `<div style="color:${c}">${icon(ic, 54, 1.6)}</div><div style="font-weight:600;font-size:32px;letter-spacing:-0.03em;line-height:1.15;margin-top:auto">${C.areas[i]}</div>`;
      K.cardIn(card, t0 + 0.4 + i * 0.12, { y: 50, sound: i === 0, dur: 0.7 });
    });
  }

  // 5. Exams
  {
    const [a0, a1] = seg(2);
    const [b0, b1] = seg(2);
    const [c0, c1] = seg(1.25);
    const [d0, d1] = seg(1.25);
    const L = K.scene(a0, d1);
    const p = phoneAt(L);
    K.phoneIn(p, a0 - 0.05, { y: 120, dur: 0.8 });
    const s = p.screen;
    left(L, C.exam, a0 + 0.15, a1);
    left(L, C.mock, b0 + 0.1, b1);
    left(L, C.examExtra, c0 + 0.1, c1);
    left(L, C.mistakes, d0 + 0.1);
    const plan = K.still(s, "exam-plan");
    const subj = K.still(s, "exam-subject");
    const run = K.still(s, "mock-run");
    const res = K.still(s, "mock-result");
    const extra = K.still(s, Z.lang === "pt" ? "essay" : "speaking-band");
    const mist = K.still(s, Z.lang === "pt" ? "mistakes" : "mistakes-open2");
    K.track([
      { at: a0, el: plan },
      { at: a0 + 2.4, el: subj, trans: "push" },
      { at: b0, el: run, trans: "push" },
      { at: b0 + 2.2, el: res, trans: "push" },
      { at: c0, el: extra, trans: "push" },
      { at: d0, el: mist, trans: "push" },
    ]);
    Z.sfx("chime", b0 + 2.5);
    tl.to(p.phone, { scale: 1.22, y: 20, duration: 4.8, ease: "none" }, a0 + 0.4);
    unfocus(p, b0, 0.6);
  }

  // 6. Languages
  {
    const [a0, a1] = seg(1.5);
    const [b0, b1] = seg(1.5);
    const [c0, c1] = seg(2);
    const [d0, d1] = seg(1.5);
    const L = K.scene(a0, d1);
    const p = phoneAt(L);
    K.phoneIn(p, a0 - 0.05, { y: 120, dur: 0.8 });
    const s = p.screen;
    left(L, C.language, a0 + 0.15, a1);
    left(L, C.word, b0 + 0.1, b1);
    left(L, C.call, c0 + 0.1, c1);
    left(L, C.pattern, d0 + 0.1);
    const unit = K.still(s, "language-unit");
    const word = K.seq(s, "word", b0, b1);
    const call = K.still(s, "call");
    const fb = K.still(s, "call-feedback-improve");
    const pat = K.still(s, "pattern");
    K.track([
      { at: a0, el: unit },
      { at: b0, el: word, trans: "push" },
      { at: c0, el: call, trans: "push" },
      { at: c0 + 2.6, el: fb, trans: "up" },
      { at: d0, el: pat, trans: "push" },
    ]);
    K.tapAt(s, T.speaker[0], T.speaker[1], b0 + 2.75, { sound: false });
    Z.sfx(Z.lang === "pt" ? "word-stay" : "word-quedarse", b0 + 2.85);
    tl.to(p.phone, { scale: 1.6, y: fy(180, 1.6), duration: 0.9, ease: "swing" }, b0 + 0.4);
    unfocus(p, c0, 0.6);
    [c0 + 0.6, c0 + 1.4].forEach((x) => Z.sfx("bubble", x));
  }

  // 7. Career
  {
    const [t0, t1] = seg(2);
    const L = K.scene(t0, t1);
    const p = phoneAt(L);
    K.phoneIn(p, t0 - 0.05, { y: 120, dur: 0.8 });
    left(L, C.career, t0 + 0.15);
    const mods = K.still(p.screen, "plan-career-modules");
    const tools = K.still(p.screen, "tools-setup");
    K.track([
      { at: t0, el: mods },
      { at: t0 + 2.6, el: tools, trans: "up" },
    ]);
  }

  // 8. Learn anything
  {
    const [t0, t1] = seg(2);
    const L = K.scene(t0, t1);
    const p = phoneAt(L);
    K.phoneIn(p, t0 - 0.05, { y: 120, dur: 0.8 });
    left(L, C.learn, t0 + 0.15);
    const plan = K.still(p.screen, "plan-learn");
    const adj = K.still(p.screen, "plan-learn-adjust");
    K.track([
      { at: t0, el: plan },
      { at: t0 + 2.2, el: adj, trans: "up" },
    ]);
  }

  // 9. Lessons
  {
    let [t0, t1] = seg(1);
    let L = K.scene(t0, t1);
    K.say2(
      L,
      {
        x: 0,
        y: 470,
        w: 1920,
        align: "center",
        title: C.bus[0],
        size: 110,
        sub: C.bus[1],
        subW: 900,
      },
      t0 + 0.1,
    );

    // Activity carousel
    [t0, t1] = seg(4);
    L = K.scene(t0, t1);
    K.say2(
      L,
      {
        x: 0,
        y: 150,
        w: 1920,
        align: "center",
        title: C.doing[0],
        size: 80,
        sub: C.doing[1],
        subSize: 36,
        subW: 1000,
        anchor: "top",
        gap: 14,
      },
      t0 + 0.1,
    );
    const acts = ["timeline", "map", "projectile", "polls", "code", "piano"];
    const gap = 520;
    const row = div("abs", L);
    row.style.cssText = "left:0;top:0;width:100%;height:100%";
    const slot = (t1 - t0 - 0.6) / acts.length;
    acts.forEach((a, i) => {
      const ph = K.phone(row, { x: 960 + i * gap, y: 690 });
      gsap.set(ph.phone, { scale: 0.86 });
      const from = t0 + 0.3 + i * slot;
      const sq = K.seq(ph.screen, a, from + 0.15, from + slot - 0.1);
      gsap.set(sq, { autoAlpha: 1 });
    });
    tl.fromTo(
      row,
      { x: 0 },
      { x: -gap * (acts.length - 1), duration: t1 - t0 - 1.0, ease: "power1.inOut" },
      t0 + 0.5,
    );
    for (let i = 0; i < acts.length; i++) Z.sfx("swipe", t0 + 0.3 + i * slot);

    // Wrong answer explained
    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    const p = phoneAt(L);
    K.phoneIn(p, t0 - 0.05, { y: 120, dur: 0.8 });
    left(L, C.wrong, t0 + 0.15);
    const avg = K.seq(p.screen, "averages", t0 + 0.4, t0 + 3.4);
    K.track([{ at: t0, el: avg }]);
    K.tapAt(p.screen, T.mean[0], T.mean[1], t0 + 1.3);
    K.tapAt(p.screen, T.check[0], T.check[1], t0 + 2.2);
    Z.sfx("wrong", t0 + 2.5);
    tl.to(p.phone, { scale: 1.35, y: fy(330, 1.35), duration: 1.0, ease: "swing" }, t0 + 2.8);
  }

  // 10. Zu
  {
    let [t0, t1] = seg(1);
    let L = K.scene(t0, t1);
    const zu = div("abs", L, K.zu("zu-baby-cheer", 330));
    zu.style.cssText = "left:795px;top:170px";
    tl.fromTo(
      zu,
      { scale: 0.4, autoAlpha: 0, y: 80 },
      { scale: 1, autoAlpha: 1, y: 0, duration: 0.9, ease: "spring" },
      t0 + 0.05,
    );
    Z.sfx("pop", t0 + 0.1);
    K.say2(
      L,
      {
        x: 0,
        y: 640,
        w: 1920,
        align: "center",
        title: C.zu[0].replace("<br>", " "),
        size: 100,
        sub: C.zu[1],
        subW: 900,
        anchor: "top",
      },
      t0 + 0.3,
    );

    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    let p = phoneAt(L);
    K.phoneIn(p, t0 - 0.05, { y: 120, dur: 0.8 });
    left(L, C.help, t0 + 0.15);
    const tut = K.seq(p.screen, "tutor", t0 + 0.2, t1 - 0.3, { from: 1 });
    K.track([{ at: t0, el: tut }]);
    K.tapAt(p.screen, T.chip[0], T.chip[1], t0 + 1.25);
    tl.to(p.phone, { scale: 1.3, y: fy(520, 1.3), duration: 1.0, ease: "swing" }, t0 + 1.6);

    [t0, t1] = seg(1);
    L = K.scene(t0, t1);
    p = phoneAt(L);
    gsap.set(p.phone, { autoAlpha: 1 });
    left(L, C.reviews, t0 + 0.1, undefined, { size: 76 });
    const done = K.seq(p.screen, "complete", t0, t0 + 1.6, { from: 1 });
    K.track([{ at: t0, el: done }]);

    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    p = phoneAt(L);
    K.phoneIn(p, t0 - 0.05, { y: 120, dur: 0.8 });
    left(L, C.change, t0 + 0.15);
    const zt = K.still(p.screen, "zu-tab");
    const za = K.still(p.screen, "zu-tab-applied");
    K.track([
      { at: t0, el: zt },
      { at: t0 + 3.0, el: za, trans: "fade" },
    ]);
    K.tapAt(p.screen, T.apply[0], T.apply[1], t0 + 2.9);
    Z.sfx("chime", t0 + 3.1);
    tl.to(p.phone, { scale: 1.35, y: fy(470, 1.35), duration: 1.2, ease: "swing" }, t0 + 1.2);
  }

  // 11. Progress
  {
    let [t0, t1] = seg(2);
    let L = K.scene(t0, t1);
    let p = phoneAt(L);
    K.phoneIn(p, t0 - 0.05, { y: 120, dur: 0.8 });
    left(L, C.energy, t0 + 0.15, undefined, { size: 84 });
    const nap = K.still(p.screen, "energy-napping-sheet");
    const glow = K.still(p.screen, "energy-glowing-sheet");
    K.track([
      { at: t0, el: nap },
      { at: t0 + 2.6, el: glow, trans: "fade" },
    ]);

    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    p = phoneAt(L);
    K.phoneIn(p, t0 - 0.05, { y: 120, dur: 0.8 });
    left(L, C.brain, t0 + 0.15, undefined, { y: 380, size: 84 });
    const lv = K.still(p.screen, "level");
    K.track([{ at: t0, el: lv }]);
    const grow = div("abs row", L);
    grow.style.cssText = `left:${TX}px;top:640px;gap:30px;align-items:flex-end`;
    grow.innerHTML = [
      ["zu-baby-happy", 140],
      ["zu-young-happy", 180],
      ["zu-adult-proud", 220],
    ]
      .map(([n, sz]) => `<div>${K.zu(n, sz)}</div>`)
      .join("");
    [...grow.children].forEach((g, i) => {
      tl.fromTo(
        g,
        { autoAlpha: 0, scale: 0.6, y: 30 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.7, ease: "spring" },
        t0 + 1.4 + i * 0.45,
      );
      Z.sfx("pop", t0 + 1.4 + i * 0.45);
    });

    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    p = phoneAt(L);
    K.phoneIn(p, t0 - 0.05, { y: 120, dur: 0.8 });
    left(L, C.trickster, t0 + 0.15);
    const ci = K.still(p.screen, "checkpoint-intro");
    const cw = K.still(p.screen, "checkpoint-won");
    K.track([
      { at: t0, el: ci },
      { at: t0 + 2.6, el: cw, trans: "push" },
    ]);
    Z.sfx("chime", t0 + 2.8);
  }

  // 12. Payoff
  {
    let [t0, t1] = seg(2);
    let L = K.scene(t0, t1, { fadeOut: 0.3 });
    C.goalsDone.forEach((g, i) => {
      const row = div(
        "abs row",
        L,
        `<span class="gck" style="width:64px;height:64px;border-radius:50%;border:3px solid oklch(0.85 0 0);display:grid;place-items:center;color:#fff;flex:none"><span class="gcki" style="opacity:0">${icon("check", 36, 3)}</span></span><span style="font-weight:600;font-size:58px;letter-spacing:-0.035em">${g}</span>`,
      );
      row.style.cssText += `;left:330px;top:${240 + i * 125}px;gap:32px`;
      tl.fromTo(
        row,
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "zo" },
        t0 + 0.15 + i * 0.25,
      );
      const at = t0 + 1.0 + i * 0.45;
      tl.to(
        row.querySelector(".gck"),
        {
          backgroundColor: "oklch(0.66 0.14 252)",
          borderColor: "oklch(0.66 0.14 252)",
          duration: 0.25,
        },
        at,
      );
      tl.fromTo(
        row.querySelector(".gcki"),
        { opacity: 0, scale: 0.4 },
        { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2.4)" },
        at,
      );
      Z.sfx("check", at);
    });
    const one = div("abs hero", L, C.oneDay);
    one.style.cssText += ";left:0;right:0;top:700px;font-size:92px";
    gsap.set(one, { autoAlpha: 0 });
    Z.reveal(one, t0 + 2.6, { stagger: 0.05, dur: 0.6 });

    [t0, t1] = seg(1.5);
    L = K.scene(t0, t1, { fadeIn: 0.3 });
    const big = div("abs hero", L);
    big.style.cssText += ";left:0;right:0;top:400px;font-size:100px";
    const tr = [
      "What do you want to achieve?",
      "O que você quer alcançar?",
      "¿Qué quieres lograr?",
      "何を達成したいですか？",
      "Was möchtest du erreichen?",
      "Que veux-tu accomplir ?",
      "무엇을 이루고 싶으세요?",
      "Cosa vuoi ottenere?",
      "Co chcesz osiągnąć?",
      "Ne başarmak istiyorsun?",
    ];
    const order = Z.lang === "pt" ? [1, 0, 2, 3, 4, 5, 6, 7, 8, 9] : tr.map((_, i) => i);
    const step = 0.27;
    Z.dyn((t) => {
      const k = Math.floor((t - t0 - 0.1) / step);
      big.textContent = tr[order[k >= 0 && k < order.length ? k : 0]];
    });
    for (let i = 0; i < tr.length; i++) Z.sfx("tick", t0 + 0.1 + i * step);
    const kick = div("abs sub", L, C.browser);
    kick.style.cssText += ";left:0;right:0;top:700px;font-size:40px";
    gsap.set(kick, { autoAlpha: 0 });
    Z.reveal(kick, t0 + 0.3, { stagger: 0.04, dur: 0.6 });
  }

  // 13. CTA
  {
    const [t0, t1] = seg(5);
    const L = K.scene(t0, undefined, { dark: true, fadeIn: 0 });
    const glow = div("abs", L);
    glow.style.cssText =
      "left:1300px;top:540px;width:1400px;height:1400px;margin:-700px 0 0 -700px;border-radius:50%;background:radial-gradient(closest-side, oklch(0.5 0.12 260 / 22%), transparent 70%)";
    tl.fromTo(
      glow,
      { autoAlpha: 0, x: 120, y: 60, scale: 0.9 },
      { autoAlpha: 1, x: -80, y: -40, scale: 1.08, duration: t1 - t0, ease: "sine.inOut" },
      t0,
    );
    const logo = div("abs", L, K.LOGO);
    logo.style.cssText =
      "left:160px;top:250px;width:120px;height:120px;color:#fff;--bolt:var(--ink)";
    tl.fromTo(
      logo,
      { autoAlpha: 0, scale: 0.7 },
      { autoAlpha: 1, scale: 1, duration: 0.8, ease: "zo" },
      t0 + 0.1,
    );
    const h = div("abs hero", L, C.ctaTitle);
    h.style.cssText += ";left:160px;top:420px;font-size:116px;text-align:left;color:#fff";
    gsap.set(h, { autoAlpha: 0 });
    Z.reveal(h, t0 + 0.4, { stagger: 0.06, dur: 0.7 });
    const url = div("abs", L, `<b style="font-weight:640;color:#fff">${C.ctaUrl}</b>`);
    url.style.cssText = "left:160px;top:585px;font-size:72px;letter-spacing:-0.035em";
    gsap.set(url, { autoAlpha: 0 });
    Z.reveal(url, t0 + 1.0, { stagger: 0.06, dur: 0.7 });
    const note = div("abs", L, C.ctaNote);
    note.style.cssText = "left:160px;top:700px;font-size:34px;color:var(--on-ink-muted)";
    gsap.set(note, { autoAlpha: 0 });
    Z.reveal(note, t0 + 1.6, { stagger: 0.04, dur: 0.6 });
    Z.sfx("hit", t0);
    Z.end(t1);
  }

  K.typeSfx();
});
