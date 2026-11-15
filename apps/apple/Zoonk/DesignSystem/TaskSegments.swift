import SwiftUI

/// Main's `TaskSegment`: one screen or question of a task.
enum TaskSegment: Equatable {
  case ahead
  case current
  /// Read, or not graded right or wrong (a placement question, a statement left blank).
  case read
  case right
  case wrong
}

/// Main's `TaskHeaderSegments`: a task's progress under its bar, one segment per screen.
struct TaskSegments: View {
  let segments: [TaskSegment]
  let label: Text
  var value: Text?

  var body: some View {
    HStack(spacing: segments.count > 40 ? 1 : 3) {
      ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
        mark(segment)
          .frame(height: 4)
      }
    }
    .accessibilityElement()
    .accessibilityLabel(label)
    .accessibilityValue(value ?? Text(verbatim: ""))
  }

  @ViewBuilder
  private func mark(_ segment: TaskSegment) -> some View {
    let shape = RoundedRectangle(cornerRadius: 2, style: .continuous)

    switch segment {
    case .right: shape.fill(.success)
    case .wrong: shape.fill(.destructive)
    case .read: shape.fill(Color(.foreground).opacity(0.25))
    case .current: shape.strokeBorder(.success, lineWidth: 1)
    case .ahead: shape.fill(Color.surface3)
    }
  }
}

extension View {
  /// A task's progress under its bar, as wide as what's under it: the task's column, or both
  /// columns where the screen is two panes. On iPhone Duo it keeps to the page before the hinge.
  func taskSegmentsBar(_ segments: TaskSegments?) -> some View {
    modifier(TaskSegmentsBar(segments: segments))
  }
}

private struct TaskSegmentsBar: ViewModifier {
  let segments: TaskSegments?

  @State private var isSplit = false

  func body(content: Content) -> some View {
    content
      .onPreferenceChange(PaneSplitKey.self) { isSplit = $0 }
      .safeAreaBar(edge: .top) {
        if let segments {
          segments
            .frame(maxWidth: isSplit ? .infinity : 680)
            .lonePage()
            .scenePadding(.horizontal)
            .padding(.bottom, 4)
        }
      }
  }
}
