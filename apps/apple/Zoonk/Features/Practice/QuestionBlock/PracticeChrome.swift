import SwiftUI

enum PracticeSegment: Equatable {
  case ahead
  case current
  /// A placement question or a statement left blank: not graded right or wrong.
  case read
  case right
  case wrong
}

struct PracticeSegmentsBar: View {
  let segments: [PracticeSegment]
  let index: Int

  var body: some View {
    HStack(spacing: 3) {
      ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
        Capsule()
          .fill(color(segment))
          .frame(height: 4)
      }
    }
    .accessibilityElement()
    .accessibilityLabel(
      Text(
        "Question \(min(index + 1, segments.count)) of \(segments.count)", tableName: "Practice",
        comment: "VoiceOver label of a run's progress: the question in view and how many there are."
      ))
  }

  private func color(_ segment: PracticeSegment) -> Color {
    switch segment {
    case .right: .success
    case .wrong: .destructive
    case .read: Color(.systemGray3)
    case .current: .primary
    case .ahead: Color(.systemFill)
    }
  }
}

enum PracticeLayout {
  static let readableWidth: CGFloat = 680
}

struct PracticeTaskLayout<Stimulus: View, Response: View, Actions: View>: View {
  @Environment(\.practiceActionsHidden) private var actionsHidden
  private let segments: [PracticeSegment]?
  private let index: Int
  private let spreads: Bool
  private let stimulus: () -> Stimulus
  private let response: () -> Response
  private let actions: () -> Actions

  init(
    segments: [PracticeSegment]? = nil, index: Int = 0,
    @ViewBuilder stimulus: @escaping () -> Stimulus,
    @ViewBuilder response: @escaping () -> Response,
    @ViewBuilder actions: @escaping () -> Actions
  ) {
    self.segments = segments
    self.index = index
    spreads = true
    self.stimulus = stimulus
    self.response = response
    self.actions = actions
  }

  var body: some View {
    Group {
      if spreads {
        QuestionSpread(readableWidth: PracticeLayout.readableWidth, spacing: 20) {
          segmentsBar
        } stimulus: {
          stimulus()
        } response: {
          response()
        } actions: {
          actionsBar
        }
      } else {
        QuestionColumn(readableWidth: PracticeLayout.readableWidth, spacing: 20) {
          segmentsBar
        } content: {
          stimulus()
        } actions: {
          actionsBar
        }
      }
    }
    .background(Color(.systemGroupedBackground))
  }

  @ViewBuilder private var segmentsBar: some View {
    if let segments, !segments.isEmpty {
      PracticeSegmentsBar(segments: segments, index: index)
        .frame(maxWidth: PracticeLayout.readableWidth)
        .padding(.horizontal)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
    }
  }

  @ViewBuilder private var actionsBar: some View {
    if !actionsHidden {
      VStack(spacing: 10) {
        actions()
      }
      .frame(maxWidth: PracticeLayout.readableWidth)
      .padding(.horizontal)
      .padding(.vertical, 12)
      .frame(maxWidth: .infinity)
    }
  }
}

extension PracticeTaskLayout where Response == EmptyView {
  init(
    segments: [PracticeSegment]? = nil, index: Int = 0,
    @ViewBuilder content: @escaping () -> Stimulus,
    @ViewBuilder actions: @escaping () -> Actions
  ) {
    self.segments = segments
    self.index = index
    spreads = false
    stimulus = content
    response = { EmptyView() }
    self.actions = actions
  }
}

/// Switching between a spread and one column recreates the pages, so the answer lives above the
/// spread.
struct QuestionSpread<Header: View, Stimulus: View, Response: View, Actions: View>: View {
  let readableWidth: CGFloat
  let spacing: CGFloat
  @ViewBuilder let header: () -> Header
  @ViewBuilder let stimulus: () -> Stimulus
  @ViewBuilder let response: () -> Response
  @ViewBuilder let actions: () -> Actions

  var body: some View {
    PaneSplit {
      ScrollingPage(readableWidth: readableWidth, spacing: spacing, content: stimulus)
        .pageHeader(header)
    } secondary: {
      ScrollingPage(readableWidth: readableWidth, spacing: spacing, content: response)
        .safeAreaBar(edge: .bottom, content: actions)
    } single: {
      QuestionColumn(readableWidth: readableWidth, spacing: spacing, header: header) {
        stimulus()
        response()
      } actions: {
        actions()
      }
      // So a question drawn in two parts draws itself whole, even inside another split's pane.
      .environment(\.isPaneSplit, false)
    }
  }
}

struct QuestionColumn<Header: View, Content: View, Actions: View>: View {
  let readableWidth: CGFloat
  let spacing: CGFloat
  @ViewBuilder let header: () -> Header
  @ViewBuilder let content: () -> Content
  @ViewBuilder let actions: () -> Actions

  var body: some View {
    ScrollingPage(readableWidth: readableWidth, spacing: spacing, content: content)
      .pageHeader(header)
      .safeAreaBar(edge: .bottom) {
        actions().keepsOffFold()
      }
  }
}

extension View {
  /// A page without a header gets no bar: a top bar around an empty view takes the page's free
  /// height and pushes its content down out of sight.
  @ViewBuilder
  fileprivate func pageHeader<Header: View>(_ header: () -> Header) -> some View {
    if Header.self == EmptyView.self {
      self
    } else {
      safeAreaBar(edge: .top, content: header)
    }
  }
}

