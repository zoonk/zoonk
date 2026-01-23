export function parseFormField(formData: FormData, field: string): string | null {
  const value = formData.get(field);

  if (typeof value === "string") {
    return value.trim();
  }

  return null;
}
