const MCP_DATA_PREFIX = "data: ";

function isCompileFailure(message: unknown) {
  return (
    typeof message !== "object" ||
    message === null ||
    "error" in message ||
    !("result" in message) ||
    typeof message.result !== "object" ||
    message.result === null ||
    ("isError" in message.result && message.result.isError === true)
  );
}

/** Every route needs its own successful answer; a missing or failed one names the route. */
export function findCompileFailures({ body, routes }: { body: string; routes: readonly string[] }) {
  const messages = body
    .split("\n")
    .filter((line) => line.startsWith(MCP_DATA_PREFIX))
    .map((line): unknown => JSON.parse(line.slice(MCP_DATA_PREFIX.length)));

  return routes.flatMap((route, index) => {
    const message = messages.find(
      (candidate) =>
        typeof candidate === "object" &&
        candidate !== null &&
        "id" in candidate &&
        candidate.id === index,
    );

    if (message === undefined) {
      return [`${route}: no compile_route answer`];
    }

    return isCompileFailure(message) ? [`${route}: ${JSON.stringify(message)}`] : [];
  });
}

/**
 * First visits must stay serial because Next 16.4 read/modifies/writes the dev prerender manifest
 * while rendering, but compiling never touches it. The dev server's own `compile_route` MCP tool
 * builds every route concurrently, so the serial crawl only renders and validates. One JSON-RPC
 * batch keeps all calls on one MCP transport: the server shares one connection across requests.
 */
export async function compileDevRoutes({
  baseURL,
  routes,
}: {
  baseURL: string;
  routes: readonly string[];
}) {
  const response = await fetch(new URL("/_next/mcp", baseURL), {
    body: JSON.stringify(
      routes.map((routeSpecifier, id) => ({
        id,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: { routeSpecifier }, name: "compile_route" },
      })),
    ),
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
    method: "POST",
  });

  const body = await response.text();

  const failures = response.ok
    ? findCompileFailures({ body, routes })
    : [`HTTP ${response.status}`];

  if (failures.length > 0) {
    throw new Error(`Next dev route compilation failed:\n${failures.join("\n")}`);
  }
}
