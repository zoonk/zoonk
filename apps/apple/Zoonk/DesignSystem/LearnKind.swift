import SwiftUI

/// The kinds of things a learner meets, each with one color and one symbol everywhere (main's `KIND_MARKS`).
/// A lesson, the default, is neutral; kinds doing the same job share a hue and differ by their symbol.
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
    // Going back over what was learned.
    case .mistakes, .practice, .review:
      .orange
    // Testing what the learner knows: an orange redder than review's. No system color has it, and the
    // system red sits beside wrong's pink.
    case .challenge, .mock:
      Color(.kindMock)
    // Making something yourself.
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

/// A kind's symbol in its color, where kinds sit side by side (the day's queue, the missions, a plan's
/// events). Decorative: the words beside it name the thing.
struct KindMark: View {
  let kind: LearnKind

  var body: some View {
    Image(systemName: kind.systemImage)
      .foregroundStyle(kind.color)
      .accessibilityHidden(true)
  }
}

/// A kind as a small dot in its color, the quieter mark of a row in a queue. Decorative.
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
