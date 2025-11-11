const CACHE_TAG_LIMIT = 256;

export function cacheTagCatalog() {
  return "catalog";
}

export function cacheTagCourses() {
  return "courses";
}

export function cacheTagCourseSuggestions({ prompt }: { prompt: string }) {
  return `suggestions:${prompt}`.slice(0, CACHE_TAG_LIMIT);
}

export function cacheTagDisplayName() {
  return "display-name";
}

export function cacheTagFeedback() {
  return "feedback";
}

export function cacheTagFollow() {
  return "follow";
}

export function cacheTagHelp() {
  return "help";
}

export function cacheTagHome() {
  return "home";
}

export function cacheTagLanguage() {
  return "language";
}

export function cacheTagLearn() {
  return "learn";
}

export function cacheTagLogin() {
  return "login";
}

export function cacheTagMyCourses() {
  return "my-courses";
}

export function cacheTagPrivacy() {
  return "privacy";
}

export function cacheTagSettings() {
  return "settings";
}

export function cacheTagSubscription() {
  return "subscription";
}

export function cacheTagTerms() {
  return "terms";
}

export function cacheTagUsers() {
  return "users";
}
