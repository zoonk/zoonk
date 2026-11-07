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
