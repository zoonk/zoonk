"use client";

import { noteAppWrite } from "@/lib/http/app-write-ledger";
import { type WebPlusCancellationRequest } from "@zoonk/core/subscriptions/web-plus-cancellation-contract";
import { ListGroup } from "@zoonk/learn/list";
import { useAppLocale } from "@zoonk/learn/locale";
import { SettingRow } from "@zoonk/learn/setting-rows";
import { Input } from "@zoonk/ui/components/input";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import {
  type CancelChoice,
  CancelChoiceFields,
  CancelFormFooter,
  ReceiptDetails,
  readCancellationRequest,
  readFormField,
  useLinkedChoice,
} from "./cancel-choices";
import {
  type RequestCancellationResult,
  requestCancellationAction,
} from "./request-cancellation-action";

type Declaration = { email: string; name: string; request: WebPlusCancellationRequest };
type Receipt = Declaration & { choiceLabel: string; receivedAt: Date };

function DeclarationReceipt({ receipt }: { receipt: Receipt }) {
  const t = useExtracted();
  const { email, name, request } = receipt;

  return (
    <div className="flex flex-col gap-4 text-sm" role="status">
      <p className="font-medium">
        {request.choice === "withdrawal"
          ? t({
              description:
                "The 14-day withdrawal from the contract with its full refund. Use the legal noun the confirm button uses (EU Consumer Rights Directive): German “Widerruf”, French “rétractation”, Spanish “desistimiento”, Portuguese “retratação”.",
              message: "We received your withdrawal.",
            })
          : t("We received your cancellation.")}
      </p>

      <ReceiptDetails
        choiceLabel={receipt.choiceLabel}
        email={email}
        name={name}
        reason={request.choice === "extraordinary" ? (request.reason ?? null) : null}
        receivedAt={receipt.receivedAt}
      />

      <p>
        {t(
          "If {email} has Plus from our website, the confirmation will arrive there within a few minutes. No email? Check it's the address you subscribed with, or write to hello@zoonk.com.",
          { email },
        )}
      </p>

      <p className="text-muted-foreground">
        {t("Subscribed in the App Store or Google Play? This doesn't cancel it. Cancel it there.")}
      </p>
    </div>
  );
}

export function CancelWithoutLoginForm() {
  const t = useExtracted();
  const locale = useAppLocale();
  const emailHintId = useId();
  const linked = useLinkedChoice();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState(linked ?? "ordinary");
  const [result, setResult] = useState<RequestCancellationResult | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const choices: CancelChoice[] = [
    {
      description: t(
        "You keep Plus until the period you paid for ends. After a yearly renewal, it ends with the current month, and we refund the rest.",
      ),
      label: t("Cancel at the end of the period"),
      value: "ordinary",
    },
    {
      description: t(
        "Within 14 days of subscribing. Plus ends right away, and we refund everything.",
      ),
      label: t({
        description:
          "The 14-day withdrawal from the contract with its full refund. In brackets, the legal noun the confirm button uses (EU Consumer Rights Directive): German “Widerruf”, French “rétractation”, Spanish “desistimiento”, Portuguese “retratação”.",
        message: "Full refund (withdrawal)",
      }),
      value: "withdrawal",
    },
    {
      description: t("Plus ends right away, and we refund the days left."),
      label: t("End now for an important reason"),
      value: "extraordinary",
    },
  ];

  const choice = choices.find(({ value }) => value === picked) ?? choices[0];

  if (receipt) {
    return <DeclarationReceipt receipt={receipt} />;
  }

  if (!choice) {
    return null;
  }

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    const declaration: Declaration = {
      email: readFormField(form, "email"),
      name: readFormField(form, "name"),
      request: readCancellationRequest(choice.value, form),
    };

    startTransition(async () => {
      const outcome = await noteAppWrite(
        requestCancellationAction({ ...declaration, locale }),
      ).catch((): RequestCancellationResult => ({ status: "failed" }));

      setResult(outcome);

      if (outcome.status === "received") {
        setReceipt({ ...declaration, choiceLabel: choice.label, receivedAt: outcome.receivedAt });
      }
    });
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      <ListGroup>
        <SettingRow label={<label htmlFor="cancel-name">{t("Name")}</label>} wide>
          <Input autoComplete="name" id="cancel-name" maxLength={100} name="name" required />
        </SettingRow>

        <SettingRow
          description={t("The one you use for Zoonk")}
          descriptionId={emailHintId}
          label={<label htmlFor="cancel-email">{t("Email")}</label>}
          wide
        >
          <Input
            aria-describedby={emailHintId}
            autoComplete="email"
            id="cancel-email"
            name="email"
            required
            type="email"
          />
        </SettingRow>
      </ListGroup>

      <div className="flex flex-col gap-4">
        <CancelChoiceFields choice={choice.value} choices={choices} onChoiceChange={setPicked} />

        <CancelFormFooter choice={choice.value} pending={pending}>
          {result?.status === "failed" && (
            <p className="text-destructive-text text-sm" role="alert">
              {t("We couldn't send your request. Try again or email hello@zoonk.com.")}
            </p>
          )}

          {result?.status === "invalid" && (
            <p className="text-destructive-text text-sm" role="alert">
              {t("Check your name and email, then try again.")}
            </p>
          )}
        </CancelFormFooter>
      </div>
    </form>
  );
}
