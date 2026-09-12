import SwiftUI

struct CatalogActionsMenu: View {
  let showFeedback: () -> Void
  var course: Course? = nil
  var supportsLearningPlan = false

  var body: some View {
    Menu {
      if let course, supportsLearningPlan {
        if ["core", "language"].contains(course.format ?? "core") {
          Link(destination: courseWebURL(course).appending(component: "start")) {
            Label {
              Text(
                "Change learning path on web", tableName: "Courses",
                comment: "Opens guided course path editing on the website")
            } icon: {
              Image(systemName: "arrow.up.right")
            }
          }
        }
        Link(destination: courseWebURL(course).appending(component: "preferences")) {
          Label {
            Text(
              "Learning preferences on web", tableName: "Courses",
              comment: "Opens this course's learning preferences on the website")
          } icon: {
            Image(systemName: "slider.horizontal.3")
          }
        }
      }
      Button(action: showFeedback) {
        Label {
          Text(
            "Send feedback",
            tableName: "Courses",
            comment: "Opens a form for sending feedback about catalog content.")
        } icon: {
          Image(systemName: "bubble.left")
        }
      }
    } label: {
      Image(systemName: "ellipsis")
        .frame(width: 20, height: 20)
    }
    .buttonStyle(.bordered)
    .buttonBorderShape(.circle)
    .controlSize(.large)
    .accessibilityLabel(
      Text(
        "More options",
        tableName: "Courses",
        comment: "Accessibility label for secondary catalog actions."))
  }
}
