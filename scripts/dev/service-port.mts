import { createServer } from "node:net";
import { RouteConflictError, RouteStore, parsePort } from "portless";

export const SERVICE_HOST = "127.0.0.1";
const PORT_ATTEMPTS = 5;

function listen(port: number) {
  return new Promise<ReturnType<typeof createServer>>((resolve, reject) => {
    const server = createServer((socket) => socket.destroy());
    server.once("error", reject);
    server.listen(port, SERVICE_HOST, () => resolve(server));
  });
}

/**
 * Portless probes for an unused port before registering it. Until the app binds, another checkout
 * can pick it too. Use its atomic route-name claim in a store shared by both proxy modes, where
 * the name identifies the port and the owner is the service launcher.
 */
export async function claimServicePort({
  fixedPort,
  stateDirectory,
}: {
  fixedPort?: string;
  stateDirectory: string;
}): Promise<{ port: number; release: () => void }> {
  const desiredPort = fixedPort ? parsePort(fixedPort) : 0;

  if (desiredPort === null) {
    throw new Error(`Invalid PORTLESS_APP_PORT="${fixedPort}". Must be 1–65535.`);
  }

  const store = new RouteStore(stateDirectory);
  store.ensureDir();

  for (let attempt = 0; attempt < PORT_ATTEMPTS; attempt += 1) {
    // oxlint-disable-next-line no-await-in-loop -- choose a new port if the previous one was claimed
    const server = await listen(desiredPort);
    const address = server.address();

    try {
      if (!address || typeof address === "string") {
        throw new Error("Could not determine the service port.");
      }

      const { port } = address;
      const claim = `port-${port}`;

      store.addRoute(claim, port, process.pid);

      return { port, release: () => store.removeRoute(claim, process.pid) };
    } catch (error) {
      if (!(error instanceof RouteConflictError)) {
        throw error;
      }

      if (desiredPort) {
        throw new Error(`Port ${desiredPort} is already reserved by another Zoonk service.`, {
          cause: error,
        });
      }
    } finally {
      server.close();
    }
  }

  throw new Error("Could not reserve a free port for the Zoonk service.");
}
