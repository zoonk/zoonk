"use client";

import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { readDuration } from "@zoonk/ui/lib/motion";
import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type Act, type PosesByExpression, playAct } from "./acting";

export type PlayOptions = { delayMs?: number; playbackRate?: number };

/** `play` resolves true once the act lands, false once another act stops it. */
export type ActorHandle<ActName extends string> = {
  play: (name: ActName, options?: PlayOptions) => Promise<boolean>;
};

export type Reaction<ActName extends string> = { act: ActName; delayMs?: number };

export type AfterBlink<Expression extends string, ActName extends string> = {
  act: ActName;
  faces: ReadonlySet<Expression>;
};

const BLINK_AFTER_FRAMES = 48;

const LANDING_KEYS: ReadonlySet<string> = new Set(["Enter", "Escape"]);

type Queued<Expression extends string> = {
  act: Act<Expression>;
  options: PlayOptions;
  resolve: (landed: boolean) => void;
  run: number;
};

type Running = { animations: Animation[]; release?: () => void; run: number };

const IDLE: Running = { animations: [], run: 0 };

function stopActing(running: React.RefObject<Running>) {
  for (const animation of running.current.animations) {
    animation.cancel();
  }

  running.current.release?.();
  running.current = IDLE;
}

/** The learner moving on lands the act at once, so it never plays on behind what they do next. */
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
 * Lands by drawing the act's expression in the same task that cancels the animations, so nothing
 * flashes between them. Where the moment doesn't play, the reaction's landing pose is drawn still.
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

  useLayoutEffect(() => {
    current.current = shown;
  }, [shown]);

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
      delayMs: next.options.delayMs,
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

    void play(reaction.act, { delayMs: reaction.delayMs }).then((didLand) => {
      const root = svg.current;

      if (didLand && root && afterBlink?.faces.has(current.current)) {
        void play(afterBlink.act, { delayMs: BLINK_AFTER_FRAMES * readDuration(root, "frame") });
      }
    });
  }, [afterBlink, celebrate, play, reaction, svg]);

  return { expression: shown, swapFaces: stage.swapFaces };
}
