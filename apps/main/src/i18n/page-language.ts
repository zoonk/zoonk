/**
 * The page's language, read when an action is sent, as the time zone is: the actions are built once,
 * outside React. The server checks it.
 */
export function getPageLanguage(): string {
  return document.documentElement.lang;
}
