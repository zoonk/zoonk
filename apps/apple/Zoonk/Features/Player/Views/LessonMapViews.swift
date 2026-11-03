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
      .font(.caption.monospaced())
      .foregroundStyle(.secondary)
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

/// Every idea shows its label and sentence at once: no icons, color or motion.
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
    case .hub: LessonMapHub(title: title, ideas: summary.ideas)
    case .nested: LessonMapNested(ideas: summary.ideas)
    }
  }
}

private struct LessonMapIdea: View {
  let idea: LessonSummary.Idea

  var body: some View {
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
    .accessibilityElement(children: .combine)
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
