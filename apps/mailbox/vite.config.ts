import react from "@vitejs/plugin-react";
import { getLocalInboxConfig } from "@zoonk/mailer/local-inbox";
import { defineConfig } from "vite";
import { createEmailInboxPlugin } from "./src/server/email-inbox-plugin";

const { port: localInboxPort } = getLocalInboxConfig();

export default defineConfig({
  plugins: [react(), createEmailInboxPlugin()],
  server: { host: "127.0.0.1", port: localInboxPort, strictPort: true },
});
