import { type LearnerId, LEARNERS } from "../../realui/learners/learners";
import {
  EASE,
  type Piece,
  arrive,
  blink,
  camera,
  digits,
  field,
  leave,
  mover,
  typingTimes,
} from "../../realui/stage/kit";
import { pieces } from "../../realui/stage/pieces";
import { type Scene, type Stage } from "../../realui/stage/stage";
// The Zoonk 2 launch set. Each still is a moment: one real piece in focus, one quieter layer behind it
// that leaves the frame, one light, one sign of the moment. The clip is one shot from the sentence to
// the plan to today. Copy this file to start a new set; references/social-stills.md and
// references/feature-demo.md say how each is built.
import { type Lang } from "../../realui/story";

/** Who each moment shows, per language: the goals the app itself suggests there. */
const CAST: Record<"goal" | "time", Record<Lang, LearnerId>> = {
  goal: { en: "madrid", pt: "ana" },
  time: { en: "sat", pt: "ana" },
};

/** The sentence just typed, the caret still in it, and the plan it becomes forming underneath. */
async function placeGoal(stage: Stage): Promise<Piece> {
  const who = CAST.goal[stage.lang];
  const { wide } = stage;
  const [heading, box, structure] = await Promise.all([
    stage.piece(pieces.goal.heading(who, { wide })),
    stage.piece(pieces.goal.box(who, { wide })),
    stage.piece(pieces.reveal.structure(who, { wide })),
  ]);
  const typed = field(box, "textarea", LEARNERS[who].goal.text);
  typed.type(LEARNERS[who].goal.text.length);
  typed.focus(true);

  const s = wide ? 2.74 : 2.34;
  const x = (stage.size.w - box.w * s) / 2;
  const top = wide ? 80 : 132;
  const boxTop = top + heading.h * s + 22 * s;
  heading.place({ x, y: top, s });
  box.place({ x, y: boxTop, s });
  // The layer behind lines up with the words inside the box and runs off the bottom edge.
  structure.place({
    x: x + 12 * s,
    y: boxTop + box.h * s + (wide ? 62 : 78),
    s: (box.w * s - 24 * s) / structure.w,
  });
  stage.fade(structure, "bottom", wide ? 28 : 52, 100);
  stage.light(50, wide ? 38 : 34);
  return structure;
}

const goal: Scene = async (stage) => void (await placeGoal(stage));

/** What the learner's time covers, a finger on what covers everything, and behind it what that gives. */
const time: Scene = async (stage) => {
  const who = CAST.time[stage.lang];
  const { wide } = stage;
  const [heading, answer, after] = await Promise.all([
    wide ? null : stage.piece(pieces.time.heading(who, { wide })),
    stage.piece(pieces.time.answer(who, { wide })),
    stage.piece(
      pieces.time.answer(who, { query: `minutes=${LEARNERS[who].everythingMinutes}`, wide }),
    ),
  ]);
  const x = wide ? 190 : 60;
  // As large as the frame allows with every word inside it; the layer behind steps right only as far as it fits.
  const room = stage.size.w - x - 80;
  const s = Math.min(wide ? 4.1 : 2.62, room / answer.inkWidth());
  const behind = wide ? Math.max(0, Math.min(190, room - after.inkWidth() * s)) : 0;
  const top = heading ? 132 + heading.h * s + 22 * s : 96;
  heading?.place({ x: x + 10 * s, y: 132, s });
  answer.place({ x, y: top, s });
  const offer = answer.rect('button[data-slot="button"]');
  stage.touch(
    x + (offer.x + offer.w * 0.8) * s,
    top + (offer.y + offer.h * 0.66) * s,
    wide ? 96 : 80,
  );
  after.place({ x: x + behind, y: top + answer.h * s + (wide ? 64 : 120), s, o: 0.55 });
  stage.fade(after, "bottom", wide ? 16 : 30, wide ? 74 : 100);
  stage.light(44, wide ? 40 : 36);
};

