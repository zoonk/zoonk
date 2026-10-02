import {
  type KeyObject,
  X509Certificate,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomInt,
  sign,
} from "node:crypto";
import { type Server as HttpServer, createServer as createHttpServer } from "node:http";
import { type Server as HttpsServer, createServer as createHttpsServer } from "node:https";
import { type AddressInfo, type LookupFunction } from "node:net";
import {
  type SecureContext,
  createSecureContext,
  getCACertificates,
  setDefaultCACertificates,
} from "node:tls";
import { safeAsync } from "@zoonk/utils/error";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchCompletingChain, isMissingIssuerError } from "./issuer-certificates";

/*
 * Certificates are built here with node:crypto instead of committed fixtures, so each leaf can
 * name the issuer address of this run's local server (its port changes every run), and no test
 * needs openssl or the network. Only the DER needed for a TLS chain is encoded.
 */
const OID = {
  authorityInfoAccess: "1.3.6.1.5.5.7.1.1",
  basicConstraints: "2.5.29.19",
  caIssuers: "1.3.6.1.5.5.7.48.2",
  commonName: "2.5.4.3",
  ecdsaWithSha256: "1.2.840.10045.4.3.2",
  subjectAltName: "2.5.29.17",
};

/** DER tag bytes (X.690), in decimal because oxfmt and oxlint disagree on the case of hex digits. */
const TAG = {
  bitString: 3,
  boolean: 1,
  dnsName: 130,
  extensions: 163,
  integer: 2,
  octetString: 4,
  oid: 6,
  sequence: 48,
  set: 49,
  uri: 134,
  utcTime: 23,
  utf8String: 12,
  version: 160,
};

/** How DER writes BOOLEAN true. */
const TRUE = 255;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

type TestCertificate = { certificate: X509Certificate; key: KeyObject; name: string; pem: string };

function inBase(value: number, base: number): number[] {
  return value < base ? [value] : [...inBase(Math.floor(value / base), base), value % base];
}

function der(tag: number, ...contents: Buffer[]): Buffer {
  const body = Buffer.concat(contents);
  const size = inBase(body.length, 256);
  const length = body.length < 0x80 ? [body.length] : [0x80 + size.length, ...size];

  return Buffer.concat([Buffer.from([tag, ...length]), body]);
}

function sequence(...items: Buffer[]): Buffer {
  return der(TAG.sequence, ...items);
}

function oid(dotted: string): Buffer {
  const [first = 0, second = 0, ...rest] = dotted.split(".").map(Number);

  const arcs = rest.flatMap((arc) => {
    const digits = inBase(arc, 128);
    return digits.map((digit, index) => (index < digits.length - 1 ? digit + 0x80 : digit));
  });

  return der(TAG.oid, Buffer.from([first * 40 + second, ...arcs]));
}

function distinguishedName(commonName: string): Buffer {
  return sequence(
    der(TAG.set, sequence(oid(OID.commonName), der(TAG.utf8String, Buffer.from(commonName)))),
  );
}

function utcTime(time: number): Buffer {
  const text = `${new Date(time).toISOString().replaceAll(/[-:T]/gu, "").slice(2, 14)}Z`;
  return der(TAG.utcTime, Buffer.from(text));
}

function extension({ critical, id, value }: { critical?: boolean; id: string; value: Buffer }) {
  const flag = critical ? [der(TAG.boolean, Buffer.from([TRUE]))] : [];
  return sequence(oid(id), ...flag, der(TAG.octetString, value));
}

function issueCertificate({
  ca,
  dnsName,
  issuer,
  issuerUrl,
  key,
  name,
}: {
  ca: boolean;
  dnsName?: string;
  issuer?: TestCertificate;
  issuerUrl?: string;
  key?: KeyObject;
  name: string;
}): TestCertificate {
  const privateKey = key ?? generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey;
  const algorithm = sequence(oid(OID.ecdsaWithSha256));
  const now = Date.now();

  const extensions = [
    extension({
      critical: true,
      id: OID.basicConstraints,
      value: ca ? sequence(der(TAG.boolean, Buffer.from([TRUE]))) : sequence(),
    }),
    dnsName &&
      extension({
        id: OID.subjectAltName,
        value: sequence(der(TAG.dnsName, Buffer.from(dnsName))),
      }),
    issuerUrl &&
      extension({
        id: OID.authorityInfoAccess,
        value: sequence(sequence(oid(OID.caIssuers), der(TAG.uri, Buffer.from(issuerUrl)))),
      }),
  ].filter((item) => Buffer.isBuffer(item));

  const signed = sequence(
    der(TAG.version, der(TAG.integer, Buffer.from([2]))),
    der(TAG.integer, Buffer.from([0x40 + randomInt(0x40), ...randomBytes(7)])),
    algorithm,
    distinguishedName(issuer?.name ?? name),
    sequence(utcTime(now - HOUR_MS), utcTime(now + DAY_MS)),
    distinguishedName(name),
    createPublicKey(privateKey).export({ format: "der", type: "spki" }),
    der(TAG.extensions, sequence(...extensions)),
  );

  const signature = sign("sha256", signed, { dsaEncoding: "der", key: issuer?.key ?? privateKey });

  const certificate = new X509Certificate(
    sequence(signed, algorithm, der(TAG.bitString, Buffer.from([0]), signature)),
  );

  return { certificate, key: privateKey, name, pem: certificate.toString() };
}

