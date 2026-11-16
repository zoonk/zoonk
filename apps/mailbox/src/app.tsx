import { Button } from "@zoonk/ui/components/button";
import { PageTitle, PageTop } from "@zoonk/ui/components/page-top";
import { SwapLabel } from "@zoonk/ui/components/swap-label";
import { useClipboard } from "@zoonk/ui/hooks/clipboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import {
  Mailbox,
  MailboxBody,
  MailboxEmpty,
  MailboxInbox,
  MailboxList,
  MailboxListItem,
  MailboxMessageButton,
  MailboxPreview,
  MailboxStatus,
  MailboxTop,
} from "./components/mailbox";
import { type CapturedEmail } from "./email";
import { type EmailInboxStatus, clearEmailInbox, useEmailInbox } from "./email-store";
import { findSignInCode } from "./sign-in-code";

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
});

const copy = {
  clearInbox: "Clear inbox",
  copied: "Copied",
  copyCode: "Copy",
  emailMessages: "Emails",
  emptyDescription: "Log in to the app and your code shows up here.",
  emptyTitle: "No emails yet",
  noBody: "This email has no body.",
  offlineDescription: "Run pnpm dev in the repository. This page reconnects on its own.",
  offlineTitle: "Can't reach the mailbox server",
  replyTo: "Reply to",
  signInCode: "Login code",
  title: "Local mailbox",
  to: "To",
};

export function App() {
  const { emails, status } = useEmailInbox();
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const selectedEmail = getSelectedEmail({ emails, selectedEmailId });

  const handleClear = () => {
    setSelectedEmailId(null);
    void clearEmailInbox();
  };

  return (
    <Mailbox>
      <MailboxTop>
        <PageTop
          actions={
            emails.length > 0 && (
              <Button onClick={handleClear} size="bar" type="button" variant="outline">
                {copy.clearInbox}
              </Button>
            )
          }
          back={
            <MailboxStatus data-status={status}>
              <span aria-hidden="true" className={getStatusDotClassName(status)} />
              {getStatusLabel(status)}
            </MailboxStatus>
          }
        >
          <PageTitle>{copy.title}</PageTitle>
        </PageTop>
      </MailboxTop>

      {selectedEmail ? (
        <MailboxBody>
          <MailboxInbox aria-label={copy.emailMessages}>
            <MailboxList>
              {emails.map((email) => (
                <EmailListMessage
                  email={email}
                  isSelected={email.id === selectedEmail.id}
                  key={email.id}
                  onSelect={setSelectedEmailId}
                />
              ))}
            </MailboxList>
          </MailboxInbox>

          <EmailPreview email={selectedEmail} key={selectedEmail.id} />
        </MailboxBody>
      ) : (
        <EmptyInbox status={status} />
      )}
    </Mailbox>
  );
}

function EmptyInbox({ status }: { status: EmailInboxStatus }) {
  if (status === "loading") {
    return null;
  }

  const isOffline = status === "unavailable";

  return (
    <MailboxEmpty>
      <p className="text-foreground text-sm font-semibold">
        {isOffline ? copy.offlineTitle : copy.emptyTitle}
      </p>
      <p className="text-compact">{isOffline ? copy.offlineDescription : copy.emptyDescription}</p>
    </MailboxEmpty>
  );
}

function EmailListMessage({
  email,
  isSelected,
  onSelect,
}: {
  email: CapturedEmail;
  isSelected: boolean;
  onSelect: (emailId: string) => void;
}) {
  const code = findSignInCode(email);

  return (
    <MailboxListItem>
      <MailboxMessageButton aria-pressed={isSelected} onClick={() => onSelect(email.id)}>
        <span className="line-clamp-2 text-sm font-semibold tracking-[-0.01em] text-balance">
          {email.subject}
        </span>
        <time
          className="text-muted-foreground justify-self-end text-xs tabular-nums"
          dateTime={email.receivedAt}
        >
          {timeFormatter.format(new Date(email.receivedAt))}
        </time>
        <span className="text-muted-foreground truncate text-xs leading-5">
          {`${copy.to} ${email.to}`}
        </span>
        {code && (
          <span className="justify-self-end font-mono text-sm font-semibold tabular-nums">
            {code}
          </span>
        )}
      </MailboxMessageButton>
    </MailboxListItem>
  );
}

function SignInCode({ code }: { code: string }) {
  const { copy: copyText, isCopied } = useClipboard();

  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-xs">{copy.signInCode}</p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <p className="font-mono text-4xl font-semibold tracking-[0.08em] tabular-nums">{code}</p>
        <Button
          onClick={() => void copyText(code).catch(() => null)}
          type="button"
          variant="outline"
        >
          <SwapLabel
            current={isCopied ? copy.copied : copy.copyCode}
            labels={[copy.copyCode, copy.copied]}
          />
        </Button>
      </div>
    </div>
  );
}

function EmailPreview({ email }: { email: CapturedEmail }) {
  const code = findSignInCode(email);

  return (
    <MailboxPreview>
      <header className="border-border flex flex-col gap-4 border-b px-4 py-5 md:px-6">
        {code && <SignInCode code={code} />}

        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{email.subject}</h2>
          <p className="text-muted-foreground text-xs">
            {`${copy.to} ${email.to}`}
            {email.replyTo ? ` · ${copy.replyTo} ${email.replyTo}` : ""}
            {" · "}
            <time dateTime={email.receivedAt}>
              {dateTimeFormatter.format(new Date(email.receivedAt))}
            </time>
          </p>
        </div>
      </header>

      <div className="p-4 md:p-6">
        {email.htmlBody ? (
          <EmailBody email={email} />
        ) : (
          <pre className="border-border bg-background m-0 min-h-95 w-full overflow-auto rounded-xl border p-5 font-sans text-sm leading-normal wrap-anywhere whitespace-pre-wrap md:min-h-105">
            {email.textBody || copy.noBody}
          </pre>
        )}
      </div>
    </MailboxPreview>
  );
}

function EmailBody({ email }: { email: CapturedEmail }) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const element = frame.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (element.contentDocument?.body) {
        element.style.height = `${element.contentDocument.body.scrollHeight}px`;
      }
    });

    const observe = () => {
      observer.disconnect();

      if (element.contentDocument?.body) {
        observer.observe(element.contentDocument.body);
      }
    };

    element.addEventListener("load", observe);
    observe();

    return () => {
      observer.disconnect();
      element.removeEventListener("load", observe);
    };
  }, []);

  return (
    <div className="border-border rounded-xl border bg-white p-5">
      <iframe
        className="block w-full border-0 bg-white"
        ref={frame}
        referrerPolicy="no-referrer"
        sandbox="allow-same-origin"
        srcDoc={`${email.htmlBody}<style>html,body{height:auto!important;min-height:0!important}body{margin:0}a{overflow-wrap:anywhere!important;word-break:break-word!important}</style>`}
        title={`${email.subject} email body`}
      />
    </div>
  );
}

function getSelectedEmail({
  emails,
  selectedEmailId,
}: {
  emails: CapturedEmail[];
  selectedEmailId: string | null;
}): CapturedEmail | undefined {
  return emails.find((email) => email.id === selectedEmailId) ?? emails[0];
}

function getStatusLabel(status: EmailInboxStatus): string {
  if (status === "unavailable") {
    return "Offline";
  }

  if (status === "loading") {
    return "Connecting";
  }

  return "Connected";
}

function getStatusDotClassName(status: EmailInboxStatus): string {
  return cn(
    "size-1.75 rounded-full",
    status === "ready" && "bg-success",
    status === "loading" && "bg-warning",
    status === "unavailable" && "bg-destructive",
  );
}
