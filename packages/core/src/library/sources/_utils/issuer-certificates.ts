import { X509Certificate } from "node:crypto";
import { type LookupFunction } from "node:net";
import { connect, getCACertificates } from "node:tls";
import { Agent, type Response, fetch } from "undici";
import { isPublicUrl, publicLookup } from "./public-url";
import { readLimitedBody } from "./read-limited-body";

const MISSING_ISSUER_CODE = "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
const CA_ISSUERS_PREFIX = "CA Issuers - URI:";
const HTTPS_PORT = 443;
const WEB_URL_PATTERN = /^https?:/iu;
const ISSUER_TIMEOUT_MS = 10_000;
const MAX_ISSUER_BYTES = 32_768;

type ChainRequest = {
  headers: Record<string, string>;
  lookup?: LookupFunction;
  signal: AbortSignal;
  url: string;
};

function errorCode(error: unknown): unknown {
  return error instanceof Error && "code" in error ? error.code : undefined;
}

export function isMissingIssuerError(error: unknown): boolean {
  return errorCode(error instanceof Error ? error.cause : undefined) === MISSING_ISSUER_CODE;
}

/** This unverified connection must send no application data; it only discovers the issuer certificate. */
function readServerCertificate({
  lookup,
  url,
}: {
  lookup: LookupFunction;
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

async function downloadCertificate({
  headers,
  lookup,
  url,
}: {
  headers: Record<string, string>;
  lookup: LookupFunction;
  url: string;
}): Promise<X509Certificate> {
  const response = await fetch(url, {
    dispatcher: new Agent({ connect: { lookup } }),
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(ISSUER_TIMEOUT_MS),
  });

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

/** The server controls the issuer URL, so downloads require public-address, redirect, size and time restrictions. */
async function findIssuer({
  headers,
  hostname,
  leaf,
  lookup,
}: {
  headers: Record<string, string>;
  hostname: string;
  leaf: X509Certificate;
  lookup: LookupFunction;
}): Promise<X509Certificate> {
  const url = getIssuerUrl(leaf);

  if (!url) {
    throw new Error(`The certificate of ${hostname} doesn't say where its issuer is published.`);
  }

  if (!URL.canParse(url) || !isPublicUrl(new URL(url))) {
    throw new Error(`Refusing to fetch a certificate from a non-public address: ${url}`);
  }

  const issuer = await downloadCertificate({ headers, lookup, url });

  if (!isIssuerOf({ issuer, leaf })) {
    throw new Error(`The certificate at ${url} isn't the authority that issued ${hostname}'s.`);
  }

  return issuer;
}

/** Adds only the missing intermediate; root trust and hostname verification remain required. */
export async function fetchCompletingChain({
  headers,
  lookup = publicLookup,
  signal,
  url,
}: ChainRequest): Promise<Response> {
  const target = new URL(url);
  const leaf = new X509Certificate(await readServerCertificate({ lookup, url: target }));
  const issuer = await findIssuer({ headers, hostname: target.hostname, leaf, lookup });
  const ca = [...getCACertificates("default"), issuer.toString()];

  return fetch(url, {
    dispatcher: new Agent({ connect: { ca, lookup } }),
    headers,
    redirect: "manual",
    signal,
  });
}
