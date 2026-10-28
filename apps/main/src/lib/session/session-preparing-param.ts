export const SESSION_PREPARING_PARAM = "preparing";

export function readSessionPreparingParam(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}
