import SwiftUI

// Placeholders for the GoalContent feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct SubjectScreen: View {
  let subjectKey: String

  var body: some View {
    RoutePlaceholder(name: "Subject", systemImage: "books.vertical", isTask: false)
  }
}

struct ChapterScreen: View {
  let chapterId: String

  var body: some View {
    RoutePlaceholder(name: "Chapter", systemImage: "book", isTask: false)
  }
}

struct LanguageUnitScreen: View {
  let chapterId: String

  var body: some View {
    RoutePlaceholder(name: "Unit", systemImage: "character.book.closed", isTask: false)
  }
}
