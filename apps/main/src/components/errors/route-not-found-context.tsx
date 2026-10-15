"use client";

import { createContext, use } from "react";

const RouteNotFoundContext = createContext<React.ReactNode>(null);

/** The layout owns its missing-page UI so the boundary and page share its client code. */
export function RouteNotFoundProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  return <RouteNotFoundContext value={fallback}>{children}</RouteNotFoundContext>;
}

/** Next's native not-found boundary reads the UI supplied by its layout. */
export function RouteNotFoundFallback() {
  const fallback = use(RouteNotFoundContext);

  if (fallback === null) {
    throw new Error("RouteNotFoundFallback requires RouteNotFoundProvider");
  }

  return fallback;
}