/** The day the plan made, a finger on the first lesson, and the week beside it. */
const today: Scene = async (stage) => {
  const who = CAST.goal[stage.lang];
  const [day, week] = await Promise.all([
    stage.piece(pieces.today.day(who, { wide: false })),
    stage.piece(pieces.today.week(who, { wide: false })),
  ]);
  const first = day.rect('[data-slot="today-next"]');
  if (stage.wide) {
    const s = 3.15;
    const x = 104;
    const top = (stage.size.h - day.h * s) / 2 - 6;
    day.place({ x, y: top, s });
    stage.touch(x + (first.x + first.w * 0.84) * s, top + (first.y + first.h * 0.56) * s, 88);
    // The app's wide layout puts the week beside the day; here it runs off the right edge.
    week.place({ x: x + day.w * s + 92, y: top + 12 * s, s: 2.1, o: 0.85 });
    stage.fade(week, "right", 26, 60);
    stage.light(40, 40);
    return;
  }
  const s = 2.3;
  const x = (stage.size.w - day.w * s) / 2;
  const top = 150;
  day.place({ x, y: top, s });
  stage.touch(x + (first.x + first.w * 0.86) * s, top + (first.y + first.h * 0.56) * s, 76);
  week.place({ x: x + 12 * s, y: top + day.h * s + 90, s, o: 0.85 });
  stage.fade(week, "bottom", 40, 100);
  stage.light(50, 36);
};

/** The bolder alternative for a hero or a cover: the goal seen from an angle, the layer behind out of focus. */
const goalAngle: Scene = async (stage) => stage.tilt([await placeGoal(stage)]);

/** When each part of the clip happens, in seconds, for a sentence typed by 4.1 s; a longer one moves everything after the typing. */
const BEATS = {
  focus: 0.5,
  type: 0.95,
  press: 4.6,
  toPlan: 4.75,
  path: 5.9,
  toToday: 8.7,
  swap: 9.22,
  week: 11,
  toEnd: 12.9,
  end: 16.5,
};
const TYPED_PER_SECOND = 19.5;

function beatsFor(text: string) {
  const times = typingTimes(text, BEATS.type, TYPED_PER_SECOND);
  const typed = times.at(-1) ?? BEATS.type;
  const shift = Math.max(0, typed + 0.5 - BEATS.press);
  const later = (at: number) => (at >= BEATS.press ? at + shift : at);
  const beats = Object.fromEntries(Object.entries(BEATS).map(([name, at]) => [name, later(at)]));
  return { beats: beats as typeof BEATS, times, typed };
}

