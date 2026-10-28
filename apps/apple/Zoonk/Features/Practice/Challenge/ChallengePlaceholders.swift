import SwiftUI

// Placeholders for the Challenge feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct ChallengeScreen: View {
  let planItemId: String
  var sessionId: String? = nil

  var body: some View {
    RoutePlaceholder(name: "Challenge", systemImage: "flag.checkered", isTask: true)
  }
}
