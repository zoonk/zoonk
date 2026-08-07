const DEFAULT_LOCAL_INBOX_PORT = 3202;
const MAX_PORT = 65_535;

/**
 * Gives the mailbox server and development mail transport one shared config.
 * Parallel agents can set MAILBOX_PORT without changing tracked files, while
 * invalid values fail immediately instead of splitting delivery and preview
 * across different ports.
 */
export function getLocalInboxConfig(): { port: number; url: string } {
  const port = getLocalInboxPort();

  return { port, url: `http://127.0.0.1:${port}/api/emails` };
}

/** Keeps environment parsing private because consumers need the complete shared mailbox config. */
function getLocalInboxPort(): number {
  const configuredPort = process.env.MAILBOX_PORT;

  if (!configuredPort) {
    return DEFAULT_LOCAL_INBOX_PORT;
  }

  const port = Number(configuredPort);

  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`MAILBOX_PORT must be an integer between 1 and ${MAX_PORT}.`);
  }

  return port;
}
