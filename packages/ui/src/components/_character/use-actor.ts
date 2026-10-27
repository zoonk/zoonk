"use client";

import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type Act, type PosesByExpression, playAct } from "./acting";

/** `playbackRate` slows an act down to study it (0.1 plays it at 10%). */
export type PlayOptions = { playbackRate?: number };

/** What a character's parent can ask of it: play one of its acts, resolved once it lands. */
export type ActorHandle<ActName extends string> = {
  play: (name: ActName, options?: PlayOptions) => Promise<void>;
};

type Queued<Expression extends string> = {
  act: Act<Expression>;
  options: PlayOptions;
  resolve: () => void;
  run: number;
};

type Running = { animations: Animation[]; run: number };

/** Stops the act under way where it is: its parts go back to the still drawing. */
function stopActing(running: React.RefObject<Running>) {
  for (const animation of running.current.animations) {
    animation.cancel();
  }

  running.current = { animations: [], run: 0 };
}

/**
 * Makes a character drawn in `svg` act: it draws `expression` still until `play` is called, then
 * draws the faces the act swaps in (hidden), plays the act on its parts in the commit that drew
 * them, and lands by drawing the act's expression still in the same task as it cancels the
 * animations, so the last frame and the still drawing never flash between them. A new act stops
 * the one under way where it is.
 */
export function useActor<Expression extends string, ActName extends string>({
  acts,
  expression,
  handle,
  poses,
  svg,
}: {
  acts: Record<ActName, Act<Expression>>;
  expression: Expression;
  handle?: React.Ref<ActorHandle<ActName>>;
  poses?: PosesByExpression<Expression>;
  svg: React.RefObject<SVGSVGElement | null>;
}) {
  const [shown, setShown] = useState(expression);

  const [stage, setStage] = useState<{ run: number; swapFaces: readonly Expression[] }>({
    run: 0,
    swapFaces: [],
  });

  const current = useRef(expression);
  const runs = useRef(0);
  const queued = useRef<Queued<Expression> | null>(null);
  const running = useRef<Running>({ animations: [], run: 0 });

  // Starts the queued act in the commit that drew the faces it swaps in.
  useLayoutEffect(() => {
    const next = queued.current;
    const root = svg.current;

    if (!next || next.run !== stage.run || !root) {
      return;
    }

    queued.current = null;

    const playback = playAct({
      act: next.act,
      from: current.current,
      playbackRate: next.options.playbackRate,
      poses,
      root,
    });

    running.current = { animations: playback.animations, run: next.run };

    void playback.finished.then(() => {
      if (running.current.run !== next.run) {
        next.resolve();
        return;
      }

      const landing = next.act.to ?? current.current;
      current.current = landing;

      flushSync(() => {
        setShown(landing);
        setStage((drawn) => ({ ...drawn, swapFaces: [] }));
      });

      stopActing(running);
      next.resolve();
    });
  }, [poses, stage, svg]);

  const play = useCallback(
    (name: ActName, options: PlayOptions = {}) =>
      new Promise<void>((resolve) => {
        const act = acts[name];
        const run = runs.current + 1;
        runs.current = run;

        stopActing(running);
        queued.current?.resolve();
        queued.current = { act, options, resolve, run };
        setStage({ run, swapFaces: act.to && act.to !== current.current ? [act.to] : [] });
      }),
    [acts],
  );

  useImperativeHandle(handle, () => ({ play }), [play]);

  return { expression: shown, swapFaces: stage.swapFaces };
}
