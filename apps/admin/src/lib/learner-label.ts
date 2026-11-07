export function getLearnerLabel(user: {
  email: string;
  name: string | null;
  username: string | null;
}): string {
  return user.name || user.username || user.email;
}
