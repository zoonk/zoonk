type PathActiveParams = {
  href: string;
  pathname: string;
  exact?: boolean;
};

export function isPathActive({
  href,
  pathname,
  exact = false,
}: PathActiveParams) {
  if (exact) {
    return href === pathname;
  }

  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
}
