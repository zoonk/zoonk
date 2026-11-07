import SwiftUI

enum PracticeLayout {
  static let readableWidth: CGFloat = 680
}

private enum PracticeTaskKind {
  case spread
  case result
  /// The way on stays with what it acts on: under it, on the page before a hinge, with the page
  /// after it blank.
  case oneDecision
}

struct PracticeTaskLayout<Stimulus: View, Response: View, Actions: View>: View {
  @Environment(\.practiceActionsHidden) private var actionsHidden
  private let kind: PracticeTaskKind
  private let segments: [TaskSegment]?
  private let index: Int
  private let stimulus: () -> Stimulus
  private let response: () -> Response
  private let actions: () -> Actions

  init(
    isResult: Bool = false, segments: [TaskSegment]? = nil, index: Int = 0,
    @ViewBuilder stimulus: @escaping () -> Stimulus,
    @ViewBuilder response: @escaping () -> Response,
    @ViewBuilder actions: @escaping () -> Actions
  ) {
    self.init(
      kind: isResult ? .result : .spread, segments: segments, index: index, stimulus: stimulus,
      response: response, actions: actions)
  }

  fileprivate init(
    kind: PracticeTaskKind, segments: [TaskSegment]?, index: Int,
    stimulus: @escaping () -> Stimulus,
    response: @escaping () -> Response,
    actions: @escaping () -> Actions
  ) {
    self.kind = kind
    self.segments = segments
    self.index = index
    self.stimulus = stimulus
    self.response = response
    self.actions = actions
  }

  var body: some View {
    Group {
      if kind == .oneDecision {
        QuestionColumn(readableWidth: PracticeLayout.readableWidth, spacing: 20) {
          segmentsBar
        } content: {
          stimulus()
        } actions: {
          actionsBar
        }
        .lonePage()
      } else {
        QuestionSpread(
          readableWidth: PracticeLayout.readableWidth, spacing: 20, isSpread: kind == .spread
        ) {
          segmentsBar
        } stimulus: {
          stimulus()
        } response: {
          response()
        } actions: {
          actionsBar
        }
      }
    }
    .background(Color(.systemBackground))
  }

