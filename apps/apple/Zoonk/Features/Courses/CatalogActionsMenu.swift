import SwiftUI

struct CatalogActionsMenu: View {
  let showFeedback: () -> Void

  var body: some View {
    Menu {
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
