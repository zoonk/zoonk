"use client";

import { createSharedImport } from "@/lib/shared-import";
import dynamic from "next/dynamic";
import { type StartClient } from "./start-client";

const importStart = createSharedImport<{ StartClient: typeof StartClient }>();

/** Loads only when shown, so a learner with a goal never downloads it; it still renders on the server. */
export const LazyStartClient = dynamic(() =>
  importStart(() => import("./start-client")).then((mod) => mod.StartClient),
);
