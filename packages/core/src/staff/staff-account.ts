/** Staff are platform admins who aren't banned. Callers read the user fresh, so losing it applies at once. */
export function isStaffAccount(user: { banned?: boolean | null; role?: string | null }): boolean {
  return user.role === "admin" && !user.banned;
}
