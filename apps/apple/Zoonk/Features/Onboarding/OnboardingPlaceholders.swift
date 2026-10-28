import SwiftUI

// Placeholders for the Onboarding feature's routes (see the lane notes' ROUTES.md). The feature's
// lane deletes this file when its screens land, keeping these names and initializers.

struct GoalStartScreen: View {
  var body: some View {
    RoutePlaceholder(name: "Start a goal", systemImage: "plus", isTask: true)
  }
}

struct GoalSetupScreen: View {
  let goalId: String

  var body: some View {
    RoutePlaceholder(name: "Goal setup", systemImage: "list.bullet.clipboard", isTask: true)
  }
}

struct CourseStartScreen: View {
  let courseId: String

  var body: some View {
    RoutePlaceholder(name: "Course start", systemImage: "plus.rectangle.on.rectangle", isTask: true)
  }
}
