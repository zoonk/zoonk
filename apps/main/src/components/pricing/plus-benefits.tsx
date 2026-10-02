import { CheckCircle } from "@/components/public/check-circle";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { getExtracted } from "next-intl/server";

/**
 * What Plus gives, in a few short lines: the offer shows it before paying and a subscriber's plan
 * shows it after, so both promise the same thing. The free plan's limits wait in the questions
 * under the offer, for whoever wants the details.
 */
export async function PlusBenefits() {
  const t = await getExtracted();

  const benefits = [
    t("Unlimited lessons and goals"),
    t("Full exam prep, with mock exams"),
    t("AI tutor whenever you're stuck"),
    t("Speaking practice every day"),
  ];

  return (
    <ul className="flex flex-col gap-2.5">
      {benefits.map((benefit) => (
        <li className="flex items-start gap-3 text-[15px] leading-snug" key={benefit}>
          <LineMarker>
            <CheckCircle size="sm" />
          </LineMarker>
          <span className="text-pretty">{benefit}</span>
        </li>
      ))}
    </ul>
  );
}
