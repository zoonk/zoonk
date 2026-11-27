import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { claimServicePort } from "./service-port.mts";

test("a service in another checkout cannot take a port before its owner starts listening", async () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "dev-port-claim-"));

  const owner = spawn(
    process.execPath,
    [
      "--eval",
      `import { claimServicePort } from "${import.meta.resolve("./service-port.mts")}";
      const { port } = await claimServicePort({ stateDirectory: process.argv[1] });
      process.stdout.write(String(port));
      process.stdin.resume();`,
      stateDirectory,
    ],
    { stdio: ["pipe", "pipe", "inherit"] },
  );

  const exit = once(owner, "exit");

  try {
    const fixedPort = await Promise.race([
      new Promise<string>((resolve) => {
        owner.stdout.once("data", (chunk: Buffer) => resolve(chunk.toString("utf8")));
      }),
      exit.then(() => {
        throw new Error("The other service exited before reserving its port.");
      }),
    ]);

    await expect(claimServicePort({ fixedPort, stateDirectory })).rejects.toThrow(
      `Port ${fixedPort} is already reserved`,
    );

    owner.kill("SIGKILL");
    await exit;

    const claim = await claimServicePort({ fixedPort, stateDirectory });
    expect(claim.port).toBe(Number(fixedPort));
    claim.release();
  } finally {
    owner.kill("SIGKILL");
    await exit;
    rmSync(stateDirectory, { force: true, recursive: true });
  }
});
