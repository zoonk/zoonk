import { getPathname } from "@/i18n/navigation";
import { getWebPlusCancellation } from "@zoonk/core/subscriptions/web-plus-cancellation";
import { ListGroup } from "@zoonk/learn/list";
import {
  Page,
  PageHeader,
  PageHeaderContent,
  PageSection,
  PageSectionFooter,
  PageSubtitle,
  PageTitle,
} from "@zoonk/learn/page";
import { SettingRow } from "@zoonk/learn/setting-rows";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { formatPrice } from "@zoonk/utils/currency";
import { type Metadata } from "next";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { Suspense } from "react";
import { ManagedSubscription } from "../managed-subscription";
import { CancelPlusButton, CancelPlusForm } from "./cancel-plus-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { robots: { follow: false, index: false }, title: t("Cancel Plus") };
}

function renderDate(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
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

async function LogInToCancel() {
  const t = await getExtracted();
  const locale = await getLocale();
  const next = getPathname({ href: "/subscription/cancel", locale });
  const loginHref = `${getPathname({ href: "/login", locale })}?next=${encodeURIComponent(next)}`;

  return (
    <>
      <CancelPlusHeader>
        <CancelPlusTitle />
        <PageSubtitle>
          <span>{t("Log in with the account you subscribed with to cancel or get a refund.")}</span>
        </PageSubtitle>
      </CancelPlusHeader>

      <a className={buttonVariants({ className: "w-max", size: "sm" })} href={loginHref}>
        {t("Log in")}
      </a>
    </>
  );
}

async function RenewalChoice({
  currency,
  endsAt,
  refundAmount,
  unpaid,
  unstartedMonths,
}: {
  currency: string;
  endsAt: Date;
  refundAmount: number;
  unpaid: boolean;
  unstartedMonths: number;
}) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getLocale();
  const date = format.dateTime(endsAt, { dateStyle: "long" });

  const button = (
    <CancelPlusButton withdraw={false}>
      {t({
        description:
          "Confirms canceling the subscription; Plus stays until the date beside it. In German it must read exactly “Jetzt kündigen” (BGB § 312k).",
        message: "Cancel now",
      })}
    </CancelPlusButton>
  );

  if (unpaid) {
    return (
      <SettingRow
        description={t(
          "Your last payment didn't go through. Canceling stops us from trying again.",
        )}
        label={t("Unpaid renewal")}
      >
        {button}
      </SettingRow>
    );
  }

  return (
    <SettingRow
      description={
        unstartedMonths > 0
          ? t(
              "For the {count, plural, one {# month} other {# months}} that haven't started, we refund {amount}.",
              { amount: formatPrice(refundAmount, currency, locale), count: unstartedMonths },
            )
          : t("You won't be charged again.")
      }
      label={t("Keep Plus until {date}", { date })}
    >
      {button}
    </SettingRow>
  );
}

async function CancelPlusContent() {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getLocale();
  const cancellation = await getWebPlusCancellation();

  if (!cancellation) {
    return <LogInToCancel />;
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

  const toDate = (date: Date) => format.dateTime(date, { dateStyle: "long" });

  if (cancellation.status === "ending") {
    return (
      <CancelPlusHeader>
        <CancelPlusTitle />
        <PageSubtitle>
          <span>
            {t.rich("Your subscription will end on <mono>{date}</mono>.", {
              date: toDate(cancellation.endsAt),
              mono: renderDate,
            })}
          </span>
        </PageSubtitle>
      </CancelPlusHeader>
    );
  }

  const { currency, email, endingAt, name, withdrawal } = cancellation;
  const money = (amount: number) => formatPrice(amount, currency, locale);
  const plan = cancellation.interval === "year" ? t("Plus, yearly") : t("Plus, monthly");
  const periodEnd = cancellation.cancellation;

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
        <CancelPlusForm email={email}>
          {endingAt && (
            <p className="text-sm">
              {t.rich("Your subscription will end on <mono>{date}</mono>.", {
                date: toDate(endingAt),
                mono: renderDate,
              })}
            </p>
          )}

          <ListGroup>
            {withdrawal && (
              <SettingRow
                description={t(
                  "Plus ends right away, and we refund {amount}. You can do this until {date}.",
                  { amount: money(withdrawal.refundAmount), date: toDate(withdrawal.until) },
                )}
                label={t("Full refund")}
              >
                <CancelPlusButton withdraw>
                  {t({
                    description:
                      "Confirms withdrawing from the contract with a full refund (EU Consumer Rights Directive art. 11a). In German it must read exactly “Widerruf bestätigen” (BGB § 356a).",
                    message: "Cancel and get a refund",
                  })}
                </CancelPlusButton>
              </SettingRow>
            )}

            {periodEnd && (
              <RenewalChoice
                currency={currency}
                endsAt={periodEnd.endsAt}
                refundAmount={periodEnd.refundAmount}
                unpaid={cancellation.unpaid}
                unstartedMonths={periodEnd.unstartedMonths}
              />
            )}
          </ListGroup>

          <PageSectionFooter>{t("We'll email you the confirmation.")}</PageSectionFooter>
        </CancelPlusForm>
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
