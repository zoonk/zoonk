import SwiftUI

/// Main's `TaskActionBar`: a task's buttons in one row under its column, the main one taking the
/// room the others leave. Put it in the task's bottom `safeAreaBar`.
struct TaskActionBar<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    HStack(spacing: 10) {
      content
    }
    .taskColumn()
  }
}

extension View {
  /// Main's task column: at most 680pt wide, centered on the screen, inside the scene's margins.
  func taskColumn(alignment: Alignment = .center) -> some View {
    frame(maxWidth: 680, alignment: alignment)
      .frame(maxWidth: .infinity)
      .scenePadding()
  }
}
