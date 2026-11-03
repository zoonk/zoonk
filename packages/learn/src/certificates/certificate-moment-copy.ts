"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useCertificateName } from "./certificate-labels";

export type CertificateAccount = "account" | "guest";

function useOneCertificateCopy() {
  const t = useExtracted();
  const certificateName = useCertificateName();

  return (facts: CertificateFacts) => {
    const certificate = certificateName(facts);

    if (facts.kind === "languageLevel") {
      return {
        line: t("Your {certificate} certificate is ready.", { certificate }),
        title: t("{level} complete!", { level: facts.level ?? "" }),
      };
    }

    if (facts.kind === "placement") {
      return {
        line: t("Your {certificate} placement result is ready.", { certificate }),
        title: t("Placement result"),
      };
    }

    return {
      line: t("Your certificate for {course} is ready.", { course: certificate }),
      title: t("Course complete!"),
    };
  };
}

/** `certificates` is newest last, as completion results carry them. */
export function useCertificateMomentCopy({
  account,
  certificates,
}: {
  account: CertificateAccount;
  certificates: CertificateFacts[];
}) {
  const t = useExtracted();
  const format = useFormatter();
  const certificateName = useCertificateName();
  const oneCopy = useOneCertificateCopy();
  const count = certificates.length;
  const top = certificates.at(-1);
  const one = top ? oneCopy(top) : { line: "", title: "" };

  const title =
    count > 1 ? t("{count, plural, other {# certificates earned}}", { count }) : one.title;

  const ready =
    count > 1
      ? t("Your {list} certificates are ready.", {
          list: format.list(certificates.map((facts) => certificateName(facts))),
        })
      : one.line;

  const guest = t(
    "{count, plural, one {Create a free account to keep your certificate and put your name on it.} other {Create a free account to keep your certificates and put your name on them.}}",
    { count },
  );

  return {
    line: account === "guest" ? guest : ready,
    saved: count > 1 ? t("They're saved in Certificates.") : t("It's saved in Certificates."),
    title,
  };
}
