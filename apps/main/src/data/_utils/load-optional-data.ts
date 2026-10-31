import { safeAsync } from "@zoonk/utils/error";

export async function loadOptionalData<Result>(
  load: () => Promise<Result>,
): Promise<Result | null> {
  const { data } = await safeAsync(load);

  return data;
}
