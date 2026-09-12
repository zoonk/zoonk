const LEARNING_REQUEST_DRAFT_KEY = "learning-request-draft";
const LEGACY_REQUEST_FRAGMENT = "#request=";

/** The legacy redirect carries its draft in a fragment so the next server request stays clean. */
function restoreLegacyRequest() {
  if (!location.hash.startsWith(LEGACY_REQUEST_FRAGMENT)) {
    return null;
  }

  const encodedPrompt = location.hash.slice(LEGACY_REQUEST_FRAGMENT.length);
  let prompt = encodedPrompt;

  try {
    prompt = decodeURIComponent(encodedPrompt);
  } catch {
    /** Keep malformed old bookmarks editable instead of discarding their draft. */
  }

  saveLearningRequestDraft(prompt);
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  return prompt;
}

export function saveLearningRequestDraft(prompt: string) {
  try {
    sessionStorage.setItem(LEARNING_REQUEST_DRAFT_KEY, prompt);
  } catch {
    /** The request still works when session storage is unavailable. */
  }
}

export function readLearningRequestDraft() {
  const legacyPrompt = restoreLegacyRequest();

  if (legacyPrompt !== null) {
    return legacyPrompt;
  }

  try {
    return sessionStorage.getItem(LEARNING_REQUEST_DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}
