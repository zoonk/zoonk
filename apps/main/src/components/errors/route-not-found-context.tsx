"use client";

import { createContext, use } from "react";

const RouteNotFoundContext = createContext<React.ReactNode>(null);

export function RouteNotFoundProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  return <RouteNotFoundContext value={fallback}>{children}</RouteNotFoundContext>;
}

export function RouteNotFoundFallback() {
  const fallback = use(RouteNotFoundContext);

  if (fallback === null) {
    throw new Error("RouteNotFoundFallback requires RouteNotFoundProvider");
  }

  return fallback;
}
