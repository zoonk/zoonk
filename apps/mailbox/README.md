# Local mailbox

The mailbox starts with `pnpm dev` and opens at its clone-scoped Portless URL, such as `http://mailbox.zoonk.localhost:1355`. Development emails are kept in memory for the lifetime of the Vite process. It has no build or deployment task and is never used when a mail provider key is configured.

`pnpm dev:lan` exposes the mailbox at a `.local` URL for devices on the same network. `pnpm dev:direct` preserves the fixed `http://127.0.0.1:3202` fallback. The development email transport receives the mailbox's full public URL, so it follows Portless without knowing the Vite process port.
