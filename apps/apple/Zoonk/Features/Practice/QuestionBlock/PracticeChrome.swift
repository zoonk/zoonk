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
  private let fillsHeight: Bool
  private let stimulus: () -> Stimulus
  private let response: () -> Response
  private let actions: () -> Actions
  /// The bar's note over its buttons, as the bottom bar's, so the buttons never move when it shows.
  private var note: BarNote?

  /// `note` is the bar's one line, right over its buttons, as `bottomBar`'s. `fillsHeight`: one
  /// column is at least the screen's height, so a word bank waits at its bottom, as in a lesson.
  init(
    isResult: Bool = false, segments: [TaskSegment]? = nil, index: Int = 0, note: BarNote? = nil,
    fillsHeight: Bool = false,
    @ViewBuilder stimulus: @escaping () -> Stimulus,
    @ViewBuilder response: @escaping () -> Response,
    @ViewBuilder actions: @escaping () -> Actions
  ) {
    self.init(
      kind: isResult ? .result : .spread, segments: segments, index: index, note: note,
      fillsHeight: fillsHeight, stimulus: stimulus, response: response, actions: actions)
  }

  fileprivate init(
    kind: PracticeTaskKind, segments: [TaskSegment]?, index: Int, note: BarNote? = nil,
    fillsHeight: Bool = false,
    stimulus: @escaping () -> Stimulus,
    response: @escaping () -> Response,
    actions: @escaping () -> Actions
  ) {
    self.kind = kind
    self.segments = segments
    self.index = index
    self.note = note
    self.fillsHeight = fillsHeight
    self.stimulus = stimulus
    self.response = response
    self.actions = actions
  }

  var body: some View {
    // A top bar around nothing takes the page's free height, so a screen without segments gets none.
    if let segmentsBar {
      layout.taskSegmentsBar(segmentsBar)
    } else {
      layout
    }
  }

  private var layout: some View {
    Group {
      if kind == .oneDecision {
        QuestionColumn(
          readableWidth: PracticeLayout.readableWidth, spacing: 20,
          note: actionsHidden ? nil : note, usesPracticeBar: !actionsHidden
        ) {
          EmptyView()
        } content: {
          stimulus()
        } actions: {
          actionsBar
        }
        .lonePage()
      } else {
        QuestionSpread(
          readableWidth: PracticeLayout.readableWidth, spacing: 20, isSpread: kind == .spread,
          fillsHeight: fillsHeight, note: actionsHidden ? nil : note,
          usesPracticeBar: !actionsHidden
        ) {
          EmptyView()
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
    // As the bottom bar: a soft edge would fade the page above the bar's hairline.
    .scrollEdgeEffectStyle(.hard, for: .bottom)
  }

  private var segmentsBar: TaskSegments? {
    guard let segments, !segments.isEmpty else { return nil }

    return TaskSegments(
      segments: segments,
      label: Text(
        "Question \(min(index + 1, segments.count)) of \(segments.count)", tableName: "Practice",
        comment:
          "VoiceOver label of a run's progress: the question in view and how many there are."))
  }

  @ViewBuilder private var actionsBar: some View {
    if !actionsHidden {
      VStack(spacing: 10) {
        actions()
      }
    }
  }
}

extension View {
  /// A practice bar's main action: as wide as a narrow bar, and at a wide bar's end at its own
  /// width.
  func practiceMainAction() -> some View {
    modifier(PracticeMainAction())
  }
}

private struct PracticeBar: ViewModifier {
  let readableWidth: CGFloat
  let isWide: Bool
  let hasNote: Bool

  func body(content: Content) -> some View {
    content
      // Main's `BottomBar`: wide, the main action sits at the bar's end at its own width.
      .environment(\.practiceBarIsWide, isWide)
      .frame(maxWidth: .infinity)
      .frame(maxWidth: readableWidth)
      // The bottom bar's inset, so a run's actions sit where every screen's do.
      .scenePadding()
      .frame(maxWidth: .infinity)
      .barBackdrop(hairline: !hasNote)
  }
}

private struct PracticeMainAction: ViewModifier {
  @Environment(\.practiceBarIsWide) private var isWide
  @Environment(\.isInPracticeActionRow) private var isInRow

  func body(content: Content) -> some View {
    content
      .controlSize(.large)
      .buttonSizing(isWide && !isInRow ? .automatic : .flexible)
      .environment(\.mainActionMinWidth, isWide ? WideBar.mainActionMinWidth : nil)
      .frame(maxWidth: isWide && !isInRow ? .infinity : nil, alignment: .trailing)
      .barMainAction()
  }
}

/// A result, or a screen with one decision, such as an intro, a wait or a note. A run's step that
/// asks nothing keeps the spread init, its way on where each answer's was.
extension PracticeTaskLayout where Response == EmptyView {
  init(
    isResult: Bool = false,
    note: BarNote? = nil,
    @ViewBuilder content: @escaping () -> Stimulus,
    @ViewBuilder actions: @escaping () -> Actions
  ) {
    self.init(
      kind: isResult ? .result : .oneDecision, segments: nil, index: 0, stimulus: content,
      response: { EmptyView() }, actions: actions)
    self.note = note
  }
}

/// Switching between a spread and one column recreates the pages, so the answer lives above the
/// spread.
struct QuestionSpread<Header: View, Stimulus: View, Response: View, Actions: View>: View {
  let readableWidth: CGFloat
  let spacing: CGFloat
  var isSpread = true
  /// Only one column fills the height: on a spread, the turn's page leaves its bank under the turn.
  var fillsHeight = false
  /// The bar's one line, over the page with the actions.
  var note: BarNote?
  var usesPracticeBar = false
  @ViewBuilder let header: () -> Header
  @ViewBuilder let stimulus: () -> Stimulus
  @ViewBuilder let response: () -> Response
  @ViewBuilder let actions: () -> Actions

  var body: some View {
    PaneSplit(isSpread: isSpread) {
      ScrollingPage(readableWidth: readableWidth, spacing: spacing, content: stimulus)
        .pageHeader(header)
    } secondary: {
      QuestionColumn(
        readableWidth: readableWidth, spacing: spacing, note: note,
        usesPracticeBar: usesPracticeBar, header: { EmptyView() }, content: response,
        actions: actions)
    } single: {
      QuestionColumn(
        readableWidth: readableWidth, spacing: spacing, fillsHeight: fillsHeight, note: note,
        usesPracticeBar: usesPracticeBar, header: header
      ) {
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
  @Environment(\.stacksContent) private var isStacked
  @Environment(\.windowWidth) private var windowWidth

  let readableWidth: CGFloat
  let spacing: CGFloat
  var fillsHeight = false
  var note: BarNote?
  var usesPracticeBar = false
  @ViewBuilder let header: () -> Header
  @ViewBuilder let content: () -> Content
  @ViewBuilder let actions: () -> Actions

  private var isWide: Bool { WideBar.isWide(windowWidth: windowWidth, isStacked: isStacked) }

  var body: some View {
    ScrollingPage(
      readableWidth: readableWidth, spacing: spacing, fillsHeight: fillsHeight, content: content
    )
    .pageHeader(header)
    .barNote(note) {
      $0.barNoteLines(isWide: isWide)
        .frame(maxWidth: readableWidth)
        .scenePadding(.horizontal)
        .frame(maxWidth: .infinity)
    }
    .safeAreaBar(edge: .bottom) {
      if usesPracticeBar {
        actions()
          .modifier(
            PracticeBar(readableWidth: readableWidth, isWide: isWide, hasNote: note != nil))
      } else {
        actions()
      }
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
  var fillsHeight = false
  @ViewBuilder let content: () -> Content

  var body: some View {
    FillingScrollView(fillsHeight: fillsHeight) {
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

/// A task's main action, which Return presses: its label alone, as main's `TaskMainButton`. While
/// busy it ignores `isDisabled`: the button that sent the request keeps its look and its focus.
struct PracticeMainButton: View {
  let title: LocalizedStringResource
  var isBusy = false
  var isDisabled = false
  let action: () -> Void

  var body: some View {
    BusyButton(isBusy: isBusy, action: action) {
      Text(title)
    }
    .buttonStyle(.mainAction)
    .disabled(isDisabled && !isBusy)
    .keyboardShortcut(.defaultAction)
    .practiceMainAction()
  }
}

/// Main's `QuestionActions`: on a wide bar the buttons keep their own width at its end, wrapping
/// once they don't fit; on a phone they share lines (`BarLines`).
struct PracticeActionRow<Content: View>: View {
  @Environment(\.practiceBarIsWide) private var isWide
  @ViewBuilder let content: Content

  var body: some View {
    BarLines(spacing: 8, isWide: isWide) {
      content
    }
    .environment(\.isInPracticeActionRow, true)
  }
}

extension EnvironmentValues {
  /// A practice button takes the width its row (`BarLines`) gives it.
  @Entry var isInPracticeActionRow = false
  @Entry var practiceBarIsWide = false
}

enum PracticeFocus: Hashable {
  case answer
  case check
  case next
  case notSure
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
  @Environment(\.practiceBarIsWide) private var isWide
  @Environment(\.isInPracticeActionRow) private var isInRow

  let title: LocalizedStringResource
  let icon: ActionIcon?
  var isTight = false
  var isBusy = false
  var isDisabled = false
  let action: () -> Void

  var body: some View {
    BusyButton(isBusy: isBusy, icon: icon, action: action) {
      Text(title)
    }
    .buttonStyle(isTight && !isWide ? .outline.tight : .outline)
    .controlSize(.large)
    .buttonSizing(isWide && !isInRow ? .fitted : .flexible)
    .disabled(isDisabled && !isBusy)
    .frame(maxWidth: isWide && !isInRow ? .infinity : nil, alignment: .trailing)
  }
}

/// Main's `QuestionDontKnow`: the quieter of a question's two answers, its words alone and, on a
/// phone's bar, with tighter padding, so the main action beside it keeps the larger part of the row.
struct QuestionDontKnowButton: View {
  let title: LocalizedStringResource
  var isBusy = false
  var isDisabled = false
  let action: () -> Void

  var body: some View {
    PracticeSecondaryButton(
      title: title, icon: nil, isTight: true, isBusy: isBusy, isDisabled: isDisabled,
      action: action)
  }
}

/// Main's `AnswersSaveError`: what didn't go through, with its Try again closing the sentence as a
/// link, so the bar keeps one button, its main action.
struct PracticeSaveError: View {
  let failures: Int
  let onReport: () -> Void
  let retry: () -> Void

  var body: some View {
    SaveFailureNotice(
      failures: failures, firstMessage: SaveFailureNotice<Text>.answersKept, onReport: onReport
    ) { message in
      sentence(AttributedString(localized: message))
    }
    .typeStyle(.body)
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func sentence(_ message: AttributedString) -> some View {
    let action = String(
      localized: "Try again", table: "Practice", comment: "Sends an answer that didn't save again.")
    var link = AttributedString(action)
    link.link = URL(string: "zoonk-practice:try-again")
    link.foregroundColor = Color(.foreground)
    link.underlineStyle = .single

    return Text(message + AttributedString(" ") + link)
      .foregroundStyle(.destructiveText)
      .tint(Color(.foreground))
      .environment(
        \.openURL,
        OpenURLAction { _ in
          retry()
          return .handled
        }
      )
      .accessibilityAction(named: Text(action), retry)
      .announcesAlert(String(message.characters))
  }
}

struct SaveFailureNotice<Line: View>: View {
  let failures: Int
  let firstMessage: LocalizedStringResource
  let onReport: () -> Void
  @ViewBuilder var line: (LocalizedStringResource) -> Line

  var body: some View {
    let isRepeated = failures > 1
    VStack(alignment: .leading, spacing: 4) {
      line(
        isRepeated
          ? LocalizedStringResource(
            "Still not going through. You can come back later.", table: "Practice",
            comment: "Second or later save failure in a row; the learner can retry or return later")
          : firstMessage)

      if isRepeated {
        SaveFailureReportButton(action: onReport)
      }
    }
  }
}

extension SaveFailureNotice {
  static var answersKept: LocalizedStringResource {
    LocalizedStringResource(
      "That didn't go through. Your answers are kept.", table: "Practice",
      comment: "An answer or finish didn't reach the server; the learner's answers stay on screen"
    )
  }
}

extension SaveFailureNotice where Line == FailureLine {
  init(
    failures: Int, firstMessage: LocalizedStringResource = Self.answersKept,
    onReport: @escaping () -> Void
  ) {
    self.init(failures: failures, firstMessage: firstMessage, onReport: onReport) {
      FailureLine(message: $0)
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
    .leavesOnEscape()
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
    VStack(alignment: .leading, spacing: 12) {
      // Main's `MomentReadouts`: the score and what it earned on one line, the same at every
      // task's end (B2's R1).
      FlowLayout(spacing: 32, alignment: .firstTextBaseline) {
        // With no total, a count alone: a duel stops once it's decided, so a total reads wrong.
        if let correct, total.map({ $0 > 0 }) ?? true {
          ScoreReadout(correct: correct, total: total)
        }

        if brainPower > 0 {
          EarnedBrainPower(points: brainPower)
        }
      }

      if !facts.isEmpty {
        FactSegments(facts).typeStyle(.data).foregroundStyle(.mutedForeground)
      }

      if let day, !day.isEmpty {
        DayMomentSections(result: day)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// Main's `ScoreWords`: "3 of 4 right", its number in the readout's type.
private struct ScoreReadout: View {
  @Environment(\.self) private var environment
  let correct: Int
  let total: Int?

  var body: some View {
    let number = Text(correct, format: .number)
      .font(TypeStyle.readout.font(in: environment))
      .foregroundStyle(Color(.foreground))

    Group {
      if let total {
        Text(
          "\(number) of \(total) right", tableName: "Practice",
          comment: "A task's score: right answers, the first number shown large, out of all asked.")
      } else {
        Text(
          "\(number) right", tableName: "Practice",
          comment: "How many answers the learner got right in a challenge, shown large.")
      }
    }
    .typeStyle(.note.weight(.medium))
    .foregroundStyle(.mutedForeground)
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
  /// False inside a screen whose own main action stays, such as the notebook's list.
  var inBar = true
  let retry: () -> Void

  var body: some View {
    if error == .notFound {
      NotFoundView()
    } else {
      PageLoadFailure(inBar: inBar) {
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
      } retry: {
        retry()
      }
    }
  }
}
