"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ExternalLinkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ComponentProps, type MouseEvent, createContext, use } from "react";
import {
  type Components,
  type ExtraProps,
  type LinkSafetyModalProps,
  Streamdown,
  defaultRehypePlugins,
} from "streamdown";
import { type PlayerLinkComponent } from "../player-context";
import { getSafeLessonQuestionUrl } from "./lesson-question-url";
import { isTutorAppPath, readTutorBlockLink } from "./tutor-app-links";
import { useMarkdownPlugins } from "./tutor-markdown-plugins";

const DISALLOWED_ANSWER_ELEMENTS = ["img"] as const;

function ExternalLinkConfirmation({ isOpen, onClose, onConfirm, url }: LinkSafetyModalProps) {
  const t = useExtracted();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const openLink = () => {
    onConfirm();
    onClose();
  };

  return (
    <AlertDialog onOpenChange={handleOpenChange} open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Open this link?")}</AlertDialogTitle>
          <AlertDialogDescription className="flex min-w-0 flex-col gap-3">
            <span>{t("This link opens a website outside Zoonk.")}</span>
            <span className="bg-muted max-h-24 overflow-y-auto rounded-lg p-3 font-mono text-xs break-all">
              {url}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
          <a
            className={buttonVariants()}
            href={url}
            onClick={(event) => {
              event.preventDefault();
              openLink();
            }}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon aria-hidden="true" />
            {t("Open link")}
          </a>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function renderExternalLinkConfirmation(props: LinkSafetyModalProps) {
  return <ExternalLinkConfirmation {...props} />;
}

const LESSON_QUESTION_LINK_SAFETY = {
  enabled: true,
  renderModal: renderExternalLinkConfirmation,
} as const;

/** Set `verified` only after the saved answer's links have been checked against their allowlist. */
export type TutorAnswerLinks = {
  Link: PlayerLinkComponent;
  openBlock?: (blockId: string) => void;
  verified: boolean;
};

// Buddy answers must never render raw HTML.
const BUDDY_REHYPE_PLUGINS = [defaultRehypePlugins.sanitize, defaultRehypePlugins.harden].flatMap(
  (plugin) => (plugin ? [plugin] : []),
);

function isPlainClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

const TutorAnswerLinksContext = createContext<TutorAnswerLinks | null>(null);

function TutorAnswerLink({ children, href }: ComponentProps<"a"> & ExtraProps) {
  const links = use(TutorAnswerLinksContext);

  if (!links?.verified || !href || !isTutorAppPath(href)) {
    return children;
  }

  const { Link, openBlock } = links;
  const blockId = readTutorBlockLink(href);

  const onClick =
    blockId && openBlock
      ? (event: MouseEvent<HTMLAnchorElement>) => {
          if (isPlainClick(event)) {
            event.preventDefault();
            openBlock(blockId);
          }
        }
      : undefined;

  return (
    <Link href={href} onClick={onClick} prefetch={false}>
      {children}
    </Link>
  );
}

const TUTOR_ANSWER_COMPONENTS: Components = { a: TutorAnswerLink };

export function TutorMarkdown({
  answer,
  appLinks,
  isAnimating,
  isStreaming,
}: {
  answer: string;
  appLinks?: TutorAnswerLinks;
  isAnimating: boolean;
  isStreaming: boolean;
}) {
  const plugins = useMarkdownPlugins({ isStreaming, text: answer });

  return (
    <TutorAnswerLinksContext value={appLinks ?? null}>
      <Streamdown
        animated={isAnimating}
        className="min-w-0 wrap-anywhere [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1 [&_a]:underline [&_a]:underline-offset-4"
        components={appLinks ? TUTOR_ANSWER_COMPONENTS : undefined}
        controls={false}
        disallowedElements={DISALLOWED_ANSWER_ELEMENTS}
        isAnimating={isAnimating}
        linkSafety={appLinks ? undefined : LESSON_QUESTION_LINK_SAFETY}
        mode={isStreaming ? "streaming" : "static"}
        plugins={plugins}
        rehypePlugins={appLinks ? BUDDY_REHYPE_PLUGINS : undefined}
        urlTransform={getSafeLessonQuestionUrl}
      >
        {answer}
      </Streamdown>
    </TutorAnswerLinksContext>
  );
}
