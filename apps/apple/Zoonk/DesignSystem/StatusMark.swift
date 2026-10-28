import SwiftUI

/// Where a thing in a list stands, the same in every list (main's `StatusMark`): a blue check once done, a
/// quiet fast-forward once skipped because the learner showed they know it, the learner's blue dot with a
/// halo for the one to do next, and a faint dot ahead. Every mark takes the same width so the rows' words
/// start in one place, and scales with the row's text. Decorative: the row's words say its state.
struct StatusMark: View {
  enum Status {
    case done
    case next
    case skipped
    case todo
  }

  let status: Status

  @ScaledMetric(relativeTo: .body) private var width = 20.0

  var body: some View {
    mark
      .frame(width: width)
      .accessibilityHidden(true)
  }

  @ViewBuilder
  private var mark: some View {
    switch status {
    case .done:
      Image(systemName: "checkmark")
        .fontWeight(.bold)
        .foregroundStyle(.success)
    case .next:
      Image(systemName: "smallcircle.filled.circle.fill")
        .symbolRenderingMode(.hierarchical)
        .imageScale(.small)
        .foregroundStyle(.success)
    case .skipped:
      Image(systemName: "forward.fill")
        .imageScale(.small)
        .font(.footnote)
        .foregroundStyle(.secondary)
    case .todo:
      Image(systemName: "circle.fill")
        .imageScale(.small)
        .font(.caption2)
        .foregroundStyle(.quaternary)
    }
  }
}
