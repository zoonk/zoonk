import SwiftUI

/// Shown instead of an empty curriculum while the server is still writing it, for example right
/// after a content reset. Checking again reuses the page's own refresh.
struct CatalogGenerationInProgressView: View {
  let checkAgain: RefreshAction?
  let title: Text

  var body: some View {
    ContentUnavailableView {
      Label {
        title
      } icon: {
        Image(systemName: "sparkles")
      }
    } description: {
      Text(
        "Check again in a minute to see them.",
        tableName: "Courses",
        comment: "Guidance while a course or chapter is still being written.")
    } actions: {
      if let checkAgain {
        Button {
          Task {
            await checkAgain()
          }
        } label: {
          Text(
            "Check again",
            tableName: "Courses",
            comment: "Reloads a course or chapter whose content is still being written.")
        }
        .buttonStyle(.bordered)
      }
    }
  }
}
