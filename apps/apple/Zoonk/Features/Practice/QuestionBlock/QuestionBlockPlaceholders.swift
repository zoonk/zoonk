import SwiftUI

// Placeholders for the QuestionBlock feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct QuestionBlockScreen: View {
  let sessionId: String
  let blockId: String

  var body: some View {
    RoutePlaceholder(name: "Question block", systemImage: "questionmark.circle", isTask: true)
  }
}
