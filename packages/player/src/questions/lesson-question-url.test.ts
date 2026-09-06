import { describe, expect, it } from "vitest";
import { getSafeLessonQuestionUrl } from "./lesson-question-url";

const JAVASCRIPT_URL = ["javascript", "alert(document.domain)"].join(":");

describe(getSafeLessonQuestionUrl, () => {
  it.each([
    "https://example.com/reference",
    "http://example.com/reference",
    "/courses/reference",
    "#lesson-summary",
    "streamdown:incomplete-link",
  ])("keeps safe lesson answer URL %s", (url) => {
    expect(getSafeLessonQuestionUrl(url)).toBe(url);
  });

  it.each([
    JAVASCRIPT_URL,
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "not a valid URL",
  ])("removes unsafe lesson answer URL %s", (url) => {
    expect(getSafeLessonQuestionUrl(url)).toBeNull();
  });
});
