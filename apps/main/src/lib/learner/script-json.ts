/**
 * A value as JavaScript inside an inline `<script>`: JSON with `<` escaped, so no string in it
 * (a learner's id, a translated word) can close the script element.
 */
export function toScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", String.raw`<`);
}
