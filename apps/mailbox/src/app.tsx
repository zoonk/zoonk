import { cn } from "@zoonk/ui/lib/utils";
import { useState } from "react";
import {
  Mailbox,
  MailboxActions,
  MailboxBody,
  MailboxButton,
  MailboxEmpty,
  MailboxHeader,
  MailboxIdentity,
  MailboxInbox,
  MailboxList,
  MailboxListItem,
  MailboxMessageButton,
  MailboxPreview,
  MailboxStatus,
  MailboxTitle,
} from "./components/mailbox";
import { type CapturedEmail } from "./email";
import { clearEmailInbox, useEmailInbox } from "./email-store";

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

const copy = {
  clearInbox: "Clear inbox",
  emailMessages: "Email messages",
  emptyMark: "@",
  inboxEmptyDescription: "Trigger an email in Main or API.",
  inboxEmptyTitle: "No messages yet",
  message: "Message",
  noBody: "This email has no body.",
  previewEmptyDescription: "Messages live in memory and disappear when this app stops.",
  previewEmptyTitle: "Your development emails will appear here.",
  received: "Received",
  replyTo: "Reply to",
  title: "Local mailbox",
  to: "To",
};

/**
 * Keeps the newest local email visible by default while preserving an older
 * explicit selection as new messages arrive during a testing flow.
 */
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
      <MailboxHeader>
        <MailboxIdentity>
          <MailboxTitle>{copy.title}</MailboxTitle>
          <MailboxStatus data-status={status}>
            <span aria-hidden="true" className={getStatusDotClassName(status)} />
            {getStatusLabel(status)}
          </MailboxStatus>
        </MailboxIdentity>

        <MailboxActions>
          <span className="text-muted-foreground font-mono text-[11px]">
            {getMessageCountLabel(emails.length)}
          </span>
          <MailboxButton disabled={emails.length === 0} onClick={handleClear}>
            {copy.clearInbox}
          </MailboxButton>
        </MailboxActions>
      </MailboxHeader>

      <MailboxBody>
        <MailboxInbox aria-label={copy.emailMessages}>
          <EmailList
            emails={emails}
            onSelect={setSelectedEmailId}
            selectedEmailId={selectedEmail?.id}
          />
        </MailboxInbox>

        {selectedEmail ? (
          <EmailPreview email={selectedEmail} />
        ) : (
          <MailboxEmpty className="grid min-h-full place-content-center px-10 py-16 text-center">
            <span
              className="border-border text-foreground mx-auto mb-5 grid size-12 place-items-center rounded-full border font-mono text-xl"
              aria-hidden="true"
            >
              {copy.emptyMark}
            </span>
            <p className="text-foreground mb-1.5 text-sm font-semibold">{copy.previewEmptyTitle}</p>
            <span className="text-[13px]">{copy.previewEmptyDescription}</span>
          </MailboxEmpty>
        )}
      </MailboxBody>
    </Mailbox>
  );
}

/** Keeps list rendering shallow while preserving semantic, keyboard-accessible message rows. */
function EmailList({
  emails,
  onSelect,
  selectedEmailId,
}: {
  emails: CapturedEmail[];
  onSelect: (emailId: string) => void;
  selectedEmailId?: string;
}) {
  if (emails.length === 0) {
    return (
      <MailboxEmpty className="px-5.5 py-7">
        <p className="text-foreground mb-1.5 text-sm font-semibold">{copy.inboxEmptyTitle}</p>
        <span className="text-[13px]">{copy.inboxEmptyDescription}</span>
      </MailboxEmpty>
    );
  }

  return (
    <MailboxList>
      {emails.map((email) => (
        <EmailListMessage
          email={email}
          isSelected={email.id === selectedEmailId}
          key={email.id}
          onSelect={onSelect}
        />
      ))}
    </MailboxList>
  );
}

