import SwiftUI

// Placeholders for the MindMaps feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct MindMapsScreen: View {
  var body: some View {
    RoutePlaceholder(
      name: "Mind maps", systemImage: "point.3.connected.trianglepath.dotted", isTask: false)
  }
}

struct MindMapScreen: View {
  let chapterId: String

  var body: some View {
    RoutePlaceholder(
      name: "Mind map", systemImage: "point.3.connected.trianglepath.dotted", isTask: true)
  }
}
