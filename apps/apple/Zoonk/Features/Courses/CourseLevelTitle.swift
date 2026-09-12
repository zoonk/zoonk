import Foundation

func courseLevelTitle(_ level: String) -> LocalizedStringResource {
  switch level {
  case "overview":
    LocalizedStringResource("Overview", table: "Courses", comment: "A short course overview")
  case "basic":
    LocalizedStringResource("Basics", table: "Courses", comment: "Foundational course chapters")
  case "intermediate":
    LocalizedStringResource(
      "Intermediate", table: "Courses", comment: "Intermediate course chapters")
  case "advanced":
    LocalizedStringResource("Advanced", table: "Courses", comment: "Advanced course chapters")
  case "a1":
    LocalizedStringResource(
      "A1 · Getting started", table: "Courses",
      comment: "CEFR A1 course level with a plain language description")
  case "a2":
    LocalizedStringResource(
      "A2 · Everyday situations", table: "Courses",
      comment: "CEFR A2 course level with a plain language description")
  case "b1":
    LocalizedStringResource(
      "B1 · Independent conversations", table: "Courses",
      comment: "CEFR B1 course level with a plain language description")
  case "b2":
    LocalizedStringResource(
      "B2 · Detailed conversations", table: "Courses",
      comment: "CEFR B2 course level with a plain language description")
  case "c1":
    LocalizedStringResource(
      "C1 · Flexible communication", table: "Courses",
      comment: "CEFR C1 course level with a plain language description")
  case "c2":
    LocalizedStringResource(
      "C2 · Subtle meanings", table: "Courses",
      comment: "CEFR C2 course level with a plain language description")
  default:
    LocalizedStringResource("Chapters", table: "Courses", comment: "Course chapter list heading")
  }
}