/** Sends every host name to this machine, so the real public-address rule sees public names. */
const lookup: LookupFunction = (_hostname, options, callback) => {
  if (options.all) {
    callback(null, [{ address: "127.0.0.1", family: 4 }]);
    return;
  }

  callback(null, "127.0.0.1", 4);
};

function listen(server: HttpServer | HttpsServer): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port));
  });
}

function close(server: HttpServer | HttpsServer): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}

describe(fetchCompletingChain, () => {
  const headers = { "user-agent": "ZoonkBot test" };
  /** What the certificate authority's server publishes, by path. */
  const published = new Map<string, { body?: Buffer | string; location?: string }>();
  /** Every path the certificate authority's server was asked for. */
  const downloads: string[] = [];
  /** The leaf-only chain the document server presents, by the host name the client asks for. */
  const leafContexts = new Map<string, SecureContext>();

  let originalAuthorities: string[];
  let root: TestCertificate;
  let intermediate: TestCertificate;
  let untrustedIntermediate: TestCertificate;
  let caServer: HttpServer;
  let caPort: number;
  let documentServer: HttpsServer;
  let documentPort: number;

  function issueLeaf({
    dnsName,
    issuer = intermediate,
    issuerPath,
  }: {
    dnsName: string;
    issuer?: TestCertificate;
    issuerPath?: string;
  }): TestCertificate {
    const issuerUrl = issuerPath && `http://ca.example.com:${caPort}${issuerPath}`;
    return issueCertificate({ ca: false, dnsName, issuer, issuerUrl, name: dnsName });
  }

  /** Serves a document at `host` presenting only `leaf`, the way INEP's server does. */
  function serveLeaf({ host, leaf }: { host: string; leaf: TestCertificate }): string {
    const key = leaf.key.export({ format: "pem", type: "pkcs8" });
    leafContexts.set(host, createSecureContext({ cert: leaf.pem, key }));
    return `https://${host}:${documentPort}/edital`;
  }

  function fetchLeafOnly(url: string) {
    return fetchCompletingChain({ headers, lookup, signal: AbortSignal.timeout(5000), url });
  }

  beforeAll(async () => {
    originalAuthorities = getCACertificates("default");
    root = issueCertificate({ ca: true, name: "Test Root" });
    intermediate = issueCertificate({ ca: true, issuer: root, name: "Test Intermediate" });

    const untrustedRoot = issueCertificate({ ca: true, name: "Untrusted Root" });

    untrustedIntermediate = issueCertificate({
      ca: true,
      issuer: untrustedRoot,
      name: "Untrusted Intermediate",
    });

    setDefaultCACertificates([...originalAuthorities, root.pem]);

    caServer = createHttpServer((request, response) => {
      const file = published.get(request.url ?? "");
      downloads.push(request.url ?? "");

      if (file?.location) {
        response.writeHead(302, { location: file.location }).end();
        return;
      }

      response.writeHead(file?.body ? 200 : 404, { "content-type": "application/pkix-cert" });
      response.end(file?.body);
    });

    const fallbackLeaf = issueCertificate({ ca: false, issuer: intermediate, name: "127.0.0.1" });

    documentServer = createHttpsServer(
      {
        SNICallback: (host, callback) => callback(null, leafContexts.get(host)),
        cert: fallbackLeaf.pem,
        key: fallbackLeaf.key.export({ format: "pem", type: "pkcs8" }),
      },
      (request, response) => response.end(`Edital for ${request.headers["user-agent"]}`),
    );

    [caPort, documentPort] = await Promise.all([listen(caServer), listen(documentServer)]);
  });

  afterAll(async () => {
    setDefaultCACertificates(originalAuthorities);
    await Promise.all([close(caServer), close(documentServer)]);
  });

  it("recognizes the error fetch reports for a server that sends only its own certificate", async () => {
    const { error } = await safeAsync(() => fetch(`https://127.0.0.1:${documentPort}/edital`));

    const otherFailure = new TypeError("fetch failed", { cause: new Error("ECONNRESET") });

    expect(isMissingIssuerError(error)).toBe(true);
    expect(isMissingIssuerError(otherFailure)).toBe(false);
  });

  it.each([
    { format: "DER", toFile: (certificate: TestCertificate) => certificate.certificate.raw },
    { format: "PEM", toFile: (certificate: TestCertificate) => certificate.pem },
  ])("completes the chain with the issuer published as $format", async ({ format, toFile }) => {
    const host = `${format.toLowerCase()}.example.com`;
    published.set(`/${host}.crt`, { body: toFile(intermediate) });
    const url = serveLeaf({ host, leaf: issueLeaf({ dnsName: host, issuerPath: `/${host}.crt` }) });

    const response = await fetchLeafOnly(url);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("Edital for ZoonkBot test");
  });

  it("downloads each issuer once", async () => {
    published.set("/cached.crt", { body: intermediate.certificate.raw });
    const leaf = issueLeaf({ dnsName: "cached.example.com", issuerPath: "/cached.crt" });
    const url = serveLeaf({ host: "cached.example.com", leaf });

    await fetchLeafOnly(url);
    const response = await fetchLeafOnly(url);

    expect(response.status).toBe(200);
    expect(downloads.filter((path) => path === "/cached.crt")).toHaveLength(1);
  });

  it("still fails when the issuer doesn't lead to a trusted root", async () => {
    published.set("/untrusted.crt", { body: untrustedIntermediate.certificate.raw });

    const leaf = issueLeaf({
      dnsName: "untrusted.example.com",
      issuer: untrustedIntermediate,
      issuerPath: "/untrusted.crt",
    });

    const url = serveLeaf({ host: "untrusted.example.com", leaf });

    await expect(fetchLeafOnly(url)).rejects.toMatchObject({ code: "UNABLE_TO_GET_ISSUER_CERT" });

    expect(downloads).toContain("/untrusted.crt");
  });

  it("still checks the host name", async () => {
    published.set("/other-host.crt", { body: intermediate.certificate.raw });
    const leaf = issueLeaf({ dnsName: "other.example.com", issuerPath: "/other-host.crt" });
    const url = serveLeaf({ host: "mismatch.example.com", leaf });

    await expect(fetchLeafOnly(url)).rejects.toMatchObject({
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
    });
  });

  it("fails when the certificate doesn't say where its issuer is", async () => {
    const leaf = issueLeaf({ dnsName: "no-issuer.example.com" });
    const url = serveLeaf({ host: "no-issuer.example.com", leaf });

    await expect(fetchLeafOnly(url)).rejects.toThrow("doesn't say where its issuer is published");
  });

  it("refuses an issuer at a private address", async () => {
    published.set("/private.crt", { body: intermediate.certificate.raw });

    const leaf = issueCertificate({
      ca: false,
      dnsName: "private.example.com",
      issuer: intermediate,
      issuerUrl: `http://127.0.0.1:${caPort}/private.crt`,
      name: "private.example.com",
    });

    const url = serveLeaf({ host: "private.example.com", leaf });

    await expect(fetchLeafOnly(url)).rejects.toThrow("Refusing to fetch a certificate");
    expect(downloads).not.toContain("/private.crt");
  });

  it.each([
    { error: "larger than", file: () => ({ body: Buffer.alloc(64 * 1024) }), problem: "oversized" },
    {
      error: "isn't a certificate",
      file: () => ({ body: "<html>" }),
      problem: "not-a-certificate",
    },
    {
      error: "isn't the authority",
      file: () => ({
        body: issueCertificate({
          ca: false,
          issuer: root,
          key: intermediate.key,
          name: intermediate.name,
        }).certificate.raw,
      }),
      problem: "not-a-ca",
    },
    {
      error: "isn't the authority",
      file: () => ({ body: untrustedIntermediate.certificate.raw }),
      problem: "another-issuer",
    },
    {
      error: "status 302",
      file: () => ({ location: `http://127.0.0.1:${caPort}/redirect-target.crt` }),
      problem: "redirect",
    },
  ])("refuses an issuer download that is $problem", async ({ error, file, problem }) => {
    published.set(`/redirect-target.crt`, { body: intermediate.certificate.raw });
    published.set(`/${problem}.crt`, file());

    const host = `${problem}.example.com`;

    const url = serveLeaf({
      host,
      leaf: issueLeaf({ dnsName: host, issuerPath: `/${problem}.crt` }),
    });

    await expect(fetchLeafOnly(url)).rejects.toThrow(error);
    expect(downloads).not.toContain("/redirect-target.crt");
  });
});