/** Gives each message one selection action while keeping its visible metadata independently styled. */
function EmailListMessage({
  email,
  isSelected,
  onSelect,
}: {
  email: CapturedEmail;
  isSelected: boolean;
  onSelect: (emailId: string) => void;
}) {
  return (
    <MailboxListItem>
      <MailboxMessageButton aria-pressed={isSelected} onClick={() => onSelect(email.id)}>
        <span className="overflow-hidden text-sm font-semibold tracking-[-0.01em] text-ellipsis whitespace-nowrap">
          {email.subject}
        </span>
        <span className="text-muted-foreground overflow-hidden font-mono text-[10px] text-ellipsis whitespace-nowrap">
          {`${copy.to} ${email.to}`}
        </span>
        <time
          className="text-muted-foreground col-start-2 row-start-1 font-mono text-[10px]"
          dateTime={email.receivedAt}
        >
          {timeFormatter.format(new Date(email.receivedAt))}
        </time>
      </MailboxMessageButton>
    </MailboxListItem>
  );
}

/** Renders one selected message without allowing its HTML to affect the mailbox UI. */
function EmailPreview({ email }: { email: CapturedEmail }) {
  return (
    <MailboxPreview>
      <header className="border-border border-b px-5 pt-7 pb-6 md:px-[clamp(1.5rem,5vw,4.5rem)] md:pt-10.5 md:pb-7">
        <p className="text-muted-foreground mb-3 font-mono text-[10px] tracking-widest uppercase">
          {copy.message}
        </p>
        <h2 className="max-w-225 text-3xl leading-[1.04] font-semibold tracking-[-0.045em] md:text-[clamp(1.75rem,4vw,3.125rem)]">
          {email.subject}
        </h2>
        <dl className="text-muted-foreground mt-6 grid gap-3.5 font-mono text-[11px] md:mt-8 md:flex md:flex-wrap md:gap-x-8 md:gap-y-4">
          <div className="grid gap-1">
            <dt className="text-muted-foreground/70 tracking-[0.08em] uppercase">{copy.to}</dt>
            <dd className="text-foreground m-0">{email.to}</dd>
          </div>
          {email.replyTo ? (
            <div className="grid gap-1">
              <dt className="text-muted-foreground/70 tracking-[0.08em] uppercase">
                {copy.replyTo}
              </dt>
              <dd className="text-foreground m-0">{email.replyTo}</dd>
            </div>
          ) : null}
          <div className="grid gap-1">
            <dt className="text-muted-foreground/70 tracking-[0.08em] uppercase">
              {copy.received}
            </dt>
            <dd className="text-foreground m-0">
              {dateTimeFormatter.format(new Date(email.receivedAt))}
            </dd>
          </div>
        </dl>
      </header>

      <div className="p-5 md:p-[clamp(1.5rem,5vw,4.5rem)]">
        {email.htmlBody ? (
          <iframe
            className="border-border block min-h-95 w-full rounded-[3px] border bg-white md:min-h-105"
            referrerPolicy="no-referrer"
            sandbox=""
            srcDoc={email.htmlBody}
            title={`${email.subject} email body`}
          />
        ) : (
          <pre className="border-border bg-background m-0 min-h-95 w-full overflow-auto rounded-[3px] border p-7 font-mono text-sm leading-[1.65] whitespace-pre-wrap md:min-h-105">
            {email.textBody || copy.noBody}
          </pre>
        )}
      </div>
    </MailboxPreview>
  );
}

/** Resolves selection as a pure derivation so new mail needs no synchronizing effect. */
function getSelectedEmail({
  emails,
  selectedEmailId,
}: {
  emails: CapturedEmail[];
  selectedEmailId: string | null;
}): CapturedEmail | undefined {
  return emails.find((email) => email.id === selectedEmailId) ?? emails[0];
}

/** Gives the live indicator a clear failure label when the Vite API is unavailable. */
function getStatusLabel(status: "loading" | "ready" | "unavailable"): string {
  if (status === "unavailable") {
    return "Offline";
  }

  if (status === "loading") {
    return "Connecting";
  }

  return "Live";
}

/** Maps the transport state to shared semantic colors without coupling status logic to markup. */
function getStatusDotClassName(status: "loading" | "ready" | "unavailable"): string {
  return cn(
    "size-1.75 rounded-full",
    status === "ready" && "bg-success ring-success/15 ring-3",
    status === "loading" && "bg-warning",
    status === "unavailable" && "bg-destructive",
  );
}

/** Keeps the header count grammatical without adding localization machinery to a local tool. */
function getMessageCountLabel(count: number): string {
  return `${count} ${count === 1 ? "message" : "messages"}`;
}
