import { CONSOLE_VALUE_SOURCE } from "./console-values";

/**
 * Inside QuickJS, before the program: `console` and timers like the browser worker's, with
 * timers on a virtual clock so a run never waits, and the probes a traced program calls. Only
 * `__zoonkEmit` reaches the host, and it only records text.
 */
export const JAVASCRIPT_PRELUDE = `"use strict";
${CONSOLE_VALUE_SOURCE}
const __zoonkTimers = [];
const __zoonkClock = { now: 0, order: 0, nextId: 1 };

function __zoonkJson(key, value) {
  if (typeof value !== "number" || (Number.isFinite(value) && !Object.is(value, -0))) return value;
  return { $zoonk: "text", text: Object.is(value, -0) ? "-0" : String(value) };
}

function __zoonkLog(stream, args) {
  __zoonkEmit("log", JSON.stringify([stream, args.map((arg) => toCloneable(arg, 0, []))], __zoonkJson));
}

globalThis.__zoonkFail = (error) => {
  const match = /main\\.js:(\\d+)/.exec(String(error && error.stack));
  const message = error instanceof Error ? error.name + ": " + error.message : "Uncaught " + String(error);
  __zoonkEmit("error", JSON.stringify({ line: match ? Number(match[1]) : null, message }));
};

globalThis.console = {
  debug: (...args) => __zoonkLog("stdout", args),
  error: (...args) => __zoonkLog("stderr", args),
  info: (...args) => __zoonkLog("stdout", args),
  log: (...args) => __zoonkLog("stdout", args),
  table: (...args) => __zoonkLog("stdout", args),
  warn: (...args) => __zoonkLog("stderr", args),
};

function __zoonkSchedule(callback, delay, args, every) {
  const id = __zoonkClock.nextId++;
  const wait = Math.max(0, Number(delay) || 0);
  __zoonkTimers.push({ args, at: __zoonkClock.now + wait, callback, every, id, order: __zoonkClock.order++ });
  return id;
}

globalThis.setTimeout = (callback, delay, ...args) => __zoonkSchedule(callback, delay, args, null);
globalThis.setInterval = (callback, delay, ...args) => __zoonkSchedule(callback, delay, args, Math.max(1, Number(delay) || 0));
globalThis.clearTimeout = globalThis.clearInterval = (id) => {
  const index = __zoonkTimers.findIndex((timer) => timer.id === id);
  if (index >= 0) __zoonkTimers.splice(index, 1);
};

globalThis.__zoonkNextTimer = () => {
  if (__zoonkTimers.length === 0) return false;
  const timer = __zoonkTimers.reduce((first, other) => (other.at < first.at || (other.at === first.at && other.order < first.order) ? other : first));
  __zoonkClock.now = timer.at;
  if (timer.every === null) {
    __zoonkTimers.splice(__zoonkTimers.indexOf(timer), 1);
  } else {
    timer.at += timer.every;
    timer.order = __zoonkClock.order++;
  }
  try {
    if (typeof timer.callback === "function") timer.callback(...timer.args);
  } catch (error) {
    __zoonkFail(error);
  }
  return true;
};

function __zoonkTraced(value) {
  if (typeof value === "boolean" || typeof value === "string") return [typeof value, value];
  if (typeof value === "number") return Number.isFinite(value) && !Object.is(value, -0) ? ["number", value] : ["text", Object.is(value, -0) ? "-0" : String(value)];
  if (value === undefined || value === null) return ["text", String(value)];
  return ["value", toCloneable(value, 0, [])];
}

globalThis.__zoonkRead = (get) => {
  try {
    return __zoonkTraced(get());
  } catch {
    return null;
  }
};

globalThis.__zoonkStep = (line, read) => {
  __zoonkEmit("step", JSON.stringify([line, read()], __zoonkJson));
};

globalThis.__zoonkTest = (line, value, read) => {
  __zoonkStep(line, read);
  return value;
};
`;
