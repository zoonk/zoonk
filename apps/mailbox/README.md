# Local mailbox

The mailbox starts with `pnpm dev` and opens at `http://127.0.0.1:3202`. Development emails are kept in memory for the lifetime of the Vite process. It has no build or deployment task and is never used when a mail provider key is configured.

Set `MAILBOX_PORT` on the full development command when parallel work needs another port, for example `MAILBOX_PORT=4317 pnpm dev`. The mailbox app and development email transport use the same value.
