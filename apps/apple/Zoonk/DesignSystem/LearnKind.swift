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
      .mutedForeground
    case .mistakes, .practice, .review:
      Color(.kindReview)
    case .challenge, .mock:
      Color(.kindMock)
    case .conversation, .essay:
      Color(.kindConversation)
    case .mindMap:
      Color(.kindMindMap)
    }
  }

  var dotColor: Color {
    self == .lesson ? .faint : color
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

/// A row that opens a place passes that place's `symbol` in the kind's color.
struct KindMark: View {
  let kind: LearnKind
  var symbol: String?

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibility
  @ScaledMetric(relativeTo: .body) private var column = MarkColumnMetrics.width

  var body: some View {
    let size = symbolSize

    // A symbol wider than the rows' mark column (practice's dumbbell, a call's bubbles) shrinks
    // to it, so its row's title starts where the others' do.
    if size.width > column {
      Image(systemName: systemImage)
        .resizable()
        .scaledToFit()
        .typeStyle(.rowTitle)
        .frame(width: column, height: size.height * column / size.width)
        .foregroundStyle(kind.color)
        .accessibilityHidden(true)
    } else {
      Image(systemName: systemImage)
        .typeStyle(.rowTitle)
        .imageScale(.medium)
        .foregroundStyle(kind.color)
        .accessibilityHidden(true)
    }
  }

  private var systemImage: String {
    symbol ?? kind.systemImage
  }

  private var symbolSize: CGSize {
    let font = TypeStyle.rowTitle.uiFont(dynamicTypeSize, legibility: legibility)
    let configuration = UIImage.SymbolConfiguration(font: font, scale: .medium)
    return UIImage(systemName: systemImage, withConfiguration: configuration)?.size ?? .zero
  }
}

struct KindDot: View {
  let kind: LearnKind

  var body: some View {
    Image(systemName: "circle.fill")
      .imageScale(.small)
      .typeStyle(.small)
      .foregroundStyle(kind.dotColor)
      .accessibilityHidden(true)
  }
}
