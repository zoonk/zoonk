import SwiftUI

/// The lesson's last screen, before it's saved. On a spread with help to offer, the map has the
/// leading page and the help the trailing one, where Ask opens beside it; without help it's one page.
struct LessonMapStage: View {
  @Environment(\.lessonTutor) private var tutor

  let store: LessonPlayerStore
  let state: LessonPlayerState
  let title: String
  let summary: LessonSummary

  var body: some View {
    stage
      .background { LessonPaper() }
  }

  @ViewBuilder
  private var stage: some View {
    if tutor.panel != nil, !store.isGuest {
      PaneSplit(isSpread: true) {
        mapPage
          .safeAreaBar(edge: .bottom) {
            if store.isAsking {
              actionBar
            }
          }
      } secondary: {
        if store.isAsking {
          LessonAskPanel(store: store, isBeside: true)
        } else {
          LessonPage(store: store) {
            LessonScreenHelp(store: store)
          }
          .safeAreaBar(edge: .bottom) { actionBar }
        }
      } single: {
        onePage
      }
    } else {
      onePage
        .lonePage()
    }
  }

  private var onePage: some View {
    mapPage
      .safeAreaBar(edge: .bottom) { actionBar.keepsOffFold() }
  }

  private var mapPage: some View {
    LessonPage(store: store) {
      LessonMapSection(title: title, summary: summary)
    }
    .modifier(TracksSpread(store: store))
  }

  private var actionBar: some View {
    LessonActionBar(store: store, state: state, step: nil)
  }
}

/// Ask opens beside the lesson only where the lesson is a spread.
private struct TracksSpread: ViewModifier {
  @Environment(\.isPaneSplit) private var isPaneSplit

  let store: LessonPlayerStore

  func body(content: Content) -> some View {
    content.onChange(of: isPaneSplit, initial: true) { _, isSplit in
      store.isSpread = isSplit
    }
  }
}

struct LessonMapSection: View {
  let title: String
  let summary: LessonSummary

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      Label {
        Text(LessonMapView.name)
      } icon: {
        Image(systemName: LessonMapView.symbol)
      }
      .chip()
      .accessibilityAddTraits(.isHeader)

      LessonMapView(title: title, summary: summary)
    }
  }
}

struct LessonMapSheet: View {
  @Environment(\.dismiss) private var dismiss

  let title: String
  let summary: LessonSummary

  var body: some View {
    NavigationStack {
      ScrollView {
        LessonMapView(title: title, summary: summary)
          .frame(maxWidth: .infinity, alignment: .leading)
          .scenePadding()
      }
      .navigationTitle(Text(LessonMapView.name))
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
    .presentationDetents([.medium, .large])
  }
}

/// Every idea shows its label and sentence at once: no color or motion.
struct LessonMapView: View {
  static let name = LocalizedStringResource(
    "Lesson map", table: "Player",
    comment:
      "A small diagram of this lesson's main ideas, drawn by the app. Not the chapter's mind map."
  )
  static let symbol = "point.3.connected.trianglepath.dotted"

  let title: String
  let summary: LessonSummary

  var body: some View {
    VStack(spacing: 16) {
      LessonMindMap(title: title, ideas: summary.ideas)

      if summary.shape == .nested {
        Text(
          "Each level sits inside the next one.", tableName: "Player",
          comment:
            "Under a lesson map whose ideas are levels, the smallest first, such as an organism inside a population."
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
      }
    }
  }
}

/// Two columns of ideas around the title, or one under it where large text or a narrow pane would
/// squeeze two.
private struct LessonMindMap: View {
  @Environment(\.stacksContent) private var isStacked
  @Environment(\.colorSchemeContrast) private var contrast
  @ScaledMetric(relativeTo: .subheadline) private var minimumIdeaWidth: CGFloat = 150

  let title: String
  let ideas: [LessonSummary.Idea]

  var body: some View {
    LessonMindMapLayout(
      slots: LessonIdeaSlot.slots(count: ideas.count),
      minimumColumnWidth: isStacked ? .infinity : minimumIdeaWidth
    ) {
      Text(title)
        .typeStyle(.body.weight(.semibold))
        .multilineTextAlignment(.center)
        .padding(.vertical, 8)
        .padding(.horizontal, 14)
        .background(.muted, in: .rect(cornerRadius: Radius.lg, style: .continuous))
        .anchorPreference(key: LessonMindMapAnchors.self, value: .bounds) {
          LessonMindMapAnchors(center: $0)
        }
        .accessibilitySortPriority(1)

      ForEach(Array(ideas.enumerated()), id: \.offset) { index, idea in
        LessonMindMapIdea(number: index + 1, idea: idea)
          .anchorPreference(key: LessonMindMapAnchors.self, value: .bounds) {
            LessonMindMapAnchors(ideas: [index: $0])
          }
      }
    }
    .backgroundPreferenceValue(LessonMindMapAnchors.self) { anchors in
      GeometryReader { proxy in
        if let center = anchors.center.map({ proxy[$0] }) {
          Self.connectors(from: center, to: anchors.ideas.values.map { proxy[$0] })
            .stroke(contrast == .increased ? Color(.foreground) : .input, lineWidth: 1.5)
        }
      }
    }
    .accessibilityElement(children: .contain)
  }