  @ViewBuilder private var segmentsBar: some View {
    if let segments, !segments.isEmpty {
      TaskSegments(
        segments: segments,
        label: Text(
          "Question \(min(index + 1, segments.count)) of \(segments.count)", tableName: "Practice",
          comment:
            "VoiceOver label of a run's progress: the question in view and how many there are.")
      )
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

/// A result, or a screen with one decision, such as an intro, a wait or a note. A run's step that
/// asks nothing keeps the spread init, its way on where each answer's was.
extension PracticeTaskLayout where Response == EmptyView {
  init(
    isResult: Bool = false,
    @ViewBuilder content: @escaping () -> Stimulus,
    @ViewBuilder actions: @escaping () -> Actions
  ) {
    self.init(
      kind: isResult ? .result : .oneDecision, segments: nil, index: 0, stimulus: content,
      response: { EmptyView() }, actions: actions)
  }
}

/// Switching between a spread and one column recreates the pages, so the answer lives above the
/// spread.
struct QuestionSpread<Header: View, Stimulus: View, Response: View, Actions: View>: View {
  let readableWidth: CGFloat
  let spacing: CGFloat
  var isSpread = true
  @ViewBuilder let header: () -> Header
  @ViewBuilder let stimulus: () -> Stimulus
  @ViewBuilder let response: () -> Response
  @ViewBuilder let actions: () -> Actions

  var body: some View {
    PaneSplit(isSpread: isSpread) {
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
      .safeAreaBar(edge: .bottom, content: actions)
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
  var systemImage: String?
  var isBusy = false
  var isDisabled = false
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 8) {
        if isBusy {
          ProgressView()
            .controlSize(.small)
        }
        if let systemImage {
          Image(systemName: systemImage)
            .accessibilityHidden(true)
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

enum PracticeFocus: Hashable {
  case answer
  case check
  case next
  case notSure
  case reveal
}

/// `move(to:)` sets both kinds of focus: a button takes keyboard focus only under Full Keyboard
/// Access, and VoiceOver focus only while VoiceOver runs, so it never moves a touch learner's.
struct PracticeFocusState {
  let keyboard: FocusState<PracticeFocus?>.Binding
  let voiceOver: AccessibilityFocusState<PracticeFocus?>.Binding

  func has(_ control: PracticeFocus) -> Bool {
    keyboard.wrappedValue == control || voiceOver.wrappedValue == control
  }

  func move(to control: PracticeFocus) {
    keyboard.wrappedValue = control
    voiceOver.wrappedValue = control
  }
}

extension EnvironmentValues {
  @Entry var practiceFocus: PracticeFocusState?
}

extension View {
  func practiceFocus(_ control: PracticeFocus?) -> some View {
    modifier(PracticeFocusTag(control: control))
  }
}

private struct PracticeFocusTag: ViewModifier {
  let control: PracticeFocus?
  @Environment(\.practiceFocus) private var focus

  func body(content: Content) -> some View {
    if let control, let focus {
      content
        .focused(focus.keyboard, equals: control)
        .accessibilityFocused(focus.voiceOver, equals: control)
    } else {
      content
    }
  }
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
    .buttonStyle(.outline)
    .controlSize(.large)
    .disabled(isDisabled)
  }
}

struct PracticeSaveError: View {
  let retry: () -> Void

  var body: some View {
    HStack {
      FailureLine(
        message: LocalizedStringResource(
          "Your answer wasn't saved. Check your connection.", table: "Practice",
          comment:
            "Shown over a run's actions when an answer or the finish didn't reach the server.")
      )
      .typeStyle(.body)

      Spacer()

      Button(action: retry) {
        Text("Try again", tableName: "Practice", comment: "Sends an answer that didn't save again.")
      }
      .buttonStyle(.outline)
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

struct PracticeResultTitle: View {
  let title: LocalizedStringResource
  var detail: LocalizedStringResource?

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(title).typeStyle(.heroTitle)
      if let detail {
        Text(detail).foregroundStyle(.mutedForeground)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// Readouts never say "+0".
struct PracticeResultNumbers: View {
  var correct: Int?
  var total: Int?
  var brainPower = 0
  var facts: [String] = []
  var day: DayResult?

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      FlowLayout(spacing: 32, alignment: .firstTextBaseline) {
        if let correct, let total, total > 0 {
          MomentReadout {
            Text("\(correct)/\(total)")
          } words: {
            Text(
              "Right", tableName: "Practice",
              comment: "Readout label: right answers out of the total.")
          }
        }

        if brainPower > 0 {
          MomentReadout(tint: .brainText) {
            EarnedNumber(value: brainPower)
          } words: {
            Text(
              "Brain Power", tableName: "Practice", comment: "Readout label: Brain Power earned.")
          }
        }
      }

      ForEach(facts, id: \.self) { fact in
        Text(fact).typeStyle(.note).foregroundStyle(.mutedForeground)
      }

      if let day, !day.isEmpty {
        DayMomentSections(result: day)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// Failures say so with a retry, never as stuck.
enum PracticeLoad<Value> {
  case failed(APIError)
  case loaded(Value)
  case loading
}

/// Opens another place instead of a screen with nothing to show, as main redirects. Only while it's
/// on screen, so a read that ends after the learner left never moves them.
struct PracticeRedirect: View {
  let open: () -> Void

  var body: some View {
    ProgressView()
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .onAppear(perform: open)
  }
}

struct PracticeLoadFailureView: View {
  let error: APIError
  let retry: () -> Void

  var body: some View {
    if error == .notFound {
      NotFoundView()
    } else {
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
        .buttonStyle(.outline)
      }
      .lonePage()
    }
  }
}
