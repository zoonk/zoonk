"use client";

import { isTutorAppPath, readTutorBlockLink } from "@zoonk/core/lesson-questions/app-links";
import { DisplayMath } from "@zoonk/learn/rich-text/display-math";
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
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { ExternalLinkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ComponentProps, type MouseEvent, createContext, use, useState } from "react";
import {
  type Components,
  type ExtraProps,
  type LinkSafetyModalProps,
  Streamdown,
  defaultRehypePlugins,
} from "streamdown";
import { type PlayerLinkComponent } from "../player-context";
import { getSafeLessonQuestionUrl } from "./lesson-question-url";
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

/**
 * Set `verified` only after the saved answer's links have been checked against their allowlist.
 * `openBlock` resolves to false when it couldn't open, to `changed` when nothing opened because the
 * step isn't free to start anymore, and to true otherwise.
 */
export type TutorAnswerLinks = {
  Link: PlayerLinkComponent;
  openBlock?: (blockId: string) => Promise<boolean | "changed">;
  verified: boolean;
};

// Buddy answers must never render raw HTML.
const BUDDY_REHYPE_PLUGINS = [defaultRehypePlugins.sanitize, defaultRehypePlugins.harden].flatMap(
  (plugin) => (plugin ? [plugin] : []),
);

function isPlainClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

type AnswerLinks = Omit<TutorAnswerLinks, "openBlock"> & {
  openBlock?: (blockId: string) => void;
  openingBlockId: string | null;
};

const TutorAnswerLinksContext = createContext<AnswerLinks | null>(null);

function TutorAnswerLink({ children, href }: ComponentProps<"a"> & ExtraProps) {
  const links = use(TutorAnswerLinksContext);

  if (!links?.verified || !href || !isTutorAppPath(href)) {
    return children;
  }

  const { Link, openBlock, openingBlockId } = links;
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
    <Link
      aria-busy={(blockId !== null && blockId === openingBlockId) || undefined}
      className="aria-busy:opacity-60"
      href={href}
      onClick={onClick}
      prefetch={false}
    >
      {children}
    </Link>
  );
}

/** KaTeX's MathML for a formula on its own line: `<span class="katex"><math display="block">`. */
function isDisplayMath(node: ExtraProps["node"]): boolean {
  return (
    node?.children.some(
      (child) =>
        child.type === "element" &&
        child.tagName === "math" &&
        child.properties.display === "block",
    ) ?? false
  );
}

function AnswerSpan({ node, ...props }: ComponentProps<"span"> & ExtraProps) {
  if (isDisplayMath(node)) {
    return (
      <DisplayMath>
        <span {...props} />
      </DisplayMath>
    );
  }

  return <span {...props} />;
}

const ANSWER_COMPONENTS: Components = { span: AnswerSpan };

const TUTOR_ANSWER_COMPONENTS: Components = { a: TutorAnswerLink, span: AnswerSpan };

function BlockOpenFailed() {
  const t = useExtracted();

  return (
    <p className="text-destructive-text mt-2 text-sm" role="alert">
      {t("We couldn't open this step. Try again.")}
    </p>
  );
}

function BlockUnavailable() {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground mt-2 text-sm">
      {t({
        description:
          "Under a buddy answer whose link to a step of the day no longer opens: the step was done, skipped or taken off the plan since",
        message: "This step isn't available anymore.",
      })}
    </p>
  );
}

// Streamdown's code and table scrollers carry their own border and background, which the sideways
// fade would fade with them, so their outer card is the one frame. A table keeps its words whole
// and scrolls instead of breaking them letter by letter.
const TUTOR_MARKDOWN_CLASS = cn(
  "min-w-0 wrap-anywhere [&_a]:underline [&_a]:underline-offset-4",
  "**:data-[streamdown=code-block]:bg-background **:data-[streamdown=code-block-body]:scroll-fade-x **:data-[streamdown=code-block-body]:border-0 **:data-[streamdown=code-block-body]:bg-transparent",
  "**:data-[streamdown=table-wrapper]:bg-background [&_[data-streamdown=table-wrapper]>div:has(>table)]:scroll-fade-x **:data-[streamdown=table-wrapper]:wrap-normal [&_[data-streamdown=table-wrapper]>div:has(>table)]:border-0 [&_[data-streamdown=table-wrapper]>div:has(>table)]:bg-transparent",
);

/** Admin renders answers without an intl provider, so only parts shown after a click may translate. */
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
  const [openingBlockId, setOpeningBlockId] = useState<string | null>(null);
  const [opened, setOpened] = useState<boolean | "changed" | null>(null);

  const openBlock = appLinks?.openBlock;

  // One open at a time per answer, so an earlier tap's result never replaces a later one's.
  const links: AnswerLinks | null = appLinks
    ? {
        ...appLinks,
        openBlock:
          openBlock &&
          ((blockId) => {
            if (openingBlockId) {
              return;
            }

            setOpeningBlockId(blockId);
            setOpened(null);

            // Not a transition: React would hold a navigation the learner starts meanwhile until the
            // open settles, and then the open would win.
            void safeAsync(() => openBlock(blockId)).then(({ data }) => {
              setOpeningBlockId(null);
              setOpened(data ?? false);
            });
          }),
        openingBlockId,
      }
    : null;

  return (
    <TutorAnswerLinksContext value={links}>
      <Streamdown
        animated={isAnimating}
        className={TUTOR_MARKDOWN_CLASS}
        components={appLinks ? TUTOR_ANSWER_COMPONENTS : ANSWER_COMPONENTS}
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

      {opened === false && <BlockOpenFailed />}

      <div role="status">{opened === "changed" && <BlockUnavailable />}</div>
    </TutorAnswerLinksContext>
  );
}
