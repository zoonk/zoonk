"use client";

import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { readDuration } from "@zoonk/ui/lib/motion";
import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type Act, type PosesByExpression, playAct } from "./acting";

/**
 * `delay` holds the act for its beat in a moment, in milliseconds on the animation clock;
 * `playbackRate` slows an act down to study it (0.1 plays it at 10%).
 */
export type PlayOptions = { delay?: number; playbackRate?: number };

/**
 * What a character's parent can ask of it: play one of its acts, resolved once it lands (true) or
 * once another act stops it (false).
 */
export type ActorHandle<ActName extends string> = {
  play: (name: ActName, options?: PlayOptions) => Promise<boolean>;
};

/**
 * What a character does because something happened, once, when the moment it's in plays
 * (`useCelebration`): an act, on the moment's beat (`delay`, in milliseconds).
 */
export type Reaction<ActName extends string> = { act: ActName; delay?: number };

/**
 * One blink a while after a reaction lands, so the character holds its pose without freezing (a
 * moving hold): its blink, and the faces it shows its eyes open in, the only ones a blink closes.
 */
export type AfterBlink<Expression extends string, ActName extends string> = {
  act: ActName;
  faces: ReadonlySet<Expression>;
};

/** How long a character holds the pose a reaction landed in before it blinks once: about 2 s. */
const BLINK_AFTER_FRAMES = 48;

/** The keys that move a screen on (Continue's ⏎, Esc): pressing one lands an act at once. */
const LANDING_KEYS: ReadonlySet<string> = new Set(["Enter", "Escape"]);

type Queued<Expression extends string> = {
  act: Act<Expression>;
  options: PlayOptions;
  resolve: (landed: boolean) => void;
  run: number;
};

/** The act under way, and what stops listening for the learner moving on. */
type Running = { animations: Animation[]; release?: () => void; run: number };

const IDLE: Running = { animations: [], run: 0 };

/** Stops the act under way where it is: its parts go back to the still drawing. */
function stopActing(running: React.RefObject<Running>) {
  for (const animation of running.current.animations) {
    animation.cancel();
  }

  running.current.release?.();
  running.current = IDLE;
}

/**
 * While an act plays, the learner moving on (a press anywhere, Continue's ⏎, Esc) lands it at once,
 * so it never plays on behind what they do next. Returns what stops listening.
 */
function landOnInput(animations: readonly Animation[]): () => void {
  const land = (event: Event) => {
    if (event instanceof KeyboardEvent && (event.repeat || !LANDING_KEYS.has(event.key))) {
      return;
    }

    for (const animation of animations) {
      animation.finish();
    }
  };

  document.addEventListener("click", land, true);
  document.addEventListener("keydown", land, true);

  return () => {
    document.removeEventListener("click", land, true);
    document.removeEventListener("keydown", land, true);
  };
}

/**
 * Makes a character drawn in `svg` act: it draws `expression` still until an act plays, then draws
 * the faces the act swaps in (hidden), plays the act on its parts in the commit that drew them, and
 * lands by drawing the act's expression still in the same task as it cancels the animations, so the
 * last frame and the still drawing never flash between them. A new act stops the one under way
 * where it is.
 *
 * A `reaction` plays once, when the moment the character is in plays (`useCelebration`), from
 * `expression`, then one blink (`afterBlink`) about 2 s after it lands. Where the moment doesn't
 * play (the server's page, a reload, a revisit, the way back), the character is drawn still in the
 * expression the reaction lands in, so the server draws the final pose and nothing flashes.
 */
export function useActor<Expression extends string, ActName extends string>({
  acts,
  afterBlink,
  expression,
  handle,
  poses,
  reaction,
  svg,
}: {
  acts: Record<ActName, Act<Expression>>;
  afterBlink?: AfterBlink<Expression, ActName>;
  expression: Expression;
  handle?: React.Ref<ActorHandle<ActName>>;
  poses?: PosesByExpression<Expression>;
  reaction?: Reaction<ActName>;
  svg: React.RefObject<SVGSVGElement | null>;
}) {
  const celebrate = useCelebration();
  const [landed, setLanded] = useState<Expression | null>(null);

  const [stage, setStage] = useState<{ run: number; swapFaces: readonly Expression[] }>({
    run: 0,
    swapFaces: [],
  });

  const resting = reaction && !celebrate ? (acts[reaction.act].to ?? expression) : expression;
  const shown = landed ?? resting;

  const current = useRef(shown);
  const runs = useRef(0);
  const queued = useRef<Queued<Expression> | null>(null);
  const running = useRef<Running>(IDLE);
  const reacted = useRef(false);

  // The next act starts from the expression drawn now.
  useLayoutEffect(() => {
    current.current = shown;
  }, [shown]);

  // Starts the queued act in the commit that drew the faces it swaps in.
  useLayoutEffect(() => {
    const next = queued.current;
    const root = svg.current;

    if (!next || next.run !== stage.run || !root) {
      return;
    }

    queued.current = null;
    const landing = next.act.to ?? current.current;

    const playback = playAct({
      act: next.act,
      delay: next.options.delay,
      from: current.current,
      playbackRate: next.options.playbackRate,
      poses,
      root,
    });

    running.current = {
      animations: playback.animations,
      release: landOnInput(playback.animations),
      run: next.run,
    };

    void playback.finished.then(() => {
      if (running.current.run !== next.run) {
        next.resolve(false);
        return;
      }

      current.current = landing;

      flushSync(() => {
        setLanded(landing);
        setStage((drawn) => ({ ...drawn, swapFaces: [] }));
      });

      stopActing(running);
      next.resolve(true);
    });

    return () => {
      if (running.current.run === next.run) {
        // A page hidden by the router keeps its state: Back must show the act's final pose.
        setLanded(landing);
        stopActing(running);
      }
    };
  }, [poses, stage, svg]);

  const play = useCallback(
    (name: ActName, options: PlayOptions = {}) =>
      new Promise<boolean>((resolve) => {
        const act = acts[name];
        const run = runs.current + 1;
        runs.current = run;

        stopActing(running);
        queued.current?.resolve(false);
        queued.current = { act, options, resolve, run };
        setStage({ run, swapFaces: act.to && act.to !== current.current ? [act.to] : [] });
      }),
    [acts],
  );

  useImperativeHandle(handle, () => ({ play }), [play]);

  // The reaction plays once, even when the router hides the page and shows it again.
  useLayoutEffect(() => {
    if (!reaction || !celebrate || reacted.current) {
      return;
    }

    reacted.current = true;

    void play(reaction.act, { delay: reaction.delay }).then((didLand) => {
      const root = svg.current;

      if (didLand && root && afterBlink?.faces.has(current.current)) {
        void play(afterBlink.act, { delay: BLINK_AFTER_FRAMES * readDuration(root, "frame") });
      }
    });
  }, [afterBlink, celebrate, play, reaction, svg]);

  return { expression: shown, swapFaces: stage.swapFaces };
}
