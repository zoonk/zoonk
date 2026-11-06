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
  const REST = [434 - 62, PS];
  // The phone comes into focus already framed on `at` ([screen y, zoom]) and blurs out at the scene's end.
  // focusOut ends on the cut and the next phone starts there, so two phones never share a frame. After a
  // scene without a phone, focusIn starts 0.15 s after the cut, once that scene has faded out.
  const focusIn = (p, t, at) => {
    cam(p, t, at[0], at[1], 0);
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
      t,
    );
    Z.sfx("whoosh", t);
  };
  const focusOut = (p, t1) =>
    tl.to(
      p.rig,
      { autoAlpha: 0, scale: 0.96, filter: "blur(14px)", duration: 0.3, ease: "power2.in" },
      t1 - 0.3,
    );
  const T = {
    en: {
      build: [293, 323],
      dontKnow: [96, 680],
      mean: [129, 202],
      check: [195, 756],
      review: [8, 184, 124, 26],
      speaker: [168, 93],
      chip: [120, 600],
    },
    pt: {
      build: [286, 347],
      dontKnow: [88, 680],
      mean: [90, 202],
      check: [195, 756],
      review: [8, 184, 158, 26],
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
    const [a0] = seg(2);
    const [b0] = seg(2);
    const [c0] = seg(2.5);
    const [d0] = seg(2);
    const [e0, e1] = seg(2.5);
    const L = K.scene(a0, e1, { fadeIn: 0 });
    const p = rigAt(L);
    const s = p.screen;
    const typing = K.seq(s, "typing", a0 + 0.6, a0 + 3.6);
    const understood = K.still(s, "understood");
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
    focusIn(p, a0, REST);
    cam(p, a0 + 0.5, 280, 1.9, 1.0);
    K.tapAt(s, T.build[0], T.build[1], a0 + 3.95);
    cam(p, b0, 300, 1.7, 0.55);
    cam(p, b0 + 1.5, 270, 1.9, 0.55);
    cam(p, b0 + 2.4, 520, 1.9, 0.7);
    K.tapAt(s, T.dontKnow[0], T.dontKnow[1], b0 + 3.15);
    cam(p, c0, 330, 1.9, 0.55);
    cam(p, c0 + 1.3, 450, 2.4, 1.2);
    K.ring(s, 10, 413, 370, 88, c0 + 2.0, d0 - 0.3);
    Z.sfx("tick", c0 + 2.0);
    cam(p, d0, 300, 1.8, 0.55);
    [d0 + 1.3, d0 + 2.3, d0 + 3.3].forEach((x) => Z.sfx("check", x));
    cam(p, e0, 250, 1.9, 0.55);
    cam(p, e0 + 2.6, 560, 1.9, 1.0);
    focusOut(p, e1);
  }

  // 4. Whatever you're working toward
  {
    const [t0, t1] = seg(1);
    const L = K.scene(t0, t1);
    const ics = [
      ["graduation-cap", "var(--mock)"],
      ["languages", "var(--conv)"],
      ["briefcase-business", "var(--success)"],
      ["lightbulb", "var(--brain)"],
    ];
    ics.forEach(([ic, c], i) => {
      const card = K.card(L, { x: 99 + i * 438, y: 390, w: 340, pad: 30, zoom: 1.2 });
      card.style.cssText += ";height:250px;display:flex;flex-direction:column";
      card.innerHTML = `<div style="color:${c}">${icon(ic, 54, 1.6)}</div><div style="font-weight:600;font-size:32px;letter-spacing:-0.03em;line-height:1.15;margin-top:auto">${C.areas[i]}</div>`;
      K.cardIn(card, t0 + 0.2 + i * 0.12, { y: 50, sound: i === 0, dur: 0.7 });
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
    const plan = K.still(s, "exam-plan");
    const subj = K.still(s, "exam-subject");
    const run = K.still(s, "mock-run");
    const res = K.still(s, "mock-result");
    const extra = K.still(s, pt ? "essay" : "speaking-band");
    const mist = K.still(s, pt ? "mistakes" : "mistakes-open2");
    K.track([
      { at: a0, el: plan },
      { at: a0 + 2.4, el: subj, trans: "push" },
      { at: b0, el: run, trans: "push" },
      { at: b0 + 2.2, el: res, trans: "push" },
      { at: c0, el: extra, trans: "push" },
      { at: d0, el: mist, trans: "push" },
    ]);
    focusIn(p, a0 + 0.15, [330, 1.7]);
    cam(p, a0 + 2.4, 480, 1.8, 0.55);
    cam(p, b0, 230, 1.85, 0.55);
    Z.sfx("chime", b0 + 2.5);
    cam(p, c0, pt ? 250 : 230, 1.85, 0.55);
    cam(p, d0, pt ? 480 : 540, 1.85, 0.55);
    focusOut(p, d1);
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
      { at: c0, el: call, trans: "push" },
      { at: c0 + 2.6, el: fb, trans: "up" },
      { at: d0, el: pat, trans: "push" },
    ]);
    focusIn(p, a0, [300, 1.8]);
    cam(p, b0, 180, 2.2, 0.6);
    K.tapAt(s, T.speaker[0], T.speaker[1], b0 + 2.75, { sound: false });
    Z.sfx(Z.lang === "pt" ? "word-stay" : "word-quedarse", b0 + 2.85);
    cam(p, c0, 380, 1.6, 0.55);
    [c0 + 0.6, c0 + 1.4].forEach((x) => Z.sfx("bubble", x));
    cam(p, c0 + 2.6, 250, 1.8, 0.55);
    cam(p, d0, 200, 2.0, 0.55);
    focusOut(p, d1);
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
      { at: t0 + 2.6, el: tools, trans: "up" },
    ]);
    focusIn(p, t0, [380, 1.7]);
    cam(p, t0 + 1.0, 450, 2.2, 1.0);
    cam(p, t0 + 2.6, 420, 1.9, 0.55);
    focusOut(p, t1);
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
      { at: t0 + 2.2, el: adj, trans: "up" },
    ]);
    focusIn(p, t0, [330, 1.8]);
    cam(p, t0 + 2.2, 400, 1.9, 0.55);
    focusOut(p, t1);
  }

  // 9. Lessons: activities in one phone, each pushed in as the voice names it
  {
    let [t0, t1] = seg(5);
    let L = K.scene(t0, t1);
    let p = rigAt(L);
    const acts = ["polls", "timeline", "map", "projectile", "code", "piano"];
    const starts = [0, 2.6, 4.6, 5.95, 7.25, 8.75].map((x) => t0 + x);
    const plays = acts.map((a, i) =>
      K.seq(p.screen, a, starts[i] + 0.3, i + 1 < acts.length ? starts[i + 1] : t1 - 0.3),
    );
    K.track(plays.map((el, i) => ({ at: starts[i], el, trans: i ? "push" : "cut" })));
    focusIn(p, t0, [400, 1.3]);
    focusOut(p, t1);

    // Wrong answer explained
    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    p = rigAt(L);
    const avg = K.seq(p.screen, "averages", t0 + 0.4, t0 + 3.4);
    K.track([{ at: t0, el: avg }]);
    focusIn(p, t0, [470, 1.4]);
    K.tapAt(p.screen, T.mean[0], T.mean[1], t0 + 1.3);
    K.tapAt(p.screen, T.check[0], T.check[1], t0 + 1.95);
    Z.sfx("wrong", t0 + 2.1);
    cam(p, t0 + 2.8, 330, 2.1, 0.8);
    focusOut(p, t1);
  }

  // 10. Zu
  {
    let [t0, t1] = seg(1);
    let L = K.scene(t0, t1);
    const zu = div("abs", L, K.zu("zu-baby-cheer", 420));
    zu.style.cssText = "left:750px;top:330px";
    tl.fromTo(
      zu,
      { scale: 0.4, autoAlpha: 0, y: 80 },
      { scale: 1, autoAlpha: 1, y: 0, duration: 0.9, ease: "spring" },
      t0 + 0.05,
    );
    Z.sfx("pop", t0 + 0.1);

    // Help, then the lesson's end and the review it schedules, in the same phone
    [t0] = seg(2);
    const [r0, r1] = seg(2);
    L = K.scene(t0, r1);
    const p = rigAt(L);
    const s = p.screen;
    const tut = K.seq(s, "tutor", t0 + 0.9, r0 - 0.2, { from: 1 });
    const done = K.seq(s, "complete", r0 + 0.3, r0 + 1.9, { from: 1 });
    K.track([
      { at: t0, el: tut },
      { at: r0, el: done, trans: "push" },
    ]);
    focusIn(p, t0 + 0.15, [400, 1.6]);
    K.tapAt(s, T.chip[0], T.chip[1], t0 + 1.15);
    cam(p, t0 + 1.8, 500, 1.9, 1.0);
    cam(p, r0, 180, 2.0, 0.6);
    cam(p, r0 + 2.0, 196, 2.6, 1.0);
    K.ring(s, ...T.review, r0 + 2.6, r1 - 0.6);
    Z.sfx("tick", r0 + 2.6);
    focusOut(p, r1);
  }

  // 11. Progress: belts, Zu growing up, a break that resets nothing, and the Trickster
  {
    let [t0, t1] = seg(3);
    let L = K.scene(t0, t1);
    let p = rigAt(L);
    const lv = K.still(p.screen, "level");
    const grew = K.still(p.screen, "buddy-grew");
    K.track([
      { at: t0, el: lv },
      { at: t0 + 4.4, el: grew, trans: "push" },
    ]);
    focusIn(p, t0, [360, 1.7]);
    cam(p, t0 + 1.6, 560, 1.9, 1.2);
    cam(p, t0 + 4.4, 360, 1.75, 0.55);
    Z.sfx("pop", t0 + 4.65);
    focusOut(p, t1);

    [t0, t1] = seg(2);
    L = K.scene(t0, t1);
    p = rigAt(L);
    const nap = K.still(p.screen, "energy-napping-sheet");
    const glow = K.still(p.screen, "energy-glowing-sheet");
    K.track([
      { at: t0, el: nap },
      { at: t0 + 3.0, el: glow, trans: "fade" },
    ]);
    focusIn(p, t0, [400, 1.9]);
    focusOut(p, t1);

    // The Trickster is a final boss: the camera creeps in on him and the scene ends there.
    [t0, t1] = seg(3);
    L = K.scene(t0, t1);
    p = rigAt(L);
    K.track([{ at: t0, el: K.still(p.screen, "checkpoint-intro") }]);
    focusIn(p, t0, [260, 1.8]);
    Z.sfx("hit", t0 + 2.1);
    cam(p, t0 + 0.6, 130, 2.8, 6.0);
    focusOut(p, t1);
  }

  // 12. Payoff
  {
    const [t0, t1] = seg(2);
    const L = K.scene(t0, t1, { fadeOut: 0 });
    Z.sfx("whoosh", t0 - 0.1);
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
  }

  // 13. CTA
  {
    const [t0, t1] = seg(5.5);
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
