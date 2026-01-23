"use client";

import { routing } from "@/i18n/routing";
import { createNavigation } from "next-intl/navigation";

// Re-export from the file that creates the `<Link />` component
// This is necessary for Radix components using `cloneElement`
// https://github.com/amannn/next-intl/issues/1271#issuecomment-2331863819
// https://github.com/amannn/next-intl/issues/1322
export const { Link: ClientLink } = createNavigation(routing);
