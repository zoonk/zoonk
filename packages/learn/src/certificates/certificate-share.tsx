"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@zoonk/ui/components/dialog";
import { showSuccessToast } from "@zoonk/ui/components/toast";
import { useClipboard } from "@zoonk/ui/hooks/clipboard";
import { type CertificateLinks } from "@zoonk/utils/certificate-links";
import { LinkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef } from "react";
import { CopyButton } from "./certificate-copy-button";
import {
  roundStudyMinutes,
  useCertificateName,
  useLanguageNameInSentence,
} from "./certificate-labels";

const MINUTES_PER_HOUR = 60;

export type ShareableCertificate = Pick<
  CertificateFacts,
  "kind" | "lessonsStudied" | "level" | "minutes" | "targetLanguage" | "title"
>;

function useShareText() {
  const t = useExtracted();
  const certificateName = useCertificateName();
  const languageName = useLanguageNameInSentence();

  return (facts: ShareableCertificate): string => {
    const level = facts.level ?? "";
    const language = languageName(facts.targetLanguage);

    if (facts.kind === "placement") {
      return t("My {language} placement result on Zoonk: {level}.", { language, level });
    }

    if (facts.kind === "languageLevel") {
      return t("I just completed level {level} in {language} on Zoonk.", { language, level });
    }

    const course = certificateName(facts);
    const lessons = facts.lessonsStudied ?? 0;
    const minutes = facts.minutes === null ? null : roundStudyMinutes(facts.minutes);

    if (minutes === null) {
      return t(
        "I just finished {course} on Zoonk: {lessons, plural, =0 {# lessons} one {# lesson} other {# lessons}}.",
        { course, lessons },
      );
    }

    if (minutes < MINUTES_PER_HOUR) {
      return t(
        "I just finished {course} on Zoonk: {lessons, plural, =0 {# lessons} one {# lesson} other {# lessons}} and about {minutes, plural, one {# minute} other {# minutes}} of study.",
        { course, lessons, minutes },
      );
    }

    return t(
      "I just finished {course} on Zoonk: {lessons, plural, =0 {# lessons} one {# lesson} other {# lessons}} and about {hours, plural, one {# hour} other {# hours}} of study.",
      { course, hours: minutes / MINUTES_PER_HOUR, lessons },
    );
  };
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchShareFile(url: string): Promise<File | null> {
  try {
    const response = await fetch(url);

    return response.ok
      ? new File([await response.blob()], "certificate.png", { type: "image/png" })
      : null;
  } catch {
    return null;
  }
}

/** Phones share through the system sheet; a mouse gets the dialog, where every network has a button. */
function prefersSystemShare(): boolean {
  return (
    typeof navigator.share === "function" && globalThis.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * Starts loading the picture when the learner reaches for Share, so the system sheet opens with
 * it while the tap still counts as the learner's gesture.
 */
export function useShareCertificate({
  facts,
  links,
  openDialog,
}: {
  facts: ShareableCertificate;
  links: Pick<CertificateLinks, "imageUrls" | "url">;
  openDialog: () => void;
}) {
  const shareText = useShareText();
  const file = useRef<Promise<File | null> | null>(null);

  const prepare = () => {
    if (prefersSystemShare()) {
      file.current ??= fetchShareFile(links.imageUrls.post);
    }
  };

  const share = async () => {
    if (!prefersSystemShare()) {
      openDialog();
      return;
    }

    prepare();
    const picture = await file.current;
    const text = shareText(facts);
    const withFile = picture && navigator.canShare?.({ files: [picture] });

    try {
      await navigator.share(
        withFile ? { files: [picture], text, url: links.url } : { text, url: links.url },
      );
    } catch (error) {
      if (!isAbort(error)) {
        openDialog();
      }
    }
  };

  return { prepare, share };
}

type Network = "facebook" | "linkedin" | "whatsapp" | "x";

function getNetworkUrl({
  network,
  text,
  url,
}: {
  network: Network;
  text: string;
  url: string;
}): string {
  const encodedUrl = encodeURIComponent(url);

  switch (network) {
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
    case "x":
      return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodedUrl}`;
    default:
      return network satisfies never;
  }
}

/** LinkedIn and Facebook drop prefilled text, so their buttons copy it to paste. */
function NetworkLinks({ text, url }: { text: string; url: string }) {
  const t = useExtracted();
  const { copy } = useClipboard();

  const networks: { copied?: string; label: string; network: Network }[] = [
    {
      copied: t("Text copied. Paste it into your LinkedIn post."),
      label: "LinkedIn",
      network: "linkedin",
    },
    { label: "X", network: "x" },
    {
      copied: t("Text copied. Paste it into your Facebook post."),
      label: "Facebook",
      network: "facebook",
    },
    { label: "WhatsApp", network: "whatsapp" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {networks.map(({ copied, label, network }) => (
        <a
          className={buttonVariants({ size: "lg", variant: "outline" })}
          href={getNetworkUrl({ network, text, url })}
          key={network}
          onClick={() => {
            if (copied) {
              void copy(text).then(() => showSuccessToast(copied));
            }
          }}
          rel="noopener noreferrer"
          target="_blank"
        >
          {label}
        </a>
      ))}
    </div>
  );
}

export function CertificateShareDialog({
  facts,
  links,
  onOpenChange,
  open,
}: {
  facts: ShareableCertificate;
  links: Pick<CertificateLinks, "imageUrls" | "url">;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useExtracted();
  const shareText = useShareText();
  const { copy } = useClipboard();
  const text = shareText(facts);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto sm:max-w-[540px]"
        closeLabel={t("Close")}
        overNested
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{t("Share your certificate")}</DialogTitle>
          <DialogDescription>
            {t("Your post shows this picture and links to your certificate's page.")}
          </DialogDescription>
        </DialogHeader>

        {/* oxlint-disable-next-line next/no-img-element -- @zoonk/learn doesn't depend on next/image; this is Main's own rendered PNG. */}
        <img
          alt=""
          className="ring-border aspect-1200/630 h-auto w-full rounded-lg bg-white ring-1"
          height={630}
          src={links.imageUrls.link}
          width={1200}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{t("Suggested text")}</span>
          <div className="border-input flex items-start gap-3 rounded-lg border px-3.5 py-3">
            <p className="min-w-0 flex-1 text-sm leading-normal text-pretty">{text}</p>
            <CopyButton label={t("Copy the suggested text")} text={text} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">{t("Post on")}</span>
          <NetworkLinks text={text} url={links.url} />
        </div>

        <button
          className={buttonVariants({
            className: "-ml-3 justify-self-start",
            size: "lg",
            variant: "ghost",
          })}
          onClick={() => void copy(links.url).then(() => showSuccessToast(t("Link copied")))}
          type="button"
        >
          <LinkIcon aria-hidden="true" />
          {t("Copy link")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
