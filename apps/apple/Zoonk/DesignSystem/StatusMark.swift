import SwiftUI

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
