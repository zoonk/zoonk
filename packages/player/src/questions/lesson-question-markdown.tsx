"use client";

import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
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
// KaTeX's styles load with the tutor's answers, the only place math renders as HTML, not on every page.
import "katex/dist/katex.min.css";
import { type PlayerLinkComponent } from "../player-context";
import { getSafeLessonQuestionUrl } from "./lesson-question-url";
import { isTutorAppPath, readTutorBlockLink } from "./tutor-app-links";

const DISALLOWED_ANSWER_ELEMENTS = ["img"] as const;
const LESSON_QUESTION_PLUGINS = { math, mermaid };

/**
 * Uses the app's accessible dialog primitive for external links because
 * Streamdown's default confirmation surface does not manage dialog focus.
 */
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

/**
 * How a buddy answer links the app: through the host's own link, and one of today's blocks through
 * the host's way of opening it (as Today does), on a plain click; a click that opens a new tab or
 * window follows the link. `verified`: the text is the answer as the server saved it, its links
 * checked against the ones it was given; until then (while it streams, or when it failed) every
 * link reads as its words.
 */
export type TutorAnswerLinks = {
  Link: PlayerLinkComponent;
  openBlock?: (blockId: string) => void;
  verified: boolean;
};

/** A buddy answer reads no HTML of its own: the default plugins but the one that renders it raw. */
const BUDDY_REHYPE_PLUGINS = [defaultRehypePlugins.sanitize, defaultRehypePlugins.harden].flatMap(
  (plugin) => (plugin ? [plugin] : []),
);

function isPlainClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** The links of the buddy answer being drawn (see `TutorAnswerLinks`); null for the lesson tutor's. */
const TutorAnswerLinksContext = createContext<TutorAnswerLinks | null>(null);

/**
 * A link in a buddy answer: a link of the app only when the answer is verified and the link has
 * the shape of one the app gives (`isTutorAppPath`); anything else, its words. The renderer sees
 * every form a link takes (inline, reference, autolink, a bare address), so none gets past it.
 */
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

/** How a buddy answer draws its links: every one through `TutorAnswerLink`. */
const TUTOR_ANSWER_COMPONENTS: Components = { a: TutorAnswerLink };

export function LessonQuestionMarkdown({
  answer,
  appLinks,
  isAnimating,
  isStreaming,
}: {
  answer: string;
  /** A buddy answer's links (see `TutorAnswerLinks`); a lesson tutor's answer has none. */
  appLinks?: TutorAnswerLinks;
  isAnimating: boolean;
  isStreaming: boolean;
}) {
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
        plugins={LESSON_QUESTION_PLUGINS}
        rehypePlugins={appLinks ? BUDDY_REHYPE_PLUGINS : undefined}
        urlTransform={getSafeLessonQuestionUrl}
      >
        {answer}
      </Streamdown>
    </TutorAnswerLinksContext>
  );
}
