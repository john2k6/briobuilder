import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Redirige vers /fr ou /en selon la langue du navigateur.
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
