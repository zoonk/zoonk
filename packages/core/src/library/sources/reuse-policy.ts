import { normalizeString } from "@zoonk/utils/string";
import { type ReusePolicy } from "./source-contract";

type KnownPublisher = { domains: readonly string[]; names: readonly string[]; policy: ReusePolicy };

const INEP_POLICY: ReusePolicy = {
  basis:
    "INEP allows reproduction with the source cited, and exams are official acts that Brazil's copyright law (Law 9,610/98, article 8) doesn't protect. Third-party texts and images inside questions keep their rights, so quote them briefly with credit.",
  honorTakedowns: false,
  pastQuestions: "allowedWithCitation",
  termsUrl: null,
};

const BRAZILIAN_BOARD_POLICY: ReusePolicy = {
  basis:
    "Brazil's Supreme Court held that reproducing exam questions with the source cited doesn't infringe copyright. Some boards have asked sites to remove questions, so takedown requests are honored.",
  honorTakedowns: true,
  pastQuestions: "allowedWithCitation",
  termsUrl: null,
};

const COLLEGE_BOARD_POLICY: ReusePolicy = {
  basis:
    "College Board's terms forbid reusing its questions and using them with generative AI, so practice uses original questions in the same style.",
  honorTakedowns: true,
  pastQuestions: "notAllowed",
  termsUrl: "https://www.collegeboard.org/site-terms",
};

/** Boards whose reuse terms were checked by hand. */
const KNOWN_PUBLISHERS: readonly KnownPublisher[] = [
  { domains: ["inep.gov.br", "enem.inep.gov.br"], names: ["inep", "enem"], policy: INEP_POLICY },
  {
    domains: [
      "cebraspe.org.br",
      "fgv.br",
      "vunesp.com.br",
      "concursosfcc.com.br",
      "cesgranrio.org.br",
      "ibfc.org.br",
      "institutoaocp.org.br",
      "idecan.org.br",
      "quadrix.org.br",
      "consulplan.net",
      "fundatec.org.br",
    ],
    names: [
      "cebraspe",
      "cespe",
      "fgv",
      "fundacao getulio vargas",
      "vunesp",
      "fcc",
      "fundacao carlos chagas",
      "cesgranrio",
      "ibfc",
      "aocp",
      "idecan",
      "quadrix",
      "consulplan",
      "fundatec",
    ],
    policy: BRAZILIAN_BOARD_POLICY,
  },
  {
    domains: ["collegeboard.org", "sat.collegeboard.org", "apstudents.collegeboard.org"],
    names: ["college board", "collegeboard"],
    policy: COLLEGE_BOARD_POLICY,
  },
];

function getHostname(url: string | null | undefined): string | null {
  if (!url || !URL.canParse(url)) {
    return null;
  }

  return new URL(url).hostname.replace(/^www\./u, "");
}

function matchesDomain({ domains, hostname }: { domains: readonly string[]; hostname: string }) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/** Word matching keeps "fgv" from matching inside another publisher's name. */
function matchesName({ name, publisher }: { name: string; publisher: string }): boolean {
  return ` ${publisher} `.includes(` ${name} `);
}

function findKnownPublisher({
  publisher,
  url,
}: {
  publisher?: string | null;
  url?: string | null;
}): KnownPublisher | undefined {
  const hostname = getHostname(url);

  const normalizedPublisher = publisher
    ? normalizeString(publisher).replaceAll(/[^\w ]/gu, " ")
    : "";

  return KNOWN_PUBLISHERS.find(
    (known) =>
      (hostname !== null && matchesDomain({ domains: known.domains, hostname })) ||
      (normalizedPublisher.length > 0 &&
        known.names.some((name) => matchesName({ name, publisher: normalizedPublisher }))),
  );
}

/**
 * Returns the checked policy of a known board, found by the source's domain or
 * its publisher's name. Unknown boards get null so the caller can read the
 * board's own terms; a policy that isn't `allowedWithCitation` means items are
 * written as original questions, never quoted.
 */
export function getKnownReusePolicy(input: {
  publisher?: string | null;
  url?: string | null;
}): ReusePolicy | null {
  return findKnownPublisher(input)?.policy ?? null;
}
