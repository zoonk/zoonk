import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

type Claim = {
  acquirable: boolean;
  blockedBy?: string;
  device: { id: string };
  owner?: { pid?: number; session?: string; workspace?: string };
};

function installedAgentDevice() {
  const directory = path.join(homedir(), ".t3", "tools", "agent-device");
  const binaries = globSync("*/node_modules/.bin/agent-device", { cwd: directory });

  const last = binaries.toSorted((first, second) =>
    second.localeCompare(first, "en", { numeric: true }),
  )[0];

  return last ? path.join(directory, last) : undefined;
}

let agentDevice = process.env.AGENT_DEVICE_BIN || "agent-device";

export function deviceClaims(): Map<string, string> {
  if (process.env.CI) {
    return new Map();
  }

  const args = ["device", "status", "--platform", "ios", "--json"];
  const options = { encoding: "utf8", timeout: 10_000 } as const;
  let result = spawnSync(agentDevice, args, options);

  if (
    result.error &&
    "code" in result.error &&
    result.error.code === "ENOENT" &&
    agentDevice === "agent-device"
  ) {
    const bundled = installedAgentDevice();

    if (!bundled) {
      return new Map();
    }

    agentDevice = bundled;
    result = spawnSync(agentDevice, args, options);
  }

  if (result.status !== 0) {
    throw new Error(
      "Could not check agent-device ownership. Run `agent-device device status --json` before using a simulator.",
    );
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The installed CLI owns this JSON response.
  const status = JSON.parse(result.stdout) as { success?: boolean; data?: { devices?: Claim[] } };

  if (!status.success || !Array.isArray(status.data?.devices)) {
    throw new Error("agent-device returned an unexpected device status.");
  }

  return new Map(
    status.data.devices
      .filter(({ acquirable }) => !acquirable)
      .map(({ blockedBy, device, owner }) => [
        device.id.toUpperCase(),
        ["agent-device", blockedBy, owner?.workspace, owner?.session, owner?.pid]
          .filter(Boolean)
          .join(" / "),
      ]),
  );
}

export function assertDeviceUnclaimed(udid: string) {
  const claim = deviceClaims().get(udid);

  if (claim) {
    throw new Error(`Simulator ${udid} is in use: ${claim}.`);
  }
}