  private static func connectors(from center: CGRect, to ideas: [CGRect]) -> Path {
    var path = Path()

    for idea in ideas {
      let isAbove = idea.maxY <= center.minY
      let side: CGFloat =
        abs(idea.midX - center.midX) < 1 ? 0 : idea.midX < center.midX ? -1 : 1
      let start = CGPoint(
        x: center.midX + side * center.width / 4, y: isAbove ? center.minY : center.maxY)
      let end = CGPoint(x: idea.midX, y: isAbove ? idea.maxY : idea.minY)
      let middle = (start.y + end.y) / 2

      path.move(to: start)
      path.addCurve(
        to: end, control1: CGPoint(x: start.x, y: middle), control2: CGPoint(x: end.x, y: middle))
    }

    return path
  }
}

/// Main's mind-map grid: the title in the center's row and each idea in its slot, the ideas in a row
/// as tall as its tallest and a lone one half the width, centered. Where a column would be narrower
/// than `minimumColumnWidth`, the title comes first and the ideas follow it in one column. Its
/// subviews are the title, then the ideas in order.
private struct LessonMindMapLayout: Layout {
  let slots: [LessonIdeaSlot]
  let minimumColumnWidth: CGFloat

  private let spacing = CGSize(width: 10, height: 18)
  private let maximumTitleWidth: CGFloat = 260

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? 320
    return CGSize(width: width, height: frames(width: width, subviews).map(\.maxY).max() ?? 0)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    for (subview, frame) in zip(subviews, frames(width: bounds.width, subviews)) {
      subview.place(
        at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
        proposal: ProposedViewSize(frame.size))
    }
  }

  /// The title's frame, then each idea's.
  private func frames(width: CGFloat, _ subviews: Subviews) -> [CGRect] {
    guard let title = subviews.first else {
      return []
    }

    let column = (width - spacing.width) / 2
    let isSplit = column >= minimumColumnWidth
    let titleSize = title.sizeThatFits(
      ProposedViewSize(width: min(width, maximumTitleWidth), height: nil))
    let ideas: [(row: Int, x: CGFloat, width: CGFloat)] = slots.enumerated().map { index, slot in
      guard isSplit else {
        return (index + 1, 0, width)
      }

      switch slot.column {
      case ..<0: return (slot.row, 0, column)
      case 0: return (slot.row, (width - column) / 2, column)
      default: return (slot.row, column + spacing.width, column)
      }
    }
    var rowHeights = [0: titleSize.height]

    for (subview, idea) in zip(subviews.dropFirst(), ideas) {
      let height = subview.sizeThatFits(ProposedViewSize(width: idea.width, height: nil)).height
      rowHeights[idea.row] = max(rowHeights[idea.row, default: 0], height)
    }

    var tops: [Int: CGFloat] = [:]
    var top: CGFloat = 0

    for row in rowHeights.keys.sorted() {
      tops[row] = top
      top += rowHeights[row, default: 0] + spacing.height
    }

    let titleFrame = CGRect(
      origin: CGPoint(x: (width - titleSize.width) / 2, y: tops[0, default: 0]), size: titleSize)

    return [titleFrame]
      + ideas.map { idea in
        CGRect(
          x: idea.x, y: tops[idea.row, default: 0], width: idea.width,
          height: rowHeights[idea.row, default: 0])
      }
  }
}

private struct LessonMindMapIdea: View {
  let number: Int
  let idea: LessonSummary.Idea

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 8) {
        if let icon = idea.icon {
          LessonIconImage(icon: icon, size: 32)
        }

        VStack(alignment: .leading, spacing: 0) {
          Text(number, format: .number)
            .typeStyle(.data)
            .foregroundStyle(.faint)

          if let label = idea.label {
            Text(label)
              .typeStyle(.body.weight(.semibold))
              .foregroundStyle(Color(.foreground))
          }
        }
      }

      LessonRichText(idea.text)
        .typeStyle(.body)
        .foregroundStyle(idea.label == nil ? Color(.foreground) : .mutedForeground)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(12)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .panel()
    .accessibilityElement(children: .combine)
  }
}

private struct LessonMindMapAnchors: PreferenceKey {
  var center: Anchor<CGRect>?
  var ideas: [Int: Anchor<CGRect>] = [:]

  static let defaultValue = LessonMindMapAnchors()

  static func reduce(value: inout LessonMindMapAnchors, nextValue: () -> LessonMindMapAnchors) {
    let next = nextValue()
    value.center = next.center ?? value.center
    value.ideas.merge(next.ideas) { _, new in new }
  }
}
