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

/// A full-screen practice task: its content scrolls in a readable column, its progress stays at
/// the top, and its actions stay pinned at the bottom.
struct PracticeTaskLayout<Content: View, Actions: View>: View {
  @Environment(\.practiceActionsHidden) private var actionsHidden
  var segments: [PracticeSegment]?
  var index = 0
  @ViewBuilder let content: () -> Content
  @ViewBuilder let actions: () -> Actions

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        content()
      }
      .frame(maxWidth: PracticeLayout.readableWidth, alignment: .leading)
      .frame(maxWidth: .infinity)
      .scenePadding()
    }
    .scrollDismissesKeyboard(.interactively)
    .background(Color(.systemGroupedBackground))
    .safeAreaBar(edge: .top) {
      if let segments, !segments.isEmpty {
        PracticeSegmentsBar(segments: segments, index: index)
          .frame(maxWidth: PracticeLayout.readableWidth)
          .padding(.horizontal)
          .padding(.vertical, 8)
          .frame(maxWidth: .infinity)
      }
    }
    .safeAreaBar(edge: .bottom) {
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

/// The close of a task's toolbar: answers are saved as they go, so it just leaves.
struct PracticeCloseButton: View {
  var label: LocalizedStringResource = LocalizedStringResource(
    "Close. Your answers are saved.", table: "Practice",
    comment: "VoiceOver label of a practice task's close button.")
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Image(systemName: "xmark")
    }
    .accessibilityLabel(Text(label))
    .keyboardShortcut(.cancelAction)
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
