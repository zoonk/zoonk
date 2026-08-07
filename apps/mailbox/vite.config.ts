import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createEmailInboxPlugin } from "./src/server/email-inbox-plugin";

export default defineConfig({
  plugins: [react(), createEmailInboxPlugin()],
  server: { host: "127.0.0.1", port: 3202, strictPort: true },
});
