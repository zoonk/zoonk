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
      .background {
        if store.lesson?.isTagged == true {
          LessonPaper()
        }
      }
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
    switch summary.shape {
    case .hub where summary.isTagged && LessonMindMapRows.fits(summary.ideas.count):
      LessonMindMap(title: title, ideas: summary.ideas)
    case .hub: LessonMapHub(title: title, ideas: summary.ideas)
    case .nested: LessonMapNested(ideas: summary.ideas)
    }
  }
}

private struct LessonMapIdea: View {
  let idea: LessonSummary.Idea

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 10) {
      if let icon = idea.icon {
        LessonIconImage(icon: icon, size: 32)
          .alignmentGuide(.firstTextBaseline) { $0.height / 2 + 6 }
      }

      VStack(alignment: .leading, spacing: 2) {
        if let label = idea.label {
          Text(label)
            .font(.headline)

          LessonRichText(idea.text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        } else {
          LessonRichText(idea.text)
        }
      }
    }
    .accessibilityElement(children: .combine)
  }
}

/// Large text, a narrow pane and maps with more ideas than it holds read as the tree instead.
private struct LessonMindMap: View {
  @Environment(\.stacksContent) private var isStacked
  @ScaledMetric(relativeTo: .subheadline) private var minimumIdeaWidth: CGFloat = 150

  let title: String
  let ideas: [LessonSummary.Idea]

  private let spacing: CGFloat = 10

  var body: some View {
    if isStacked {
      LessonMapHub(title: title, ideas: ideas)
    } else {
      let width = minimumIdeaWidth * 2 + spacing

      ViewThatFits(in: .horizontal) {
        branches
          .frame(minWidth: width, idealWidth: width, maxWidth: .infinity)
        LessonMapHub(title: title, ideas: ideas)
      }
    }
  }

  private var branches: some View {
    let rows = LessonMindMapRows(count: ideas.count)

    return Grid(horizontalSpacing: spacing, verticalSpacing: 18) {
      ForEach(rows.above, id: \.self) { row in
        ideaRow(row)
      }

      GridRow {
        Text(title)
          .font(.subheadline.weight(.semibold))
          .multilineTextAlignment(.center)
          .padding(.vertical, 8)
          .padding(.horizontal, 14)
          .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
          .frame(maxWidth: 260)
          .anchorPreference(key: LessonMindMapAnchors.self, value: .bounds) {
            LessonMindMapAnchors(center: $0)
          }
          .gridCellColumns(2)
          .accessibilitySortPriority(1)
      }

      ForEach(rows.below, id: \.self) { row in
        ideaRow(row)
      }
    }
    .backgroundPreferenceValue(LessonMindMapAnchors.self) { anchors in
      GeometryReader { proxy in
        if let center = anchors.center.map({ proxy[$0] }) {
          Self.connectors(from: center, to: anchors.ideas.values.map { proxy[$0] })
            .stroke(.separator, lineWidth: 1.5)
        }
      }
    }
    .accessibilityElement(children: .contain)
  }

  private func ideaRow(_ row: [Int]) -> some View {
    GridRow {
      ForEach(row, id: \.self) { index in
        LessonMindMapIdea(number: index + 1, idea: ideas[index])
          .anchorPreference(key: LessonMindMapAnchors.self, value: .bounds) {
            LessonMindMapAnchors(ideas: [index: $0])
          }
          .gridCellColumns(row.count == 1 ? 2 : 1)
      }
    }
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

private struct LessonMindMapIdea: View {
  let number: Int
  let idea: LessonSummary.Idea

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)

    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 8) {
        if let icon = idea.icon {
          LessonIconImage(icon: icon, size: 32)
        }

        VStack(alignment: .leading, spacing: 0) {
          Text(number, format: .number)
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)

          if let label = idea.label {
            Text(label)
              .font(.subheadline.weight(.semibold))
          }
        }
      }

      LessonRichText(idea.text)
        .font(.footnote)
        .foregroundStyle(idea.label == nil ? .primary : .secondary)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(10)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(.background, in: shape)
    .overlay {
      shape.strokeBorder(.separator)
    }
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

private struct LessonMapHub: View {
  /// Where a branch's tick meets its first line: about half a lowercase letter above the baseline.
  @ScaledMetric(relativeTo: .body) private var tickRise: CGFloat = 5

  let title: String
  let ideas: [LessonSummary.Idea]

  var body: some View {
    let tickRise = tickRise

    VStack(alignment: .leading, spacing: 0) {
      Text(title)
        .font(.headline)
        .padding(.vertical, 6)
        .padding(.horizontal, 11)
        .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 9, style: .continuous))

      VStack(alignment: .leading, spacing: 14) {
        ForEach(Array(ideas.enumerated()), id: \.offset) { _, idea in
          HStack(alignment: .firstTextBaseline, spacing: 5) {
            Rectangle()
              .fill(.separator)
              .frame(width: 9, height: 1)
              .alignmentGuide(.firstTextBaseline) { $0[.bottom] + tickRise }
              .anchorPreference(key: LastTick.self, value: .bounds) { $0 }

            LessonMapIdea(idea: idea)
          }
        }
      }
      .padding(.top, 14)
      .overlayPreferenceValue(LastTick.self, alignment: .topLeading) { tick in
        GeometryReader { proxy in
          if let tick {
            Rectangle()
              .fill(.separator)
              .frame(width: 1, height: proxy[tick].midY)
          }
        }
      }
      .padding(.leading, 12)
    }
  }
}

private struct LastTick: PreferenceKey {
  static let defaultValue: Anchor<CGRect>? = nil

  static func reduce(value: inout Anchor<CGRect>?, nextValue: () -> Anchor<CGRect>?) {
    value = nextValue() ?? value
  }
}

/// Boxes inside boxes, the smallest first, so reading order is the order the lesson zooms out in.
private struct LessonMapNested: View {
  let ideas: [LessonSummary.Idea]

  var body: some View {
    if !ideas.isEmpty {
      LessonMapLevel(ideas: ideas[...], depth: 0)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
          Text(
            "Each level sits inside the next one.", tableName: "Player",
            comment: "VoiceOver, before the levels of a lesson map drawn as boxes inside boxes"))
    }
  }
}

private struct LessonMapLevel: View {
  /// From the innermost to this level, the last.
  let ideas: ArraySlice<LessonSummary.Idea>
  let depth: Int

  private var isInnermost: Bool { ideas.count == 1 }
  private var radius: CGFloat { [14, 11, 9, 7][min(depth, 3)] }
  private var padding: CGFloat { [12, 11, 10, 10][min(depth, 3)] }

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)

    VStack(alignment: .leading, spacing: 10) {
      if !isInnermost {
        LessonMapLevel(ideas: ideas.dropLast(), depth: depth + 1)
      }

      if let idea = ideas.last {
        LessonMapIdea(idea: idea)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(padding)
    .background {
      if isInnermost {
        shape.fill(Color(.tertiarySystemFill))
      }
    }
    .overlay {
      if !isInnermost {
        shape.strokeBorder(.separator)
      }
    }
  }
}
