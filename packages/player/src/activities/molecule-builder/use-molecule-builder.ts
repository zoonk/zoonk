"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { useState } from "react";
import {
  LAYOUT_SIZE,
  type Layout,
  layoutBuild,
  placeNewAtom,
  relaxLayout,
} from "./molecule-layout";
import {
  type Build,
  EMPTY_BUILD,
  addAtom,
  bondOrder,
  removeAtom,
  stepBond,
} from "./molecule-model";

type BuilderState = { build: Build; layout: Layout; selectedId: string | null };

/** What changed, so the canvas can announce it. */
export type BuilderChange =
  | { atom: string; bondTo: string | null; kind: "added" }
  | { first: string; kind: "bonded"; order: number; second: string }
  | { atom: string; kind: "removed" }
  | { kind: "selected" | "undone"; atom: string | null };

function settle(build: Build, layout: Layout): Layout {
  return relaxLayout({ bonds: build.bonds, layout, size: LAYOUT_SIZE });
}

function initialState(answer: ActivityAnswer | null): BuilderState {
  if (answer?.kind !== "molecule") {
    return { build: EMPTY_BUILD, layout: {}, selectedId: null };
  }

  const build = { atoms: answer.atoms, bonds: answer.bonds };
  return { build, layout: layoutBuild(build), selectedId: null };
}

/**
 * The build and its drawing, with undo. Adding with an atom selected bonds the new atom to it;
 * pressing a second atom steps the bond between them; every change settles the drawing again.
 */
export function useMoleculeBuilder({
  answer,
  onBuildChange,
}: {
  answer: ActivityAnswer | null;
  onBuildChange: (change: { next: Build; previous: Build; what: BuilderChange }) => void;
}) {
  const [state, setState] = useState(() => initialState(answer));
  const [history, setHistory] = useState<BuilderState[]>([]);

  function commit(next: BuilderState, change: BuilderChange) {
    setHistory([...history, state]);
    setState(next);
    onBuildChange({ next: next.build, previous: state.build, what: change });
  }

  function add(element: string) {
    const { build, id } = addAtom({ bondTo: state.selectedId, build: state.build, element });

    const position = placeNewAtom({
      anchor: state.selectedId,
      layout: state.layout,
      size: LAYOUT_SIZE,
    });

    commit(
      {
        build,
        layout: settle(build, { ...state.layout, [id]: position }),
        selectedId: state.selectedId ?? id,
      },
      { atom: id, bondTo: state.selectedId, kind: "added" },
    );
  }

  function press(id: string) {
    const { selectedId } = state;

    if (selectedId === null || selectedId === id) {
      const next = selectedId === id ? null : id;
      setState({ ...state, selectedId: next });

      onBuildChange({
        next: state.build,
        previous: state.build,
        what: { atom: next, kind: "selected" },
      });

      return;
    }

    const build = stepBond(state.build, selectedId, id);
    const order = bondOrder(build, selectedId, id);

    commit(
      { build, layout: settle(build, state.layout), selectedId },
      { first: selectedId, kind: "bonded", order, second: id },
    );
  }

  function remove() {
    const { selectedId } = state;

    if (selectedId === null) {
      return;
    }

    const build = removeAtom(state.build, selectedId);

    commit(
      { build, layout: settle(build, state.layout), selectedId: null },
      { atom: selectedId, kind: "removed" },
    );
  }

  function undo() {
    const previous = history.at(-1);

    if (!previous) {
      return;
    }

    setHistory(history.slice(0, -1));
    setState(previous);

    onBuildChange({
      next: previous.build,
      previous: state.build,
      what: { atom: null, kind: "undone" },
    });
  }

  return { add, canUndo: history.length > 0, press, remove, state, undo };
}
