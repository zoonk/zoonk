import { getAppLocale } from "@/i18n/locale";
import {
  type WebPlusCancellation,
  getWebPlusCancellation,
} from "@zoonk/core/subscriptions/web-plus-cancellation";
import {
  Page,
  PageHeader,
  PageHeaderContent,
  PageSection,
  PageSubtitle,
  PageTitle,
} from "@zoonk/learn/page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { formatPrice } from "@zoonk/utils/currency";
import { getRequestCountry } from "@zoonk/utils/locale-request";
import { type Metadata } from "next";
import { getExtracted, getFormatter } from "next-intl/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import { ManagedSubscription } from "../managed-subscription";
import { type CancelChoice } from "./cancel-choices";
import { CancelPlusForm } from "./cancel-plus-form";
import { CancelWithoutLoginForm } from "./cancel-without-login-form";

type ReadyCancellation = Extract<WebPlusCancellation, { status: "ready" }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { robots: { follow: false, index: false }, title: t("Cancel Plus") };
}

function CancelPlusHeader({ children }: { children?: React.ReactNode }) {
  return (
    <PageHeader>
      <PageHeaderContent>{children}</PageHeaderContent>
    </PageHeader>
  );
}

async function CancelPlusTitle() {
  const t = await getExtracted();
  return <PageTitle className="md:text-xl md:leading-tight">{t("Cancel Plus")}</PageTitle>;
}

/** France asks for a summary of the request before it's sent (Code de la consommation D215-3). */
async function reviewsFirst(): Promise<boolean> {
  return getRequestCountry(await headers()) === "FR";
}

/**
 * No login needed (BGB § 312k; EU Consumer Rights Directive art. 11a), and nothing else on the page
 * but the cancellation (BGH I ZR 200/25).
 */
async function CancelWithoutLogin() {
  const t = await getExtracted();

  return (
    <>
      <CancelPlusHeader>
        <CancelPlusTitle />
        <PageSubtitle>
          <span>{t("For Plus bought on our website. No login needed.")}</span>
        </PageSubtitle>
      </CancelPlusHeader>

      <PageSection aria-label={t("Cancel Plus")}>
        <CancelWithoutLoginForm reviewFirst={await reviewsFirst()} />
      </PageSection>
    </>
  );
}

async function getOrdinaryChoice(cancellation: ReadyCancellation): Promise<CancelChoice | null> {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getAppLocale();
  const ordinary = cancellation.cancellation;

  if (!ordinary) {
    return null;
  }

  if (cancellation.unpaid) {
    return {
      description: t("Your last payment didn't go through. Canceling stops us from trying again."),
      label: t("Stop the unpaid renewal"),
      value: "ordinary",
    };
  }

  const date = format.dateTime(ordinary.endsAt, {
    dateStyle: "long",
    timeZone: cancellation.timeZone,
  });

  return {
    description:
      ordinary.unstartedMonths > 0
        ? t(
            "You keep Plus until {date}. For the {count, plural, one {# month} other {# months}} that haven't started, we refund {amount}.",
            {
              amount: formatPrice(ordinary.refundAmount, cancellation.currency, locale),
              count: ordinary.unstartedMonths,
              date,
            },
          )
        : t("You keep Plus until {date}, and you won't be charged again.", { date }),
    label: t("Cancel at the end of the period"),
    value: "ordinary",
  };
}

async function getChoices(cancellation: ReadyCancellation): Promise<CancelChoice[]> {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getAppLocale();
  const { currency, extraordinary, timeZone, withdrawal } = cancellation;
  const money = (amount: number) => formatPrice(amount, currency, locale);
  const ordinary = await getOrdinaryChoice(cancellation);

  return [
    ...(ordinary ? [ordinary] : []),
    ...(withdrawal
      ? [
          {
            description: t(
              "Plus ends right away, and we refund {amount}. You can do this until {date}.",
              {
                amount: money(withdrawal.refundAmount),
                date: format.dateTime(withdrawal.until, { dateStyle: "long", timeZone }),
              },
            ),
            label: t({
              description:
                "The 14-day withdrawal from the contract with its full refund. In brackets, the legal noun the confirm button uses (EU Consumer Rights Directive): German “Widerruf”, French “rétractation”, Spanish “desistimiento”, Portuguese “retratação”.",
              message: "Full refund (withdrawal)",
            }),
            value: "withdrawal" as const,
          },
        ]
      : []),
    ...(extraordinary
      ? [
          {
            description:
              extraordinary.refundAmount > 0
                ? t("Plus ends right away, and we refund {amount} for the days left.", {
                    amount: money(extraordinary.refundAmount),
                  })
                : t("Plus ends right away."),
            label: t("End now for an important reason"),
            value: "extraordinary" as const,
          },
        ]
      : []),
  ];
}

async function CancelPlusContent() {
  const t = await getExtracted();
  const cancellation = await getWebPlusCancellation();

  if (!cancellation) {
    return <CancelWithoutLogin />;
  }

  if (cancellation.status === "none") {
    return (
      <CancelPlusHeader>
        <CancelPlusTitle />
        <PageSubtitle>
          <span>
            {t("There's no subscription to cancel on {email}.", { email: cancellation.email })}
          </span>
        </PageSubtitle>
      </CancelPlusHeader>
    );
  }

  if (cancellation.status === "store") {
    return (
      <>
        <CancelPlusHeader>
          <CancelPlusTitle />
        </CancelPlusHeader>
        <ManagedSubscription provider={cancellation.provider} />
      </>
    );
  }

  const { email, endingAt, name, timeZone } = cancellation;
  const plan = cancellation.interval === "year" ? t("Plus, yearly") : t("Plus, monthly");
  const choices = await getChoices(cancellation);

  return (
    <>
      <CancelPlusHeader>
        <CancelPlusTitle />
        <PageSubtitle>
          {name && <span>{name}</span>}
          <span>{email}</span>
          <span>{plan}</span>
        </PageSubtitle>
      </CancelPlusHeader>

      <PageSection aria-label={t("Cancel Plus")}>
        <CancelPlusForm
          choices={choices}
          email={email}
          endingAt={endingAt}
          key={choices.map(({ value }) => value).join(" ")}
          name={name}
          plan={plan}
          reviewFirst={await reviewsFirst()}
          timeZone={timeZone}
        />
      </PageSection>
    </>
  );
}

function CancelPlusSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <Skeleton className="h-9 w-48 md:h-6.5" />
      <Skeleton className="h-28 rounded-lg" />
    </div>
  );
}

/** Reachable signed out, from every public page's footer, as EU and German law ask. */
export default function CancelPlusPage() {
  return (
    <Page>
      <Suspense fallback={<CancelPlusSkeleton />}>
        <CancelPlusContent />
      </Suspense>
    </Page>
  );
}
