import SwiftUI

// Placeholders for the Player feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct LessonPlayerScreen: View {
  let lessonId: String
  var sessionId: String? = nil

  var body: some View {
    RoutePlaceholder(name: "Lesson", systemImage: "book.pages", isTask: true)
  }
}
