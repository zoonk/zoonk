import SwiftUI

// Placeholders for the Mock feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct MockChooserScreen: View {
  var body: some View {
    RoutePlaceholder(name: "Mock exam", systemImage: "timer", isTask: false)
  }
}

struct MockScreen: View {
  let blockId: String
  var sessionId: String? = nil

  var body: some View {
    RoutePlaceholder(name: "Mock exam", systemImage: "timer", isTask: true)
  }
}

struct PlacementMockScreen: View {
  let goalId: String

  var body: some View {
    RoutePlaceholder(name: "Placement mock", systemImage: "timer", isTask: true)
  }
}
