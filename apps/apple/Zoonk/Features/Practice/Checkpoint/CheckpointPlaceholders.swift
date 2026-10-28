import SwiftUI

// Placeholders for the Checkpoint feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct CheckpointScreen: View {
  let blockId: String
  var sessionId: String? = nil

  var body: some View {
    RoutePlaceholder(name: "Checkpoint", systemImage: "flag", isTask: true)
  }
}
