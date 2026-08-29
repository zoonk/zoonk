import SwiftUI

struct CatalogDetailActions: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let continuation: CatalogContinuationTarget?
  let destination: CourseDestination?
  let percentComplete: Int?
  let showFeedback: () -> Void

  var body: some View {
    HStack(spacing: 8) {
      if let destination {
        CatalogContinueLink(
          continuation: continuation,
          destination: destination,
          percentComplete: percentComplete)
      } else {
        Spacer(minLength: 0)
      }

      CatalogActionsMenu(showFeedback: showFeedback)

      if horizontalSizeClass == .regular, destination != nil {
        Spacer(minLength: 0)
      }
    }
    .padding(
      .leading,
      CatalogDetailLayout.actionLeadingInset(
        for: horizontalSizeClass,
        dynamicTypeSize: dynamicTypeSize))
  }
}
