import SwiftUI

/// Mirrors main's `KIND_MARKS`: kinds doing the same job share a hue and differ by their symbol.
enum LearnKind {
  case challenge
  case conversation
  case essay
  case lesson
  case mindMap
  case mistakes
  case mock
  case practice
  case review

  var color: Color {
    switch self {
    case .lesson:
      .secondary
    case .mistakes, .practice, .review:
      .orange
    // No system color is an orange redder than review's, and system red sits beside wrong's pink.
    case .challenge, .mock:
      Color(.kindMock)
    case .conversation, .essay:
      .mint
    case .mindMap:
      .purple
    }
  }

  var systemImage: String {
    switch self {
    case .challenge: "figure.fencing"
    case .conversation: "bubble.left.and.bubble.right"
    case .essay: "pencil.line"
    case .lesson: "book"
    case .mindMap: "point.3.connected.trianglepath.dotted"
    case .mistakes: "square.and.pencil"
    case .mock: "timer"
    case .practice: "dumbbell"
    case .review: "arrow.counterclockwise"
    }
  }
}

struct KindMark: View {
  let kind: LearnKind

  var body: some View {
    Image(systemName: kind.systemImage)
      .foregroundStyle(kind.color)
      .accessibilityHidden(true)
  }
}

struct KindDot: View {
  let kind: LearnKind

  var body: some View {
    Image(systemName: "circle.fill")
      .imageScale(.small)
      .font(.caption2)
      .foregroundStyle(kind == .lesson ? Color(.tertiaryLabel) : kind.color)
      .accessibilityHidden(true)
  }
}
