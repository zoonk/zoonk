import SwiftUI

/// Each question's place in the header's segments.
enum PracticeSegment: Equatable {
  case ahead
  case current
  /// A placement question or a statement left blank: not graded right or wrong.
  case read
  case right
  case wrong
}

/// One segment per question under a run's title: soft blue or pink once answered, quiet for a
/// question not graded right or wrong, firm for the one in view, faint for the rest.
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
  /// The column practice keeps its reading in on a wide screen.
  static let readableWidth: CGFloat = 680
}

/// A full-screen practice task: its progress stays at the top and its actions stay pinned at the
/// bottom. A question task is a spread where two pages fit (the open iPhone Duo, iPad, iPhone in
/// landscape): what it's read with on the leading page, under the progress, and the learner's turn
/// on the trailing page, with the actions at its bottom. Elsewhere, and for a task that's all one
/// part (an intro, a result), it scrolls in one readable column.
struct PracticeTaskLayout<Stimulus: View, Response: View, Actions: View>: View {
  @Environment(\.practiceActionsHidden) private var actionsHidden
  private let segments: [PracticeSegment]?
  private let index: Int
  private let spreads: Bool
  private let stimulus: () -> Stimulus
  private let response: () -> Response
  private let actions: () -> Actions

  /// A question: what it's read with (its set, the question) and the learner's turn (the answer
  /// control, the grade), for the two pages of a spread.
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
  /// A task that's all one part, such as an intro or a result: one column on every screen.
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

/// A question as a spread where each page gets a phone-width column: what it's read with on the
/// leading page under its header, the learner's turn on the trailing page with the actions pinned
/// at its bottom, so they never move between questions. One column everywhere else, as a phone
/// shows it. Switching recreates the pages, so the answer lives above the spread.
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

/// One scrolling column with its header pinned on top and its actions pinned at the bottom, moved
/// off the fold while iPhone Duo is partially folded.
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
  /// Pins a page's header above it. A page without one gets no bar: a top bar around an empty
  /// view takes the page's free height and pushes its content down out of sight.
  @ViewBuilder
  fileprivate func pageHeader<Header: View>(_ header: () -> Header) -> some View {
    if Header.self == EmptyView.self {
      self
    } else {
      safeAreaBar(edge: .top, content: header)
    }
  }
}

/// A page's content, scrolling in a readable column.
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
  /// Hides a practice task's pinned action bar when the screen has nothing to do yet.
  func practiceActionsHidden(_ hidden: Bool) -> some View {
    environment(\.practiceActionsHidden, hidden)
  }
}

/// The main action of a task's pinned bar: full width, prominent, Return presses it.
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

/// A pinned bar's actions in one row: the secondary ones at their own width and the main one taking
/// the rest, so a label like "I don't know yet" stays on one line; stacked at full width when they
/// don't fit side by side (a narrow window, a large text size, a long translation).
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

/// A secondary action beside the main one ("I don't know yet", "I'm not sure").
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
    .buttonStyle(.glass)
    .controlSize(.large)
    .disabled(isDisabled)
  }
}

/// The answers couldn't be saved: says so over the actions, with a way to send them again.
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

/// The close of a task's toolbar: answers are saved as they go, so it just leaves. The bar shows
/// its mark; its title is what VoiceOver says.
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

extension View {
  /// A task's close in its toolbar, the item the bar keeps when it runs out of room (iPhone Duo's
  /// short vertical bar can), so leaving never hides in the overflow menu.
  func taskClose<Close: View>(@ViewBuilder _ close: () -> Close) -> some View {
    modifier(TaskCloseToolbar(close: close()))
  }

  /// A task's own options in the toolbar's "…" menu: the system's overflow menu on iOS 27, which
  /// also takes what a short bar can't fit, and a menu of its own before it.
  func taskOptions<Actions: View>(
    isShown: Bool = true, label: Text, @ViewBuilder _ actions: () -> Actions
  ) -> some View {
    modifier(TaskOptionsToolbar(isShown: isShown, label: label, actions: actions()))
  }
}

// Both pick their toolbar by system version outside it: an `if #available` inside a toolbar's
// builder loses its item once iPhone Duo unfolds.

private struct TaskCloseToolbar<Close: View>: ViewModifier {
  let close: Close

  func body(content: Content) -> some View {
    if #available(iOS 27, *) {
      content.toolbar {
        ToolbarItem(placement: .cancellationAction) { close }
          .visibilityPriority(.high)
      }
    } else {
      content.toolbar {
        ToolbarItem(placement: .cancellationAction) { close }
      }
    }
  }
}

private struct TaskOptionsToolbar<Actions: View>: ViewModifier {
  let isShown: Bool
  let label: Text
  let actions: Actions

  func body(content: Content) -> some View {
    if #available(iOS 27, *) {
      content.toolbar {
        if isShown {
          ToolbarOverflowMenu { actions }
        }
      }
    } else {
      content.toolbar {
        if isShown {
          ToolbarItem(placement: .primaryAction) {
            Menu {
              actions
            } label: {
              Label {
                label
              } icon: {
                Image(systemName: "ellipsis")
              }
            }
          }
        }
      }
    }
  }
}

/// The end of a run, as every task's end says it: its title, a quiet line under it, its numbers
/// as readouts (never "+0"), and what it reached.
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

/// A run's screens load once per opening; failures say so with a retry, never as stuck.
enum PracticeLoad<Value> {
  case failed(APIError)
  case loaded(Value)
  case loading
}

/// The loading and failure states every practice task shares.
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
