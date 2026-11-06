// YouTube thumbnail per locale, with a real Today screen.
__build((Z) => {
  const { div } = Z;
  const L = Z.layer();
  L.style.background =
    "radial-gradient(1200px 800px at 75% 60%, oklch(0.93 0.03 252), var(--ground) 70%)";
  const brand = div(
    "abs row",
    L,
    `<span style="width:64px;height:64px;color:var(--ink);display:block">${K.LOGO}</span><span style="font-weight:650;font-size:52px;letter-spacing:-0.035em">Zoonk <span style="color:var(--muted-fg);font-weight:500">2.0</span></span>`,
  );
  brand.style.cssText += ";left:110px;top:250px;gap:18px";
  const h = div(
    "abs hero",
    L,
    Z.lang === "pt" ? "Um plano diário<br>para o seu objetivo." : "A daily plan<br>for your goal.",
  );
  h.style.cssText += ";left:110px;top:360px;font-size:132px;text-align:left";
  K.fit(h, 880, 80);
  const p = K.phone(L, { x: 1440, y: 600 });
  gsap.set(p.phone, { scale: 1.22, rotate: 6 });
  const st = K.still(p.screen, "today-done2");
  gsap.set(st, { autoAlpha: 1 });
  const zu = div("abs", L, K.zu("zu-baby-cheer", 300));
  zu.style.cssText = "left:1010px;top:700px;transform:rotate(-8deg)";
  Z.end(1);
});
