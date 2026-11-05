import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { isDeviceCrash } from "./crash-reports.mts";

// Stops at the first alert that isn't a simulator or emulator crash: a Mac app's crash is for a
// person to read.

const ALERT_TITLE = /^(?<name>.+) quit unexpectedly\.$/u;
const MAX_ALERTS = 500;
const NEXT_ALERT_WAIT_MS = 1500;

function runAppleScript(script: string) {
  const result = spawnSync("osascript", ["-e", script], { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `osascript exited with status ${result.status ?? 1}.`);
  }

  return result.stdout.trim();
}

function getAlertProcessName() {
  const texts = runAppleScript(`
    tell application "System Events"
      if not (exists process "UserNotificationCenter") then return ""
      tell process "UserNotificationCenter"
        if (count of windows) is 0 then return ""
        set AppleScript's text item delimiters to linefeed
        return (value of static texts of window 1) as text
      end tell
    end tell`);

  return texts
    .split("\n")
    .map((text) => ALERT_TITLE.exec(text.trim())?.groups?.name)
    .find((name) => name !== undefined);
}

function ignoreAlert() {
  runAppleScript(`
    tell application "System Events" to tell process "UserNotificationCenter"
      click button "Ignore" of window 1
    end tell`);
}

async function waitForAlertProcessName() {
  const processName = getAlertProcessName();

  if (processName !== undefined) {
    return processName;
  }

  await sleep(NEXT_ALERT_WAIT_MS);
  return getAlertProcessName();
}

async function closeDeviceCrashAlerts() {
  let closed = 0;
  let processName = getAlertProcessName();

  while (processName !== undefined && closed < MAX_ALERTS) {
    if (!isDeviceCrash(processName)) {
      process.stdout.write(
        `Left the alert for ${processName} open: it isn't a simulator or emulator crash.\n`,
      );

      break;
    }

    ignoreAlert();
    closed += 1;
    // oxlint-disable-next-line no-await-in-loop -- each alert only appears after the previous one closes
    processName = await waitForAlertProcessName();
  }

  process.stdout.write(`Closed ${closed} device crash ${closed === 1 ? "alert" : "alerts"}.\n`);
}

try {
  await closeDeviceCrashAlerts();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
