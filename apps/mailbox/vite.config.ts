import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createEmailInboxPlugin } from "./src/server/email-inbox-plugin";

const DEFAULT_MAILBOX_PORT = 3202;
const port = Number(process.env.PORT) || DEFAULT_MAILBOX_PORT;

export default defineConfig({
  plugins: [react(), createEmailInboxPlugin()],
  server: { host: "127.0.0.1", port, strictPort: true },
});
