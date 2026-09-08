/* eslint-disable max-lines -- Keep this standalone developer workflow in one dependency-free script. */
import { type ChildProcess, type SpawnSyncReturns, spawn, spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";

type DeviceFamily = "phone" | "tablet";

type CliOptions = { avdName: string | undefined; family: DeviceFamily };

type CommandOptions = {
  arguments: readonly string[];
  command: string;
  environment: NodeJS.ProcessEnv;
  timeoutMs?: number;
  workingDirectory: string;
};

type AndroidToolchain = {
  adbPath: string;
  emulatorPath: string;
  environment: NodeJS.ProcessEnv;
  gradleWrapperPath: string;
};

type ConnectedEmulator = { serial: string };

type RunningEmulator = ConnectedEmulator & { avdName: string };

type EmulatorSelection = { avdName: string; serial: string | undefined };

const APP_COMPONENT = "com.zoonk.debug/com.zoonk.android.MainActivity";
const APK_FILE_NAME = "app-debug.apk";
const BOOT_TIMEOUT_MS = 180_000;
const COMMAND_TIMEOUT_MS = 10_000;
const EMULATOR_DISCOVERY_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 2000;

const FAMILY_TOKENS = {
  phone: ["phone", "pixel", "nexus_4", "nexus_5", "nexus_6", "handset", "mobile"],
  tablet: ["tablet", "pixel_c", "nexus_7", "nexus_9"],
} satisfies Record<DeviceFamily, readonly string[]>;

const androidDirectory = path.resolve(import.meta.dirname, "..");

const apkPath = path.join(
  androidDirectory,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  APK_FILE_NAME,
);

function executeCommand({
  arguments: commandArguments,
  command,
  environment,
  timeoutMs,
  workingDirectory,
}: CommandOptions): SpawnSyncReturns<string> {
  return spawnSync(command, [...commandArguments], {
    cwd: workingDirectory,
    encoding: "utf8",
    env: environment,
    stdio: "pipe",
    timeout: timeoutMs ?? 0,
  });
}

function getCommandLabel({
  arguments: commandArguments,
  command,
}: Pick<CommandOptions, "arguments" | "command">) {
  return [command, ...commandArguments].join(" ");
}

function getCommandOutput(result: SpawnSyncReturns<string>) {
  return [result.stderr, result.stdout]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .trim();
}

function getCommandError({
  options,
  result,
}: {
  options: CommandOptions;
  result: SpawnSyncReturns<string>;
}) {
  const commandLabel = getCommandLabel(options);

  if (result.error) {
    return new Error(`Failed to run ${commandLabel}: ${result.error.message}`);
  }

  const output = getCommandOutput(result);
  const details = output ? `\n${output}` : "";
  return new Error(`${commandLabel} exited with status ${result.status ?? 1}.${details}`);
}

function readCommand(options: CommandOptions) {
  const result = executeCommand(options);

  if (result.error || result.status !== 0) {
    throw getCommandError({ options, result });
  }

  return result.stdout.trim();
}

function tryReadCommand(options: CommandOptions) {
  const result = executeCommand(options);

  if (result.error || result.status !== 0) {
    return;
  }

  return result.stdout.trim();
}

function runCommand(options: CommandOptions) {
  const result = spawnSync(options.command, [...options.arguments], {
    cwd: options.workingDirectory,
    encoding: "utf8",
    env: options.environment,
    stdio: "inherit",
  });

  if (result.error || result.status !== 0) {
    throw getCommandError({ options, result });
  }
}

function getDeviceFamily(value: string | undefined): DeviceFamily {
  if (value === "phone" || value === "tablet") {
    return value;
  }

  throw new Error("Usage: run-emulator.mts <phone|tablet> [exact-avd-name]");
}

function parseCliOptions(arguments_: readonly string[]): CliOptions {
  const normalizedArguments =
    arguments_[1] === "--" ? [arguments_[0], ...arguments_.slice(2)] : arguments_;

  if (normalizedArguments.length === 0 || normalizedArguments.length > 2) {
    throw new Error("Usage: run-emulator.mts <phone|tablet> [exact-avd-name]");
  }

  const avdName = normalizedArguments[1]?.trim();

  if (normalizedArguments.length === 2 && !avdName) {
    throw new Error("The optional AVD name cannot be empty.");
  }

  return { avdName, family: getDeviceFamily(normalizedArguments[0]) };
}

function getAndroidSdkDirectory() {
  const androidHome = process.env.ANDROID_HOME?.trim();

  if (androidHome) {
    return path.resolve(androidHome);
  }

  const androidSdkRoot = process.env.ANDROID_SDK_ROOT?.trim();

  if (androidSdkRoot) {
    return path.resolve(androidSdkRoot);
  }

  if (platform() === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA?.trim() || path.join(homedir(), "AppData", "Local");

    return path.join(localAppData, "Android", "Sdk");
  }

  return platform() === "darwin"
    ? path.join(homedir(), "Library", "Android", "sdk")
    : path.join(homedir(), "Android", "Sdk");
}

function assertExecutable({
  filePath,
  hint,
  label,
}: {
  filePath: string;
  hint: string;
  label: string;
}) {
  try {
    accessSync(filePath, constants.F_OK);
    accessSync(filePath, constants.X_OK);
  } catch {
    throw new Error(`${label} was not found or is not executable at ${filePath}. ${hint}`);
  }
}

function assertReadableFile({ filePath, label }: { filePath: string; label: string }) {
  try {
    accessSync(filePath, constants.F_OK);
    accessSync(filePath, constants.R_OK);
  } catch {
    throw new Error(
      `${label} was not found at ${filePath}. The Android build may not have completed.`,
    );
  }
}

function getAndroidToolchain(): AndroidToolchain {
  const sdkDirectory = getAndroidSdkDirectory();
  const isWindows = platform() === "win32";
  const adbPath = path.join(sdkDirectory, "platform-tools", isWindows ? "adb.exe" : "adb");
  const emulatorPath = path.join(sdkDirectory, "emulator", isWindows ? "emulator.exe" : "emulator");
  const gradleWrapperPath = path.join(androidDirectory, isWindows ? "gradlew.bat" : "gradlew");

  const sdkHint =
    "Install the required Android SDK tools or correct ANDROID_HOME/ANDROID_SDK_ROOT.";

  assertExecutable({ filePath: adbPath, hint: sdkHint, label: "adb" });
  assertExecutable({ filePath: emulatorPath, hint: sdkHint, label: "Android Emulator" });

  assertExecutable({
    filePath: gradleWrapperPath,
    hint: isWindows
      ? "Restore apps/android/gradlew.bat."
      : "Restore apps/android/gradlew and make it executable with chmod +x.",
    label: "Gradle wrapper",
  });

  return {
    adbPath,
    emulatorPath,
    environment: { ...process.env, ANDROID_HOME: sdkDirectory, ANDROID_SDK_ROOT: sdkDirectory },
    gradleWrapperPath,
  };
}

function listInstalledAvds({
  emulatorPath,
  environment,
}: Pick<AndroidToolchain, "emulatorPath" | "environment">) {
  const output = readCommand({
    arguments: ["-list-avds"],
    command: emulatorPath,
    environment,
    workingDirectory: androidDirectory,
  });

  const avdNames = output
    .split(/\r?\n/u)
    .map((avdName) => avdName.trim())
    .filter(Boolean)
    .toSorted((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  if (avdNames.length === 0) {
    throw new Error(
      "No Android Virtual Devices are installed. Create a phone or tablet AVD in Android Studio's Device Manager, then try again.",
    );
  }

  return avdNames;
}

function normalizeAvdName(avdName: string) {
  return avdName.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "_");
}

function matchesFamily({ avdName, family }: { avdName: string; family: DeviceFamily }) {
  const normalizedName = normalizeAvdName(avdName);
  const isTablet = FAMILY_TOKENS.tablet.some((token) => normalizedName.includes(token));

  if (family === "tablet") {
    return isTablet;
  }

  return !isTablet && FAMILY_TOKENS.phone.some((token) => normalizedName.includes(token));
}

function parseConnectedEmulator(line: string): ConnectedEmulator[] {
  const [serial] = line.trim().split(/\s+/u);
  return serial?.startsWith("emulator-") ? [{ serial }] : [];
}

function listConnectedEmulators({
  adbPath,
  environment,
}: Pick<AndroidToolchain, "adbPath" | "environment">) {
  const output = readCommand({
    arguments: ["devices"],
    command: adbPath,
    environment,
    timeoutMs: COMMAND_TIMEOUT_MS,
    workingDirectory: androidDirectory,
  });

  return output.split(/\r?\n/u).flatMap((line) => parseConnectedEmulator(line));
}

function getRunningAvdName({
  adbPath,
  environment,
  serial,
}: Pick<AndroidToolchain, "adbPath" | "environment"> & ConnectedEmulator) {
  const output = tryReadCommand({
    arguments: ["-s", serial, "emu", "avd", "name"],
    command: adbPath,
    environment,
    timeoutMs: COMMAND_TIMEOUT_MS,
    workingDirectory: androidDirectory,
  });

  return output
    ?.split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line !== "OK" && !line.startsWith("KO:"));
}

function getRunningEmulator({
  adbPath,
  emulator,
  environment,
}: Pick<AndroidToolchain, "adbPath" | "environment"> & {
  emulator: ConnectedEmulator;
}): RunningEmulator[] {
  const avdName = getRunningAvdName({ adbPath, environment, serial: emulator.serial });
  return avdName ? [{ avdName, serial: emulator.serial }] : [];
}

function listRunningEmulators({
  adbPath,
  environment,
}: Pick<AndroidToolchain, "adbPath" | "environment">) {
  return listConnectedEmulators({ adbPath, environment }).flatMap((emulator) =>
    getRunningEmulator({ adbPath, emulator, environment }),
  );
}

function getAvdCandidates({
  avdName,
  family,
  installedAvds,
}: CliOptions & { installedAvds: readonly string[] }) {
  if (avdName) {
    if (installedAvds.includes(avdName)) {
      return [avdName];
    }

    throw new Error(
      `AVD "${avdName}" is not installed. Installed AVDs: ${installedAvds.join(", ")}.`,
    );
  }

  const candidates = installedAvds.filter((installedAvd) =>
    matchesFamily({ avdName: installedAvd, family }),
  );

  if (candidates.length === 0) {
    throw new Error(
      `No installed ${family} AVD matched the expected tokens (${FAMILY_TOKENS[family].join(", ")}). Installed AVDs: ${installedAvds.join(", ")}. Pass an exact AVD name as the second argument to use a custom name.`,
    );
  }

  return candidates;
}

function selectEmulator({
  avdName,
  family,
  installedAvds,
  runningEmulators,
}: CliOptions & {
  installedAvds: readonly string[];
  runningEmulators: readonly RunningEmulator[];
}): EmulatorSelection {
  const candidates = getAvdCandidates({ avdName, family, installedAvds });

  const runningEmulator = runningEmulators.find((emulator) =>
    candidates.includes(emulator.avdName),
  );

  const selectedAvdName = runningEmulator?.avdName ?? candidates[0];

  if (!selectedAvdName) {
    throw new Error(`No installed ${family} AVD is available.`);
  }

  return { avdName: selectedAvdName, serial: runningEmulator?.serial };
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function startEmulator({
  avdName,
  emulatorPath,
  environment,
}: Pick<AndroidToolchain, "emulatorPath" | "environment"> & { avdName: string }) {
  return new Promise<ChildProcess>((resolve, reject) => {
    const emulatorProcess = spawn(emulatorPath, ["-avd", avdName], {
      cwd: androidDirectory,
      detached: true,
      env: environment,
      stdio: "ignore",
    });

    emulatorProcess.once("error", (error) => {
      reject(new Error(`Failed to start AVD "${avdName}": ${error.message}`));
    });

    emulatorProcess.once("spawn", () => {
      emulatorProcess.unref();
      resolve(emulatorProcess);
    });
  });
}

function getEmulatorExitDetails(emulatorProcess: ChildProcess) {
  if (emulatorProcess.exitCode !== null) {
    return `status ${emulatorProcess.exitCode}`;
  }

  return emulatorProcess.signalCode ? `signal ${emulatorProcess.signalCode}` : "an unknown error";
}

async function waitForEmulatorSerial({
  adbPath,
  avdName,
  emulatorProcess,
  environment,
}: Pick<AndroidToolchain, "adbPath" | "environment"> & {
  avdName: string;
  emulatorProcess: ChildProcess;
}) {
  const deadline = Date.now() + EMULATOR_DISCOVERY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const runningEmulator = listRunningEmulators({ adbPath, environment }).find(
      (emulator) => emulator.avdName === avdName,
    );

    if (runningEmulator) {
      return runningEmulator.serial;
    }

    if (emulatorProcess.exitCode !== null || emulatorProcess.signalCode) {
      throw new Error(
        `Android Emulator exited with ${getEmulatorExitDetails(emulatorProcess)} while starting AVD "${avdName}". Open Android Studio's Device Manager to verify that the AVD can start.`,
      );
    }

    // eslint-disable-next-line no-await-in-loop -- Emulator discovery must poll sequentially.
    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Timed out after ${EMULATOR_DISCOVERY_TIMEOUT_MS / 1000} seconds waiting for AVD "${avdName}" to appear in adb.`,
  );
}

async function getOrStartEmulator({
  adbPath,
  emulatorPath,
  environment,
  selection,
}: Pick<AndroidToolchain, "adbPath" | "emulatorPath" | "environment"> & {
  selection: EmulatorSelection;
}) {
  if (selection.serial) {
    process.stdout.write(`Reusing ${selection.avdName} (${selection.serial}).\n`);
    return selection.serial;
  }

  process.stdout.write(`Starting ${selection.avdName}...\n`);

  const emulatorProcess = await startEmulator({
    avdName: selection.avdName,
    emulatorPath,
    environment,
  });

  return waitForEmulatorSerial({
    adbPath,
    avdName: selection.avdName,
    emulatorProcess,
    environment,
  });
}

async function waitForBoot({
  adbPath,
  avdName,
  environment,
  serial,
}: Pick<AndroidToolchain, "adbPath" | "environment"> & RunningEmulator) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const deviceState = tryReadCommand({
      arguments: ["-s", serial, "get-state"],
      command: adbPath,
      environment,
      timeoutMs: COMMAND_TIMEOUT_MS,
      workingDirectory: androidDirectory,
    });

    const bootCompleted = tryReadCommand({
      arguments: ["-s", serial, "shell", "getprop", "sys.boot_completed"],
      command: adbPath,
      environment,
      timeoutMs: COMMAND_TIMEOUT_MS,
      workingDirectory: androidDirectory,
    });

    if (deviceState === "device" && bootCompleted === "1") {
      return;
    }

    // eslint-disable-next-line no-await-in-loop -- Boot completion must poll sequentially.
    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Timed out after ${BOOT_TIMEOUT_MS / 1000} seconds waiting for AVD "${avdName}" (${serial}) to finish booting.`,
  );
}

function buildApp({ environment, gradleWrapperPath }: AndroidToolchain) {
  process.stdout.write("Building the Android debug APK...\n");

  const isWindows = platform() === "win32";

  /** A fixed, relative batch command avoids shell interpolation of workspace paths with spaces. */
  runCommand({
    arguments: isWindows
      ? ["/d", "/s", "/c", String.raw`.\gradlew.bat :app:assembleDebug`]
      : [":app:assembleDebug"],
    command: isWindows ? (environment.ComSpec ?? "cmd.exe") : gradleWrapperPath,
    environment,
    workingDirectory: androidDirectory,
  });

  assertReadableFile({ filePath: apkPath, label: "Debug APK" });
}

function installAndLaunchApp({
  adbPath,
  environment,
  serial,
}: Pick<AndroidToolchain, "adbPath" | "environment"> & ConnectedEmulator) {
  process.stdout.write(`Installing ${APK_FILE_NAME} on ${serial}...\n`);

  runCommand({
    arguments: ["-s", serial, "install", "-r", apkPath],
    command: adbPath,
    environment,
    workingDirectory: androidDirectory,
  });

  runCommand({
    arguments: ["-s", serial, "shell", "am", "start", "-n", APP_COMPONENT],
    command: adbPath,
    environment,
    workingDirectory: androidDirectory,
  });
}

async function runAndroidApp(options: CliOptions) {
  const toolchain = getAndroidToolchain();
  const installedAvds = listInstalledAvds(toolchain);
  const runningEmulators = listRunningEmulators(toolchain);
  const selection = selectEmulator({ ...options, installedAvds, runningEmulators });
  const serial = await getOrStartEmulator({ ...toolchain, selection });

  process.stdout.write(`Waiting for ${selection.avdName} to finish booting...\n`);

  await waitForBoot({
    adbPath: toolchain.adbPath,
    avdName: selection.avdName,
    environment: toolchain.environment,
    serial,
  });

  buildApp(toolchain);
  installAndLaunchApp({ adbPath: toolchain.adbPath, environment: toolchain.environment, serial });
  process.stdout.write(`Zoonk is running on ${selection.avdName} (${serial}).\n`);
}

try {
  await runAndroidApp(parseCliOptions(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
