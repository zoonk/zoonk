// The Zoonk 2.0 YouTube film (16:9). Scene times sit on the bar grid (Z.BAR).
__build((Z) => {
  const { div, tl, icon } = Z;
  const C = Z.C;
  const B = Z.BAR;
  const PX = 960;
  const PY = 540;
  const PS = 1.12;
  let cur = 0;
  const seg = (bars) => {
    const a = cur;
    cur += bars * B;
    return [a, cur];
  };
  // Screen point sy (CSS px from the app's top) to the phone translate that centers it at zoom z.
  const fy = (sy, z) => -(62 + sy - 434) * z;
  // The phone sits in a full-frame rig, so focus (blur, fade) and camera (scale, y) animate separately.
  const rigAt = (L) => {
    const rig = div("abs", L);
    rig.style.cssText = "left:0;top:0;width:1920px;height:1080px";
    const p = K.phone(rig, { x: PX, y: PY });
    gsap.set(p.phone, { scale: PS });
    gsap.set(rig, { autoAlpha: 0 });
    return { ...p, rig };
  };
  const cam = (p, t, sy, z, dur = 0.9) =>
    dur === 0
      ? tl.set(p.phone, { scale: z, y: fy(sy, z) }, t)
      : tl.to(p.phone, { scale: z, y: fy(sy, z), duration: dur, ease: "swing" }, t);
  // One focal point at a time: the headline alone in the middle, then the phone alone, framed on `at`.
  // A scene's first beat waits out the previous scene's fade (`lead` 0 after a hard cut). Returns when the phone is back.
  const beat = (L, p, title, t0, o = {}) => {
    const words = `${title} ${o.sub ?? ""}`.replace(/<br>/g, " ").trim().split(/\s+/).length;
    const hold = Math.min(2.0, Math.max(1.5, 1.1 + 0.12 * words));
    const start = t0 + (o.lead ?? (o.first ? 0.25 : 0.05));
    const back = start + hold;
    if (!o.first)
      tl.to(
        p.rig,
        { autoAlpha: 0, scale: 0.96, filter: "blur(14px)", duration: 0.4, ease: "power2.in" },
        t0 - 0.35,
      );
    const r = K.say(
      L,
      {
        x: 160,
        y: 540,
        w: 1600,
        align: "center",
        title,
        size: 104,
        stagger: 0.045,
        sub: o.sub,
        subSize: 40,
        subW: 1000,
      },
      start,
      back,
    );
    K.fit(r.h, 1600);
    if (o.at) cam(p, back - 0.05, o.at[0], o.at[1], 0);
    tl.fromTo(
      p.rig,
      { autoAlpha: 0, scale: 0.94, filter: "blur(14px)" },
      {
        autoAlpha: 1,
        scale: 1,
        filter: "blur(0px)",
        duration: 0.75,
        ease: "zo",
        immediateRender: false,
      },
      back,
    );
    if (o.first) Z.sfx("whoosh", back);
    return back;
  };
  const T = {
    en: {
      build: [293, 323],
      dontKnow: [96, 680],
      mean: [129, 202],
      check: [195, 756],
      apply: [110, 607],
      speaker: [168, 93],
      chip: [120, 600],
    },
    pt: {
      build: [286, 347],
      dontKnow: [88, 680],
      mean: [90, 202],
      check: [195, 756],
      apply: [110, 607],
      speaker: [100, 93],
      chip: [150, 618],
    },
  }[Z.lang];

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
    const [a0] = seg(2);
    const [b0] = seg(2);
    const [c0] = seg(2.5);
    const [d0] = seg(2);
    const [e0, e1] = seg(2.5);
    const L = K.scene(t0, e1, { fadeIn: 0 });
    const p = rigAt(L);
    const s = p.screen;
    const typing = K.seq(s, "typing", a0 + 1.7, a0 + 4.0);
    const diag = K.still(s, "diagnostic");
    const diagPicked = K.still(s, "diagnostic-picked");
    const sched = K.still(s, "schedule");
    const t0d = K.still(s, "today");
    const t1d = K.still(s, "today-done1");
    const t2d = K.still(s, "today-done2");
    const t3d = K.still(s, "today-done3");
    const changed = K.still(s, "today-changed");
    K.track([
      { at: a0, el: typing },
      { at: b0 + 0.2, el: diag, trans: "cut" },
      { at: b0 + 3.75, el: diagPicked, trans: "fade" },
      { at: c0 + 0.2, el: sched, trans: "cut" },
      { at: d0 + 0.2, el: t0d, trans: "cut" },
      { at: d0 + 2.2, el: t1d, trans: "fade" },
      { at: d0 + 2.9, el: t2d, trans: "fade" },
      { at: d0 + 3.6, el: t3d, trans: "fade" },
      { at: e0 + 0.2, el: changed, trans: "cut" },
    ]);

    beat(L, p, C.tellGoal, a0, { first: true, lead: 0.05, at: [280, 1.9] });
    K.tapAt(s, T.build[0], T.build[1], a0 + 4.3);

    beat(L, p, C.checks, b0, { at: [270, 1.9] });
    cam(p, b0 + 2.85, 520, 1.9, 0.7);
    K.tapAt(s, T.dontKnow[0], T.dontKnow[1], b0 + 3.7);

    const cIn = beat(L, p, C.time, c0, { at: [330, 1.9] });
    cam(p, cIn + 1.0, 450, 2.4, 1.2);
    K.ring(s, 10, 413, 370, 88, cIn + 1.7, d0 - 0.3);
    Z.sfx("tick", cIn + 1.7);

    beat(L, p, C.follow, d0, { at: [300, 1.8] });
    [d0 + 2.2, d0 + 2.9, d0 + 3.6].forEach((x) => Z.sfx("check", x));

    const eIn = beat(L, p, C.missed, e0, { at: [250, 1.9] });
    cam(p, eIn + 1.7, 560, 1.9, 1.0);
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
    const [a0] = seg(2);
    const [b0] = seg(2);
    const [c0] = seg(1.25);
    const [d0, d1] = seg(1.25);
    const L = K.scene(a0, d1);
    const p = rigAt(L);
    const s = p.screen;
    const pt = Z.lang === "pt";
    const subj = K.still(s, "exam-subject");
    const run = K.still(s, "mock-run");
    const res = K.still(s, "mock-result");
    const extra = K.still(s, pt ? "essay" : "speaking-band");
    const mist = K.still(s, pt ? "mistakes" : "mistakes-open2");
    K.track([
      { at: a0, el: subj },
      { at: b0 + 0.2, el: run, trans: "cut" },
      { at: b0 + 3.5, el: res, trans: "push" },
      { at: c0, el: extra, trans: "push" },
      { at: d0, el: mist, trans: "push" },
    ]);
    const aIn = beat(L, p, C.exam, a0, { first: true, at: [260, 1.8] });
    cam(p, aIn + 0.9, 500, 1.8, 1.6);
    beat(L, p, C.mock, b0, { at: [230, 1.85] });
    Z.sfx("chime", b0 + 3.8);
    cam(p, c0, pt ? 250 : 230, 1.85, 0.6);
    cam(p, d0, pt ? 480 : 540, 1.85, 0.7);
  }

  // 6. Languages
  {
    const [a0] = seg(1.5);
    const [b0, b1] = seg(1.5);
    const [c0] = seg(2);
    const [d0, d1] = seg(1.5);
    const L = K.scene(a0, d1);
    const p = rigAt(L);
    const s = p.screen;
    const unit = K.still(s, "language-unit");
    const word = K.seq(s, "word", b0, b1);
    const call = K.still(s, "call");
    const fb = K.still(s, "call-feedback-improve");
    const pat = K.still(s, "pattern");
    K.track([
      { at: a0, el: unit },
      { at: b0, el: word, trans: "push" },
      { at: c0 + 0.2, el: call, trans: "cut" },
      { at: c0 + 3.5, el: fb, trans: "up" },
      { at: d0, el: pat, trans: "push" },
    ]);
    beat(L, p, C.language, a0, { first: true, at: [300, 1.8] });
    cam(p, b0 + 0.1, 180, 2.2, 0.8);
    K.tapAt(s, T.speaker[0], T.speaker[1], b0 + 2.35, { sound: false });
    Z.sfx(Z.lang === "pt" ? "word-stay" : "word-quedarse", b0 + 2.45);
    const cIn = beat(L, p, C.call, c0, { at: [380, 1.6] });
    [cIn + 0.3, cIn + 0.9].forEach((x) => Z.sfx("bubble", x));
    cam(p, c0 + 3.5, 250, 1.8, 0.6);
    cam(p, d0 + 0.1, 200, 2.0, 0.7);
  }

  // 7. Career
  {
    const [t0, t1] = seg(2);
    const L = K.scene(t0, t1);
    const p = rigAt(L);
    const mods = K.still(p.screen, "plan-career-modules");
    const tools = K.still(p.screen, "tools-setup");
    K.track([
      { at: t0, el: mods },
      { at: t0 + 3.2, el: tools, trans: "up" },
    ]);
    const tIn = beat(L, p, C.career, t0, { first: true, at: [380, 1.7] });
    cam(p, tIn + 0.6, 450, 2.2, 1.0);
    cam(p, t0 + 3.2, 420, 1.9, 0.6);
  }

  // 8. Learn anything
  {
    const [t0, t1] = seg(2);
    const L = K.scene(t0, t1);
    const p = rigAt(L);
    const plan = K.still(p.screen, "plan-learn");
    const adj = K.still(p.screen, "plan-learn-adjust");
    K.track([
      { at: t0, el: plan },
      { at: t0 + 3.1, el: adj, trans: "up" },
    ]);
    beat(L, p, C.learn, t0, { first: true, at: [330, 1.8] });
    cam(p, t0 + 3.1, 400, 1.9, 0.6);
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

    // Learn by doing: the activities play in one phone, each pushed in as the voice names it.
    [t0, t1] = seg(4);
    L = K.scene(t0, t1);
    let p = rigAt(L);
    const acts = ["map", "projectile", "code", "piano", "timeline"];
    const starts = [2.25, 3.55, 4.85, 6.35, 7.75].map((x) => t0 + x);
    const plays = acts.map((a, i) =>
      K.seq(p.screen, a, starts[i] + 0.05, i + 1 < acts.length ? starts[i + 1] : t1 - 0.2),
    );
    K.track(plays.map((el, i) => ({ at: i ? starts[i] : t0, el, trans: i ? "push" : "cut" })));
    beat(L, p, C.doing[0], t0, { first: true, sub: C.doing[1], at: [400, 1.3] });

    // Wrong answer explained
    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    p = rigAt(L);
    const avg = K.seq(p.screen, "averages", t0 + 1.5, t0 + 4.4);
    K.track([{ at: t0, el: avg }]);
    beat(L, p, C.wrong, t0, { first: true, at: [470, 1.4] });
    K.tapAt(p.screen, T.mean[0], T.mean[1], t0 + 2.35);
    K.tapAt(p.screen, T.check[0], T.check[1], t0 + 3.25);
    Z.sfx("wrong", t0 + 3.55);
    cam(p, t0 + 3.75, 330, 2.1, 0.75);
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

    // Help, then the lesson's end in the same phone
    [t0] = seg(2);
    const [r0, r1] = seg(1);
    L = K.scene(t0, r1);
    let p = rigAt(L);
    const tut = K.seq(p.screen, "tutor", t0 + 2.4, r0 - 0.2, { from: 1 });
    const done = K.seq(p.screen, "complete", r0 + 0.3, r0 + 1.9, { from: 1 });
    K.track([
      { at: t0, el: tut },
      { at: r0, el: done, trans: "push" },
    ]);
    const hIn = beat(L, p, C.help, t0, { first: true, at: [400, 1.6] });
    K.tapAt(p.screen, T.chip[0], T.chip[1], t0 + 2.64);
    cam(p, hIn + 1.2, 500, 1.9, 1.0);
    cam(p, r0, 180, 2.0, 0.6);

    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    p = rigAt(L);
    const zt = K.still(p.screen, "zu-tab");
    const za = K.still(p.screen, "zu-tab-applied");
    K.track([
      { at: t0, el: zt },
      { at: t0 + 3.6, el: za, trans: "fade" },
    ]);
    const zIn = beat(L, p, C.change, t0, { first: true, at: [360, 1.7] });
    cam(p, zIn + 0.7, 520, 2.0, 1.0);
    K.tapAt(p.screen, T.apply[0], T.apply[1], t0 + 3.5);
    Z.sfx("chime", t0 + 3.7);
  }

  // 11. Progress
  {
    let [t0, t1] = seg(2);
    let L = K.scene(t0, t1);
    let p = rigAt(L);
    const nap = K.still(p.screen, "energy-napping-sheet");
    const glow = K.still(p.screen, "energy-glowing-sheet");
    K.track([
      { at: t0, el: nap },
      { at: t0 + 3.0, el: glow, trans: "fade" },
    ]);
    beat(L, p, C.energy, t0, { first: true, at: [400, 1.9] });

    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    p = rigAt(L);
    const lv = K.still(p.screen, "level");
    const grew = K.still(p.screen, "buddy-grew");
    K.track([
      { at: t0, el: lv },
      { at: t0 + 2.8, el: grew, trans: "push" },
    ]);
    beat(L, p, C.brain, t0, { first: true, at: [360, 1.7] });
    cam(p, t0 + 2.8, 360, 1.75, 0.55);
    Z.sfx("pop", t0 + 3.05);

    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    p = rigAt(L);
    const ci = K.still(p.screen, "checkpoint-intro");
    const cw = K.still(p.screen, "checkpoint-won");
    K.track([
      { at: t0, el: ci },
      { at: t0 + 3.2, el: cw, trans: "push" },
    ]);
    beat(L, p, C.trickster, t0, { first: true, at: [260, 1.8] });
    Z.sfx("chime", t0 + 3.4);
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
    t0 += 0.3;
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