/** Goal to plan to today in one shot: each change is carried by something already on screen. */
const clip: Scene = async (stage) => {
  const { tl, world, size } = stage;
  const who = CAST.goal[stage.lang];
  const text = LEARNERS[who].goal.text;
  const { beats: B, times, typed: typingEnd } = beatsFor(text);
  const wide = true;
  const empty = { query: "typed=0", wide };
  const [heading, box, button, planTitle, plan, path, day, week] = await Promise.all([
    stage.piece(pieces.goal.heading(who, { wide })),
    stage.piece(pieces.goal.box(who, empty)),
    stage.piece(pieces.goal.button(who, empty)),
    stage.piece(pieces.reveal.heading(who, { wide })),
    stage.piece(pieces.reveal.plan(who, { wide })),
    stage.piece(pieces.reveal.structure(who, { w: 660, wide })),
    stage.piece(pieces.today.day(who, { w: 540, wide })),
    stage.piece(pieces.today.week(who, { w: 540, wide })),
  ]);

  // Where things sit in the world, at zoom 1.
  const S1 = 2.5;
  const x1 = (size.w - box.w * S1) / 2;
  const top1 = 312;
  const boxTop1 = top1 + heading.h * S1 + 22 * S1;
  const S2 = 2.4;
  const x2 = (size.w - box.w * S2) / 2;
  // The title sits far enough above the readouts to be out of frame once the camera rests on the path.
  const planY = { box: 96, title: 318, plan: 318 + planTitle.h * S2 + 96 };
  const pathY = planY.plan + plan.h * S2 + 76;
  const planRest = (planY.plan + pathY + path.h * S2) / 2;

  box.el.style.zIndex = "5";
  const headingAt = mover(tl, heading, { x: x1, y: top1, s: S1 });
  const boxAt = mover(tl, box, { x: x1, y: boxTop1, s: S1 });
  const buttonS = 2.1;
  const buttonY = boxTop1 + box.h * S1 + 44;
  const buttonAt = mover(tl, button, {
    x: x1 + box.w * S1 - button.w * buttonS,
    y: buttonY,
    s: buttonS,
  });
  const titleAt = mover(tl, planTitle, { x: x2, y: planY.title, s: S2, o: 0 });
  const planAt = mover(tl, plan, { x: x2, y: planY.plan, s: S2, o: 0 });
  const pathAt = mover(tl, path, { x: x2, y: pathY, s: S2, o: 0 });

  // Today is placed so its minutes land exactly on the plan's: the number carries the change of screen.
  const planMinutes = plan.q('[data-slot="big-quantity"]');
  const dayMinutes = day.q('[data-slot="page-header"] [data-slot="big-quantity"]');
  const from = digits(plan, planMinutes);
  const to = digits(day, dayMinutes);
  const S3 = (S2 * from.w) / to.w;
  const anchor = { x: x2 + from.x * S2, y: planY.plan + (from.y + from.h / 2) * S2 };
  const dayAt0 = { x: anchor.x - to.x * S3, y: anchor.y - (to.y + to.h / 2) * S3 };
  const dayAt = mover(tl, day, { ...dayAt0, s: S3, o: 0 });
  const weekAt = mover(tl, week, {
    x: dayAt0.x + 12 * S3,
    y: dayAt0.y + day.h * S3 + 64,
    s: S3,
    o: 0,
  });
  const dayCenter = { x: dayAt0.x + (day.w * S3) / 2, y: dayAt0.y + (day.h * S3) / 2 };
  const allHeight = day.h * S3 + 64 + week.h * S3;
  const allCenterY = dayAt0.y + allHeight / 2;
  const zAll = Math.min(1, (size.h - 150) / allHeight);
  const zDay = Math.min(1, (size.h - 130) / (day.h * S3));

  // The camera never stops: it leans in while the sentence is written, follows the box up, travels down
  // the plan as it forms, slides to today keeping the minutes in place, and opens out for the week.
  const cam = camera(tl, world, size, { cx: 960, cy: 540, z: 1 });
  cam.zoomTo(0, B.press, 1.055, EASE.swing);
  cam.cy.to(0, B.press, 560, EASE.swing);
  cam.zoomTo(B.toPlan, 1.15, 1);
  cam.cy.to(B.path - 0.3, 2.6, planRest, EASE.swing);
  cam.zoomTo(B.path + 2.25, B.toToday - B.path - 2.25, 1.02, EASE.linear);
  cam.cx.to(B.toToday, 1.5, dayCenter.x, EASE.inOut);
  cam.cy.to(B.toToday, 1.5, dayCenter.y, EASE.inOut);
  cam.zoomTo(B.toToday, 1.5, zDay);
  cam.cy.to(B.week - 0.45, 1.9, allCenterY, EASE.swing);
  cam.zoomTo(B.week - 0.45, 1.9, zAll, EASE.swing);
  cam.zoomTo(B.week + 1.45, B.toEnd + 0.6 - (B.week + 1.45), zAll * 0.985, EASE.linear);

  // 1. The sentence. "Build my plan" wakes on the first letter, as it does in the app.
  const typed = field(box, "textarea", text);
  const buttonField = field(button, "textarea", text);
  buttonField.caret.style.display = "none";
  tl.each((t) => {
    const n = times.filter((at) => at <= t).length;
    typed.type(n);
    buttonField.type(Math.min(n, 1));
    typed.focus(t >= B.focus && t < B.press + 0.1);
    const on = blink({
      t,
      focused: [B.focus, B.press + 0.1],
      typingFrom: B.type - 0.05,
      typingTo: typingEnd + 0.35,
    });
    typed.caret.style.opacity = on ? "1" : "0";
  });
  const pressed = button.q("button[type=submit]");
  const press = tl
    .track(1)
    .to(B.press, 0.12, 0.965, EASE.out)
    .to(B.press + 0.12, 0.3, 1, EASE.out);
  tl.each((t) => {
    pressed.style.transform = `scale(${press.at(t)})`;
  });
  button.el.style.overflow = "visible";

  // 2. The plan comes out from under the box, part by part.
  headingAt.o.to(B.toPlan, 0.3, 0, EASE.out);
  headingAt.y.to(B.toPlan, 0.5, top1 - 40, EASE.in);
  buttonAt.o.to(B.toPlan + 0.05, 0.25, 0, EASE.out);
  buttonAt.y.to(B.toPlan, 0.9, buttonY - 120, EASE.inOut);
  boxAt.x.to(B.toPlan, 0.85, x2, EASE.inOut);
  boxAt.y.to(B.toPlan, 0.85, planY.box, EASE.inOut);
  boxAt.s.to(B.toPlan, 0.85, S2, EASE.inOut);
  for (const at of [titleAt, planAt, pathAt]) at.o.set(B.toPlan, 1);
  arrive(tl, [planTitle.q("h1"), planTitle.q("p")], B.toPlan + 0.32, { stagger: 0.08, rise: 14 });
  const readoutRow = plan.q('[data-slot="reveal-plan"] > div:first-child');
  const readouts = plan.all<HTMLElement>('[data-slot="reveal-plan"] > div:first-child > div');
  const coverage = plan.q('[data-slot="reveal-coverage"]');
  const rest = [...plan.q('[data-slot="reveal-plan"]').children].slice(2) as HTMLElement[];
  arrive(tl, [readoutRow], B.toPlan + 0.5, { rise: 0, dur: 0.5 });
  arrive(tl, readouts, B.toPlan + 0.54, { stagger: 0.12, rise: 14 });
  arrive(tl, [coverage, ...rest], B.toPlan + 0.84, { stagger: 0.1, rise: 12 });
  arrive(tl, [path.q('[data-slot="page-section-header"]')], B.path - 0.2, { rise: 12 });
  arrive(tl, path.all("ol > li, ul > li"), B.path, { stagger: 0.24, rise: 16, dur: 0.7 });

  // 3. The plan becomes today. Everything but the minutes goes first, so nothing sits under the rows arriving.
  // What leaves is the children of what arrived, so the two fades don't fight over one opacity.
  for (const at of [boxAt, titleAt]) at.o.set(B.toToday, 0);
  pathAt.o.to(B.swap - 0.3, 0.3, 0, EASE.linear);
  const firstReadout = readouts[0];
  leave(
    tl,
    [
      ...(firstReadout ? ([...firstReadout.children].slice(1) as HTMLElement[]) : []),
      ...readouts.slice(1).flatMap((readout) => [...readout.children] as HTMLElement[]),
      ...[coverage, ...rest].flatMap((line) => [...line.children] as HTMLElement[]),
    ],
    B.swap - 0.2,
    0.25,
  );
  planAt.o.to(B.swap, 0.35, 0, EASE.linear);
  dayAt.o.set(B.swap - 0.02, 1);
  arrive(tl, [...dayMinutes.querySelectorAll<HTMLElement>(":scope > span")], B.swap, {
    rise: 0,
    dur: 0.45,
  });
  arrive(tl, [day.q('h1[data-slot="page-title"]')], B.swap + 0.45, { rise: 14 });
  arrive(tl, day.all('[data-slot="today-day-segment"]').reverse(), B.swap + 0.02, {
    stagger: 0.06,
    rise: 0,
    dur: 0.5,
  });
  arrive(tl, day.all('[data-slot="today-session-list"] ol > li'), B.swap + 0.1, {
    stagger: 0.085,
    rise: 16,
    dur: 0.7,
  });

  // 4. The week, day by day.
  weekAt.o.set(B.week - 0.1, 1);
  arrive(tl, [week.q('[data-slot="page-section-header"]')], B.week, { rise: 12 });
  arrive(tl, week.all("ol > li"), B.week + 0.12, { stagger: 0.055, rise: 12, dur: 0.6 });

  // 5. Where to go.
  stage.end(B.toEnd, B.end);
};

export const scenes: Record<string, Scene> = { clip, goal, "goal-angle": goalAngle, time, today };
