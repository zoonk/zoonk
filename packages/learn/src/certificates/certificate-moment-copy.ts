"use client";

import { type OwnedCertificateFacts } from "@zoonk/core/certificates/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useLevelName } from "../course/use-level-name";
import { useCertificateName } from "./certificate-labels";

function useOneCertificateCopy() {
  const t = useExtracted();
  const certificateName = useCertificateName();
  const levelName = useLevelName();

  return (facts: OwnedCertificateFacts) => {
    const certificate = certificateName(facts);

    if (facts.kind === "languageLevel") {
      return {
        line: t("Your {certificate} certificate is ready.", { certificate }),
        title: t("{level} complete!", { level: facts.level ?? "" }),
      };
    }

    return {
      line: t("Your certificate for {course} is ready.", { course: certificate }),
      title: facts.courseLevel
        ? t("{level} complete!", { level: levelName(facts.courseLevel) })
        : t("Course complete!"),
    };
  };
}

/**
 * `certificates` is newest last, as completion results carry them. A locked one isn't ready to
 * use, so it gets no line: the Plus notice says how to get it.
 */
export function useCertificateMomentCopy(certificates: OwnedCertificateFacts[]) {
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

  return {
    line: top?.locked ? null : ready,
    saved: count > 1 ? t("They're saved in Certificates.") : t("It's saved in Certificates."),
    title,
  };
}