private struct ScrollingPage<Content: View>: View {
  let readableWidth: CGFloat
  let spacing: CGFloat
  @ViewBuilder let content: () -> Content

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: spacing) {
        content()
      }
      .frame(maxWidth: readableWidth, alignment: .leading)
      .frame(maxWidth: .infinity)
      .scenePadding()
    }
    .scrollDismissesKeyboard(.interactively)
  }
}

extension EnvironmentValues {
  @Entry var practiceActionsHidden = false
}

extension View {
  func practiceActionsHidden(_ hidden: Bool) -> some View {
    environment(\.practiceActionsHidden, hidden)
  }
}

struct PracticeMainButton: View {
  let title: LocalizedStringResource
  var isBusy = false
  var isDisabled = false
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 8) {
        if isBusy {
          ProgressView()
        }
        Text(title)
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
    .disabled(isDisabled || isBusy)
    .keyboardShortcut(.defaultAction)
  }
}

struct PracticeActionRow<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(spacing: 12) {
        content
      }
      .environment(\.practiceActionsSideBySide, true)

      VStack(spacing: 10) {
        content
      }
    }
  }
}

extension EnvironmentValues {
  @Entry var practiceActionsSideBySide = false
}

struct PracticeSecondaryButton: View {
  @Environment(\.practiceActionsSideBySide) private var sideBySide

  let title: LocalizedStringResource
  var systemImage: String?
  var isDisabled = false
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Group {
        if let systemImage {
          Label {
            Text(title)
          } icon: {
            Image(systemName: systemImage)
          }
        } else {
          Text(title)
        }
      }
      .frame(maxWidth: sideBySide ? nil : .infinity)
    }
    // Beside the main action it keeps its own width, so its label stays on one line; the row
    // stacks instead when that doesn't fit.
    .fixedSize(horizontal: sideBySide, vertical: false)
    .buttonStyle(.glass)
    .controlSize(.large)
    .disabled(isDisabled)
  }
}

struct PracticeSaveError: View {
  let retry: () -> Void

  var body: some View {
    HStack {
      Text(
        "Your answer wasn't saved. Check your connection.", tableName: "Practice",
        comment: "Shown over a run's actions when an answer or the finish didn't reach the server."
      )
      .font(.subheadline)
      .foregroundStyle(.destructive)

      Spacer()

      Button(action: retry) {
        Text("Try again", tableName: "Practice", comment: "Sends an answer that didn't save again.")
      }
      .buttonStyle(.bordered)
    }
  }
}

/// Answers are saved as they go, so it just leaves.
struct PracticeCloseButton: View {
  var label: LocalizedStringResource = LocalizedStringResource(
    "Close. Your answers are saved.", table: "Practice",
    comment: "VoiceOver label of a practice task's close button.")
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Label {
        Text(label)
      } icon: {
        Image(systemName: "xmark")
      }
    }
    .keyboardShortcut(.cancelAction)
  }
}

/// Readouts never say "+0".
struct PracticeResultHeader: View {
  let title: LocalizedStringResource
  var detail: LocalizedStringResource?
  var correct: Int?
  var total: Int?
  var brainPower = 0
  var facts: [String] = []
  var reached: PracticeReached = .nothing

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      VStack(alignment: .leading, spacing: 6) {
        Text(title).font(.largeTitle.bold())
        if let detail {
          Text(detail).foregroundStyle(.secondary)
        }
      }

      HStack(spacing: 24) {
        if let correct, let total, total > 0 {
          Readout(
            value: Text("\(correct)/\(total)"),
            label: Text(
              "Right", tableName: "Practice",
              comment: "Readout label: right answers out of the total."))
        }

        if brainPower > 0 {
          Readout(
            value: Text(brainPower, format: .number),
            label: Text(
              "Brain Power", tableName: "Practice", comment: "Readout label: Brain Power earned."),
            tint: .brain)
        }
      }

      ForEach(facts, id: \.self) { fact in
        Text(fact).font(.subheadline).foregroundStyle(.secondary)
      }

      if let level = reached.level {
        Label {
          Text(
            "You reached level \(level.level).", tableName: "Practice",
            comment: "A run took the learner to a new level.")
        } icon: {
          Image(systemName: "circle.fill")
        }
        .foregroundStyle(.primary)
      }

      if let energy = reached.energy {
        Label {
          Text(
            "Energy reached \(energy)%.", tableName: "Practice",
            comment: "A run's answers raised Energy to a new tenth.")
        } icon: {
          Image(systemName: "bolt.fill")
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct Readout: View {
  let value: Text
  let label: Text
  var tint: Color = .primary

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      value.font(.title.monospacedDigit().weight(.semibold)).foregroundStyle(tint)
      label.font(.footnote).foregroundStyle(.secondary)
    }
    .accessibilityElement(children: .combine)
  }
}

/// Failures say so with a retry, never as stuck.
enum PracticeLoad<Value> {
  case failed(APIError)
  case loaded(Value)
  case loading
}

struct PracticeLoadFailureView: View {
  let error: APIError
  let retry: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        if error == .network {
          Text(
            "You're offline", tableName: "Practice",
            comment: "Title when a practice screen can't load offline.")
        } else {
          Text(
            "This didn't load", tableName: "Practice",
            comment: "Title when a practice screen can't load.")
        }
      } icon: {
        Image(systemName: error == .network ? "wifi.slash" : "exclamationmark.triangle")
      }
    } description: {
      Text(
        "Check your connection and try again.", tableName: "Practice",
        comment: "Description when a practice screen can't load.")
    } actions: {
      Button(action: retry) {
        Text("Try again", tableName: "Practice", comment: "Loads a practice screen again.")
      }
      .buttonStyle(.bordered)
    }
  }
}
