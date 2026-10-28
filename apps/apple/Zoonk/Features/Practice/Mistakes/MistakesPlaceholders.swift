import SwiftUI

// Placeholders for the Mistakes feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct MistakesScreen: View {
  var body: some View {
    RoutePlaceholder(name: "Mistakes notebook", systemImage: "square.and.pencil", isTask: false)
  }
}

struct MistakePracticeScreen: View {
  var skillId: String? = nil

  var body: some View {
    RoutePlaceholder(name: "Mistakes practice", systemImage: "square.and.pencil", isTask: true)
  }
}
