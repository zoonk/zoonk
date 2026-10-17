/**
 * The session screen's `?preparing`: the learner's tap asked to prepare a step whose lesson the
 * plan hasn't picked yet (a chapter with none written), so the screen waits for it, as for a lesson
 * being written, instead of offering Start again.
 */
export const SESSION_PREPARING_PARAM = "preparing";

export function readSessionPreparingParam(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}
