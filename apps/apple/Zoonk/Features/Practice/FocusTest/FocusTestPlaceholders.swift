import SwiftUI

// Placeholders for the FocusTest feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct FocusTestScreen: View {
  var goalId: String? = nil

  var body: some View {
    RoutePlaceholder(name: "Focus test", systemImage: "scope", isTask: true)
  }
}
