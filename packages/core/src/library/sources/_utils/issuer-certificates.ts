import { X509Certificate } from "node:crypto";
import { type LookupFunction } from "node:net";
import { connect, getCACertificates } from "node:tls";
import { requestWithNode } from "./node-request";
import { isPublicUrl } from "./public-url";
import { readLimitedBody } from "./read-limited-body";

/** What Node reports when a server's certificate arrives without the one that issued it. */
const MISSING_ISSUER_CODE = "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
const CA_ISSUERS_PREFIX = "CA Issuers - URI:";
const HTTPS_PORT = 443;
const WEB_URL_PATTERN = /^https?:/iu;
const ISSUER_TIMEOUT_MS = 10_000;
/** An intermediate certificate takes 1 to 2 KB; anything this large isn't one. */
const MAX_ISSUER_BYTES = 32_768;
/** Far more certificate authorities than research meets, so the cache never grows unbounded. */
const MAX_CACHED_ISSUERS = 50;

/** Issuers by the address a server's certificate names, so each one downloads once per process. */
const issuersByUrl = new Map<string, X509Certificate>();

type ChainRequest = {
  headers: Record<string, string>;
  /** Resolves host names; tests point public names at a local server. */
  lookup?: LookupFunction;
  signal: AbortSignal;
  url: string;
};

function errorCode(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

/**
 * Some servers send only their own certificate and leave out the intermediate that issued it,
 * which browsers download on their own. Node reports it as this one error, which fetch wraps as
 * the cause of its generic "fetch failed".
 */
export function isMissingIssuerError(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;

  return errorCode(error) === MISSING_ISSUER_CODE || errorCode(cause) === MISSING_ISSUER_CODE;
}

/**
 * Reads the certificate a server presents without trusting it, only to learn where its issuer is
 * published. Nothing is sent on this connection and it closes as soon as the certificate arrives,
 * since nothing about the server was verified.
 */
function readServerCertificate({
  lookup,
  url,
}: {
  lookup?: LookupFunction;
  url: URL;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const socket = connect({
      host: url.hostname,
      lookup,
      port: Number(url.port || HTTPS_PORT),
      rejectUnauthorized: false,
      servername: url.hostname,
      timeout: ISSUER_TIMEOUT_MS,
    });

    socket.once("secureConnect", () => {
      const { raw } = socket.getPeerCertificate();
      socket.destroy();
      resolve(raw);
    });

    socket.once("timeout", () => {
      socket.destroy(new Error(`Timed out reading the certificate of ${url.hostname}`));
    });

    socket.on("error", reject);
  });
}

/** Node writes a value holding a separator as a JSON string, so it can't pass for two values. */
function readInfoAccessValue(value: string): string {
  return value.startsWith('"') ? String(JSON.parse(value)) : value;
}

/** The web address where a certificate's issuer is published (its AIA "CA Issuers" entry). */
function getIssuerUrl(certificate: X509Certificate): string | undefined {
  return (certificate.infoAccess ?? "")
    .split("\n")
    .filter((line) => line.startsWith(CA_ISSUERS_PREFIX))
    .map((line) => readInfoAccessValue(line.slice(CA_ISSUERS_PREFIX.length)))
    .find((value) => WEB_URL_PATTERN.test(value));
}

function parseCertificate({ bytes, url }: { bytes: Uint8Array; url: string }): X509Certificate {
  try {
    return new X509Certificate(bytes);
  } catch (error) {
    throw new Error(`The file at ${url} isn't a certificate.`, { cause: error });
  }
}

/** Takes DER or PEM, the two ways certificate authorities publish their certificates. */
async function downloadCertificate({
  headers,
  lookup,
  url,
}: {
  headers: Record<string, string>;
  lookup?: LookupFunction;
  url: string;
}): Promise<X509Certificate> {
  const signal = AbortSignal.timeout(ISSUER_TIMEOUT_MS);
  const response = await requestWithNode({ headers, lookup, signal, url });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Downloading the certificate at ${url} failed with status ${response.status}`);
  }

  const bytes = await readLimitedBody({ maxBytes: MAX_ISSUER_BYTES, response });

  return parseCertificate({ bytes, url });
}

function isIssuerOf({ issuer, leaf }: { issuer: X509Certificate; leaf: X509Certificate }): boolean {
  return issuer.ca && leaf.checkIssued(issuer) && leaf.verify(issuer.publicKey);
}

function rememberIssuer({ issuer, url }: { issuer: X509Certificate; url: string }) {
  issuersByUrl.delete(url);
  issuersByUrl.set(url, issuer);

  const [oldest] = issuersByUrl.keys();

  if (issuersByUrl.size > MAX_CACHED_ISSUERS && oldest) {
    issuersByUrl.delete(oldest);
  }
}

/**
 * The certificate authority that issued a server's certificate, downloaded from the address that
 * certificate names. A remote server picks that address, so it gets the public-address rule every
 * fetch gets, no redirects, and size and time limits, and the download is only used when it is a
 * certificate authority that really signed the server's certificate.
 */
async function findIssuer({
  headers,
  hostname,
  leaf,
  lookup,
}: {
  headers: Record<string, string>;
  hostname: string;
  leaf: X509Certificate;
  lookup?: LookupFunction;
}): Promise<X509Certificate> {
  const url = getIssuerUrl(leaf);

  if (!url) {
    throw new Error(`The certificate of ${hostname} doesn't say where its issuer is published.`);
  }

  if (!URL.canParse(url) || !isPublicUrl(new URL(url))) {
    throw new Error(`Refusing to fetch a certificate from a non-public address: ${url}`);
  }

  const cached = issuersByUrl.get(url);

  if (cached && isIssuerOf({ issuer: cached, leaf })) {
    return cached;
  }

  const issuer = await downloadCertificate({ headers, lookup, url });

  if (!isIssuerOf({ issuer, leaf })) {
    throw new Error(`The certificate at ${url} isn't the authority that issued ${hostname}'s.`);
  }

  rememberIssuer({ issuer, url });

  return issuer;
}

/**
 * Retries a request whose server left out its intermediate certificate, trusting Node's default
 * authorities plus that intermediate. The chain is still verified up to a trusted root and the
 * host name still checked: the intermediate only fills the gap a browser fills on its own.
 */
export async function fetchCompletingChain({
  headers,
  lookup,
  signal,
  url,
}: ChainRequest): Promise<Response> {
  const target = new URL(url);
  const leaf = new X509Certificate(await readServerCertificate({ lookup, url: target }));
  const issuer = await findIssuer({ headers, hostname: target.hostname, leaf, lookup });
  const ca = [...getCACertificates("default"), issuer.toString()];

  return requestWithNode({ ca, headers, lookup, signal, url });
}
