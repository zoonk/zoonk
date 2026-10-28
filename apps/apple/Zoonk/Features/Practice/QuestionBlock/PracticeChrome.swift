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
    case .right: .blue
    case .wrong: .pink
    case .read: Color(.systemGray3)
    case .current: .primary
    case .ahead: Color(.systemFill)
    }
  }
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
      .frame(maxWidth: 680, alignment: .leading)
      .frame(maxWidth: .infinity)
      .scenePadding()
    }
    .scrollDismissesKeyboard(.interactively)
    .background(Color(.systemGroupedBackground))
    .safeAreaInset(edge: .top, spacing: 0) {
      if let segments, !segments.isEmpty {
        PracticeSegmentsBar(segments: segments, index: index)
          .frame(maxWidth: 680)
          .padding(.horizontal)
          .padding(.vertical, 8)
          .frame(maxWidth: .infinity)
          .background(.bar)
      }
    }
    .safeAreaInset(edge: .bottom, spacing: 0) {
      if !actionsHidden {
        VStack(spacing: 10) {
          actions()
        }
        .frame(maxWidth: 680)
        .padding(.horizontal)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(.bar)
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
    .buttonStyle(.glassProminent)
    .controlSize(.large)
    .disabled(isDisabled || isBusy)
    .keyboardShortcut(.defaultAction)
  }
}

/// A secondary action beside the main one ("I don't know yet", "I'm not sure").
struct PracticeSecondaryButton: View {
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
      .frame(maxWidth: .infinity)
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
      .foregroundStyle(.pink)

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
            tint: .purple)
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
  case failed(PracticeAPIError)
  case loaded(Value)
  case loading
}

/// The loading and failure states every practice task shares.
struct PracticeLoadFailureView: View {
  let error: PracticeAPIError
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
