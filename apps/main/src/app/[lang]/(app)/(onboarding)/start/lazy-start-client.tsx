"use client";

import { createSharedImport } from "@/lib/shared-import";
import dynamic from "next/dynamic";
import { type StartClient } from "./start-client";

/** One load of the start form per tab, so one the frame starts early is the one Today uses. */
const importStart = createSharedImport<{ StartClient: typeof StartClient }>();

/**
 * The start form for a page that shows it only sometimes (Today without a goal): its code, the
 * whole onboarding entry, loads only when it's shown, so a learner with a goal never downloads it.
 * It still renders on the server, so the first paint is the same.
 */
export const LazyStartClient = dynamic(() =>
  importStart(() => import("./start-client")).then((mod) => mod.StartClient),
);
