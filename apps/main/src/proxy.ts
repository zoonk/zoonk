import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/((?!api|auth/callback|_next|_vercel|\\.well-known/workflow|149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3|.*\\..*).*)",
    "/((?!api|auth|_next|_vercel)[\\w-]+)?/start/learn/(.+)",
  ],
};
