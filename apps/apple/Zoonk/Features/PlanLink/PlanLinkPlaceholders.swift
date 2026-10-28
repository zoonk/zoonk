import SwiftUI

// Placeholders for the PlanLink feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct PlanLinkScreen: View {
  let planId: String

  var body: some View {
    RoutePlaceholder(name: "Shared plan", systemImage: "link", isTask: true)
  }
}
