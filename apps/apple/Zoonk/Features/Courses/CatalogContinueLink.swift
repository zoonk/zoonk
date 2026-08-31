import SwiftUI

struct CatalogContinueLink: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let continuation: CatalogContinuationTarget?
  let destination: CourseDestination
  let percentComplete: Int?

  var body: some View {
    NavigationLink(value: destination) {
      HStack(spacing: 8) {
        Image(systemName: "play.fill")

        actionTitle

        if let percentComplete {
          Spacer(minLength: 12)

          Text(percentComplete, format: .percent.scale(1))
            .font(.subheadline.weight(.semibold))
            .monospacedDigit()
        }
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.borderedProminent)
    .controlSize(.large)
    .frame(maxWidth: horizontalSizeClass == .regular ? 280 : .infinity)
    .accessibilityLabel(accessibilityTitle)
  }

  @ViewBuilder
  private var actionTitle: some View {
    switch catalogPrimaryAction(for: continuation) {
    case .start:
      Text(
        "Start",
        tableName: "Courses",
        comment: "Starts a course or chapter that has no learner progress.")
    case .continueLearning:
      Text(
        "Continue",
        tableName: "Courses",
        comment: "Continues a course or chapter from the learner's next lesson.")
    case .review:
      Text(
        "Review",
        tableName: "Courses",
        comment: "Reviews a completed course or chapter.")
    }
  }

  private var accessibilityTitle: Text {
    switch (catalogPrimaryAction(for: continuation), percentComplete) {
    case (.start, .some(let percentComplete)):
      Text(
        "Start, \(percentComplete)% complete",
        tableName: "Courses",
        comment: "Accessible start action followed by the course or chapter completion percent.")
    case (.continueLearning, .some(let percentComplete)):
      Text(
        "Continue, \(percentComplete)% complete",
        tableName: "Courses",
        comment:
          "Accessible continue action followed by the course or chapter completion percent.")
    case (.review, .some(let percentComplete)):
      Text(
        "Review, \(percentComplete)% complete",
        tableName: "Courses",
        comment: "Accessible review action followed by the course or chapter completion percent.")
    case (.start, nil):
      Text(
        "Start",
        tableName: "Courses",
        comment: "Starts a course or chapter that has no learner progress.")
    case (.continueLearning, nil):
      Text(
        "Continue",
        tableName: "Courses",
        comment: "Continues a course or chapter from the learner's next lesson.")
    case (.review, nil):
      Text(
        "Review",
        tableName: "Courses",
        comment: "Reviews a completed course or chapter.")
    }
  }
}
