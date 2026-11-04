// The Zoonk 2.0 vertical cut (9:16).
// Text and CTA stay inside the shared safe box: x 120–960, y 270–1250.
__build((Z) => {
  const { div, tl, icon } = Z;
  const C = Z.C;
  const B = Z.BAR;
  const PX = 540;
  const PTOP = 650;
  const PS = 1.24;
  let cur = 0;
  const seg = (bars) => {
    const a = cur;
    cur += bars * B;
    return [a, cur];
  };
  const phoneAt = (L) => {
    const p = K.phone(L, { x: PX, y: PTOP + 434 });
    gsap.set(p.phone, { scale: PS, transformOrigin: "50% 0%" });
    return p;
  };
  const top = (L, title, sub, tIn, tOut) =>
    K.say2(
      L,
      {
        x: 120,
        y: 300,
        w: 840,
        align: "center",
        anchor: "top",
        title,
        sub,
        size: 88,
        subSize: 44,
        subW: 840,
        gap: 20,
      },
      tIn,
      tOut,
    );
  const brandHtml = `<span style="width:54px;height:54px;color:var(--ink);display:block">${K.LOGO}</span><span style="font-weight:640;font-size:40px;letter-spacing:-0.035em">Zoonk <span style="color:var(--muted-fg);font-weight:500">2.0</span></span>`;

  // 1. Hook: brand + goal box typing
  let [t0, t1] = seg(2);
  let L = K.scene(t0, t1, { fadeIn: 0, fadeOut: 0 });
  const brand = div("abs row", L, brandHtml);
  brand.style.cssText += ";left:0;right:0;top:300px;justify-content:center;gap:16px";
  const q = div("abs hero", L, C.whatAchieve);
  q.style.cssText += ";left:0;right:0;top:410px;font-size:76px";
  K.fit(q, 840);
  const boxCss =
    "left:120px;width:840px;top:640px;border:3px solid var(--ink);box-shadow:0 0 0 7px oklch(0 0 0 / 8%), 0 40px 80px -30px rgb(0 0 0/18%);border-radius:40px;padding:36px 40px 30px;background:#fff";
  const boxHtml = (
    inner,
  ) => `<div style="font-size:56px;letter-spacing:-0.03em;line-height:1.2"><b style="font-weight:560">${C.iWantTo}</b> ${inner}</div>
    <div class="row" style="justify-content:space-between;margin-top:30px"><span style="color:var(--muted-fg)">${icon("paperclip", 38, 1.8)}</span><div class="btn gbtn" style="height:80px;padding:0 36px;font-size:31px;border-radius:22px">${C.build}</div></div>`;
  const box = div("abs", L, boxHtml(`<span class="gt" style="font-weight:420"></span>`));
  box.style.cssText = boxCss;
  const end = Z.type(box.querySelector(".gt"), C.vGoal, 0.35, {
    cps: 16,
    seed: 5,
    caretUntil: 4.2,
  });
  Z.tap(box.querySelector(".gbtn"), end + 0.45);
  tl.to([box, q, brand], { y: -60, autoAlpha: 0, duration: 0.45, ease: "power2.in" }, t1 - 0.45);

  // 2. A plan for every day
  [t0, t1] = seg(2);
  L = K.scene(t0, t1, { fadeIn: 0.25 });
  top(L, C.vPlan, null, t0 + 0.15);
  let p = phoneAt(L);
  K.phoneIn(p, t0, { y: 220, dur: 0.9 });
  const plan = K.still(p.screen, "exam-plan");
  K.track([{ at: t0, el: plan }]);

  // 3. Learn by doing: three activities
  [t0, t1] = seg(2);
  L = K.scene(t0, t1, { fadeIn: 0.25 });
  top(L, C.vDoing, null, t0 + 0.15);
  p = phoneAt(L);
  gsap.set(p.phone, { autoAlpha: 1 });
  const acts = ["timeline", "projectile", "code"];
  const slot = (t1 - t0) / acts.length;
  K.track(
    acts.map((a, i) => ({
      at: t0 + i * slot,
      el: K.seq(p.screen, a, t0 + i * slot + 0.1, t0 + (i + 1) * slot - 0.1),
      trans: i ? "push" : "fade",
    })),
  );

  // 4. Wrong answers explained
  [t0, t1] = seg(1.5);
  L = K.scene(t0, t1, { fadeIn: 0.25 });
  top(L, C.vWrong, null, t0 + 0.15, t0 + 2.2);
  p = phoneAt(L);
  gsap.set(p.phone, { autoAlpha: 1 });
  K.track([{ at: t0, el: K.seq(p.screen, "averages", t0 + 0.2, t0 + 2.4) }]);
  const T = {
    en: { mean: [129, 202], chip: [120, 508] },
    pt: { mean: [90, 202], chip: [150, 508] },
  }[Z.lang];
  K.tapAt(p.screen, T.mean[0], T.mean[1], t0 + 0.8);
  K.tapAt(p.screen, 195, 756, t0 + 1.4);
  Z.sfx("wrong", t0 + 1.7);
  tl.to(p.phone, { y: -420, duration: 1.0, ease: "swing" }, t0 + 2.2);

  // 5. Ask Zu
  [t0, t1] = seg(2);
  L = K.scene(t0, t1, { fadeIn: 0.25 });
  top(L, C.vZu, null, t0 + 0.15, t0 + 2.4);
  p = phoneAt(L);
  gsap.set(p.phone, { autoAlpha: 1 });
  K.track([{ at: t0, el: K.seq(p.screen, "tutor", t0 + 0.2, t1 - 0.2, { from: 1 }) }]);
  K.tapAt(p.screen, T.chip[0], T.chip[1], t0 + 1.0);
  tl.to(p.phone, { y: -330, duration: 1.0, ease: "swing" }, t0 + 2.4);

  // 6. Energy, not streaks
  [t0, t1] = seg(2);
  L = K.scene(t0, t1, { fadeIn: 0.25 });
  top(L, C.vEnergy[0], C.vEnergy[1], t0 + 0.15, t0 + 2.7);
  p = phoneAt(L);
  K.phoneIn(p, t0, { y: 160, dur: 0.8 });
  const nap = K.still(p.screen, "energy-napping-sheet");
  const glow = K.still(p.screen, "energy-glowing-sheet");
  K.track([
    { at: t0, el: nap },
    { at: t0 + 3.4, el: glow, trans: "fade" },
  ]);
  tl.to(p.phone, { y: -300, duration: 1.0, ease: "swing" }, t0 + 2.5);

  // 7. Any goal
  [t0, t1] = seg(2);
  L = K.scene(t0, t1, { fadeIn: 0.25 });
  top(L, C.vAny[0], C.vAny[1], t0 + 0.15);
  [
    ["mock-result", -330, -7],
    ["call", 330, 7],
    ["plan-career-modules", 0, 0],
  ].forEach(([name, dx, rot], i) => {
    const ph = K.phone(L, { x: PX + dx * 1.08, y: 1180 });
    gsap.set(ph.phone, { scale: i === 2 ? 1.18 : 1.0, rotate: rot, zIndex: i === 2 ? 3 : 1 });
    const st = K.still(ph.screen, name);
    gsap.set(st, { autoAlpha: 1 });
    tl.fromTo(
      ph.phone,
      { y: 260, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.9, ease: "zo" },
      t0 + 0.3 + i * 0.15,
    );
  });
  Z.sfx("whoosh", t0 + 0.3);

  // 8. CTA, then back to the empty goal box so the loop restarts cleanly
  [t0, t1] = seg(3);
  L = K.scene(t0, undefined, { dark: true, fadeIn: 0 });
  const logo = div("abs", L, K.LOGO);
  logo.style.cssText = "left:465px;top:380px;width:150px;height:150px;color:#fff;--bolt:var(--ink)";
  tl.fromTo(
    logo,
    { autoAlpha: 0, scale: 0.6, filter: "blur(10px)" },
    { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "zo" },
    t0 + 0.05,
  );
  Z.sfx("hit", t0);
  const h = div("abs hero", L, C.ctaTitle);
  h.style.cssText += ";left:120px;right:120px;top:600px;font-size:92px;color:#fff";
  K.fit(h, 840);
  gsap.set(h, { autoAlpha: 0 });
  Z.reveal(h, t0 + 0.35, { stagger: 0.05, dur: 0.6 });
  const url = div("abs hero", L, C.ctaUrl);
  url.style.cssText += ";left:0;right:0;top:760px;font-size:104px;color:#fff";
  gsap.set(url, { autoAlpha: 0 });
  Z.reveal(url, t0 + 0.9, { stagger: 0.05, dur: 0.6 });
  const note = div("abs sub", L, C.ctaNote);
  note.style.cssText +=
    ";left:120px;right:120px;top:930px;font-size:38px;color:oklch(0.66 0.012 286)";
  gsap.set(note, { autoAlpha: 0 });
  Z.reveal(note, t0 + 1.5, { stagger: 0.04, dur: 0.6 });
  const back = Z.layer();
  back.style.background = "var(--ground)";
  gsap.set(back, { autoAlpha: 0 });
  tl.set(back, { autoAlpha: 1 }, t1 - 0.5);
  const b2 = div("abs", back, boxHtml(`<span class="caret"></span>`));
  b2.style.cssText = boxCss;
  const q2 = div("abs hero", back, C.whatAchieve);
  q2.style.cssText = q.style.cssText;
  const br2 = div("abs row", back, brandHtml);
  br2.style.cssText = brand.style.cssText;
  Z.end(t1);

  K.typeSfx();
});
