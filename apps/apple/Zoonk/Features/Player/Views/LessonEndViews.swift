import SwiftUI

/// The quick moment at the end of a lesson: the title, the score and the Brain Power earned, when
/// the idea comes back, the belt level it reached, then the way on.
struct LessonCompletionView: View {
  let completion: LessonPlayerState.Completion
  let correct: Int
  let answered: Int
  let soundsEnabled: Bool
  let finish: () -> Void
  let close: () -> Void

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 24) {
        Text("Lesson complete", tableName: "Player", comment: "Title at the end of a lesson")
          .font(.largeTitle.weight(.bold))
          .accessibilityAddTraits(.isHeader)

        switch completion.status {
        case .ready:
          EmptyView()
        case .saving:
          ProgressView()
        case .failed:
          Text(
            "We couldn't save this lesson. Try again in a moment. Nothing you did was lost.",
            tableName: "Player",
            comment: "Saving a finished lesson failed"
          )
          .foregroundStyle(.secondary)
        case .saved:
          if let summary = completion.summary {
            readouts(summary)
          }
        }
      }
      .frame(maxWidth: 680, alignment: .leading)
      .frame(maxWidth: .infinity)
      .scenePadding()
    }
    .safeAreaBar(edge: .bottom) {
      Group {
        switch completion.status {
        case .ready:
          Button(action: finish) {
            Text(
              "Finish", tableName: "Player",
              comment: "Saves a lesson answered in an earlier sitting"
            ).frame(maxWidth: .infinity)
          }
        case .failed:
          Button(action: finish) {
            Text("Try again", tableName: "Player", comment: "Tries saving the lesson again").frame(
              maxWidth: .infinity)
          }
        case .saving, .saved:
          Button(action: close) {
            Text("Continue", tableName: "Player", comment: "Leaves the finished lesson").frame(
              maxWidth: .infinity)
          }
          .disabled(completion.status == .saving)
        }
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .keyboardShortcut(.defaultAction)
      .frame(maxWidth: 680)
      .frame(maxWidth: .infinity)
      .scenePadding()
    }
    .sensoryFeedback(.success, trigger: completion.status == .saved)
    .onChange(of: completion.status) { _, status in
      if status == .saved, soundsEnabled {
        LessonSounds.shared.play(.finish)
      }
    }
  }

  private func readouts(_ summary: LessonCompletionSummary) -> some View {
    VStack(alignment: .leading, spacing: 16) {
      Grid(alignment: .leading, horizontalSpacing: 32, verticalSpacing: 4) {
        GridRow {
          Text("\(summary.correctCount)/\(summary.correctCount + summary.incorrectCount)")
            .font(.largeTitle.weight(.semibold).monospacedDigit())
          if summary.brainPower > 0 {
            Text("+\(summary.brainPower)")
              .font(.largeTitle.weight(.semibold).monospacedDigit())
              .foregroundStyle(.brain)
          }
        }
        GridRow {
          Text("Right", tableName: "Player", comment: "Label under the lesson's score")
            .font(.subheadline)
            .foregroundStyle(.secondary)
          if summary.brainPower > 0 {
            Text(
              "Brain Power", tableName: "Player",
              comment: "Label under the Brain Power a lesson earned"
            )
            .font(.subheadline)
            .foregroundStyle(.secondary)
          }
        }
      }
      .accessibilityElement(children: .combine)

      if let level = summary.reachedLevel {
        Label {
          Text(
            "You reached level \(level)", tableName: "Player",
            comment: "A lesson took the learner to a new belt level")
        } icon: {
          Image(systemName: "rosette")
        }
        .font(.headline)
      }

      if let reviewAt = summary.nextReviewAt {
        Text(
          "Review on \(reviewAt.formatted(.dateTime.day().month(.abbreviated)))",
          tableName: "Player",
          comment: "When the lesson's idea comes back for review"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }
    }
  }
}

/// When a lesson can't start: a calm wait for fair use, a sign-up for a guest who used their
/// lessons, Plus for a free learner, or a retry when the connection failed. Never a dead end.
struct LessonUnavailableView: View {
  @Environment(\.dismiss) private var dismiss

  let refusal: LessonRunRefusal
  let retry: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(title)
      } icon: {
        Image(systemName: symbol)
      }
    } description: {
      Text(description)
    } actions: {
      actions
    }
  }

  @ViewBuilder
  private var actions: some View {
    switch refusal {
    case .failed:
      Button(action: retry) {
        Text("Try again", tableName: "Player", comment: "Tries opening the lesson again")
      }
      .buttonStyle(.mainAction)
    case .slowDown:
      Button(action: retry) {
        Text("Try again", tableName: "Player", comment: "Tries opening the lesson again")
      }
      .buttonStyle(.bordered)
    case .plusRequired, .limitReached(tier: .free, _):
      PlusLockButton()
      backButton
    case .limitReached(tier: .guest, _):
      SignUpButton()
    case .unauthorized:
      SignUpButton()
    case .limitReached(tier: .plus, _), .notFound:
      backButton
    }
  }

  private var backButton: some View {
    Button {
      dismiss()
    } label: {
      Text("Back", tableName: "Player", comment: "Leaves a lesson that can't open")
    }
    .buttonStyle(.bordered)
  }

  private var title: LocalizedStringResource {
    switch refusal {
    case .failed:
      LocalizedStringResource(
        "We couldn't open this lesson", table: "Player", comment: "A lesson failed to open")
    case .slowDown:
      LocalizedStringResource(
        "Take a short break", table: "Player", comment: "Fair use spaces new lessons out")
    case .plusRequired:
      LocalizedStringResource(
        "Your free week of exam prep is over", table: "Player",
        comment: "A free exam plan past its first week")
    case .limitReached(.guest, _):
      LocalizedStringResource(
        "Save your progress to keep going", table: "Player", comment: "A guest used their lessons")
    case .limitReached(.free, .month):
      LocalizedStringResource(
        "That's all the new lessons for this month", table: "Player",
        comment: "A free learner used the month's lessons")
    case .limitReached(.free, _):
      LocalizedStringResource(
        "That's all the new lessons for today", table: "Player",
        comment: "A free learner used the day's lessons")
    case .limitReached(.plus, _):
      LocalizedStringResource(
        "That's a lot of learning today", table: "Player",
        comment: "A Plus learner reached the day's limit")
    case .unauthorized:
      LocalizedStringResource("Sign in to continue", table: "Player", comment: "The session ended")
    case .notFound:
      LocalizedStringResource(
        "Lesson not available", table: "Player", comment: "The lesson doesn't exist anymore")
    }
  }

  private var description: LocalizedStringResource {
    switch refusal {
    case .failed:
      LocalizedStringResource(
        "Try again in a moment. Nothing you did was lost.", table: "Player",
        comment: "A lesson failed to open")
    case .slowDown(let seconds):
      LocalizedStringResource(
        "New lessons open again in \(Duration.seconds(seconds).formatted(.units(allowed: [.minutes, .seconds], width: .wide)))",
        table: "Player", comment: "How long until the next lesson opens")
    case .plusRequired:
      LocalizedStringResource(
        "Reviews and fixing your mistakes stay free. Plus opens new lessons, the rest of your plan and mock exams.",
        table: "Player", comment: "A free exam plan past its first week")
    case .limitReached(.guest, _):
      LocalizedStringResource(
        "You've taken the lessons you can try without an account. Create a free account to keep going, and everything you learned comes with you.",
        table: "Player", comment: "A guest used their lessons")
    case .limitReached(.free, .month):
      LocalizedStringResource(
        "You can still review what you learned and practice your mistakes. New lessons open again next month, or get Plus to keep going now.",
        table: "Player", comment: "A free learner used the month's lessons")
    case .limitReached(.free, _):
      LocalizedStringResource(
        "You can still review what you learned and practice your mistakes. New lessons open again tomorrow, or get Plus to keep going now.",
        table: "Player", comment: "A free learner used the day's lessons")
    case .limitReached(.plus, _):
      LocalizedStringResource(
        "You've reached today's limit. New lessons open again tomorrow.", table: "Player",
        comment: "A Plus learner reached the day's limit")
    case .unauthorized:
      LocalizedStringResource(
        "Sign in to keep learning.", table: "Player", comment: "The session ended")
    case .notFound:
      LocalizedStringResource(
        "This lesson isn't available anymore.", table: "Player",
        comment: "The lesson doesn't exist anymore")
    }
  }

  private var symbol: String {
    switch refusal {
    case .failed, .notFound, .unauthorized: "exclamationmark.circle"
    case .slowDown, .limitReached(.plus, _): "hourglass"
    case .plusRequired, .limitReached(.free, _): "lock.fill"
    case .limitReached(.guest, _): "person.crop.circle.badge.plus"
    }
  }
}

/// Plus-only: the same screen, locked, with the way to Plus.
struct PlusLockButton: View {
  @Environment(\.lessonPlayerRoutes) private var routes

  var body: some View {
    Button {
      routes.showPlus()
    } label: {
      Label {
        Text("See Plus", tableName: "Player", comment: "Opens the Plus subscription")
      } icon: {
        Image(systemName: "lock.fill")
      }
    }
    .buttonStyle(.mainAction)
  }
}

private struct SignUpButton: View {
  @Environment(\.lessonPlayerRoutes) private var routes

  var body: some View {
    Button {
      routes.signIn()
    } label: {
      Text(
        "Create a free account", tableName: "Player", comment: "Opens account creation for a guest")
    }
    .buttonStyle(.mainAction)
  }
}

/// The learner's small AI help is used up or needs a break.
struct LessonHelpLimitNote: View {
  let refusal: LessonRunRefusal

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      switch refusal {
      case .slowDown:
        Text("Take a short break", tableName: "Player", comment: "Fair use spaces AI help out")
      case .limitReached(.guest, _):
        Text(
          "Save your progress to keep going", tableName: "Player",
          comment: "A guest used their AI help")
        SignUpButton()
      case .limitReached(.free, _):
        Text(
          "You used today's AI help. Plus gives you more.", tableName: "Player",
          comment: "A free learner used the day's AI help")
        PlusLockButton()
      default:
        Text(
          "You've used today's AI help. It's back tomorrow.", tableName: "Player",
          comment: "A learner used the day's AI help")
      }
    }
    .font(.subheadline)
    .foregroundStyle(.secondary)
  }
}

/// A lesson still being written: the learner asks for it (it runs AI), or waits while it's written.
struct LessonWaitingView: View {
  let outline: LessonOutline
  let writing: LessonPlayerStore.LessonWriting
  let write: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(outline.title)
      } icon: {
        Image(systemName: symbol)
      }
    } description: {
      Text(description)
    } actions: {
      switch writing {
      case .notStarted, .failed:
        Button(action: write) {
          Text(
            "Write this lesson", tableName: "Player",
            comment: "Starts writing a lesson that isn't written yet")
        }
        .buttonStyle(.mainAction)
      case .writing:
        ProgressView()
      case .refused(let refusal):
        LessonHelpLimitNote(refusal: refusal)
      case .setAside:
        EmptyView()
      }
    }
  }

  private var symbol: String {
    switch writing {
    case .writing: "pencil.and.scribble"
    case .failed, .setAside: "exclamationmark.circle"
    default: "doc.text"
    }
  }

  private var description: LocalizedStringResource {
    switch writing {
    case .notStarted:
      LocalizedStringResource(
        "This lesson isn't written yet. It takes about a minute.", table: "Player",
        comment: "A lesson not written yet")
    case .writing:
      LocalizedStringResource(
        "Writing your lesson. It opens as soon as it's ready.", table: "Player",
        comment: "While a lesson is written")
    case .failed:
      LocalizedStringResource(
        "We couldn't write this lesson. Try again.", table: "Player",
        comment: "Writing a lesson failed")
    case .setAside:
      LocalizedStringResource(
        "This lesson didn't pass our checks, so your plan moved on without it.", table: "Player",
        comment: "Every draft of a lesson was held back")
    case .refused:
      LocalizedStringResource(
        "This lesson isn't written yet.", table: "Player",
        comment: "A lesson not written yet, writing refused")
    }
  }
}

/// A visitor opening a public lesson: its screens need a session, a guest's included.
struct LessonGuestGateView: View {
  @Environment(\.lessonGuestStart) private var guestStart
  @Environment(\.lessonPlayerRoutes) private var routes
  @State private var isStarting = false

  let outline: LessonOutline
  let reload: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(outline.title)
      } icon: {
        Image(systemName: "book")
      }
    } description: {
      Text(outline.description)
    } actions: {
      if let start = guestStart.start {
        Button {
          isStarting = true
          Task {
            if await start() {
              reload()
            }
            isStarting = false
          }
        } label: {
          Text(
            "Start this lesson", tableName: "Player",
            comment: "A visitor starts a public lesson as a guest")
        }
        .buttonStyle(.mainAction)
        .disabled(isStarting)
      } else {
        Button {
          routes.signIn()
        } label: {
          Text("Sign in", tableName: "Player", comment: "A visitor signs in to play a lesson")
        }
        .buttonStyle(.mainAction)
      }
    }
  }
}

/// Where the player's links go, supplied by the app's navigation.
struct LessonPlayerRoutes: Sendable {
  /// The Plus subscription, for a learner whose free plan locks the lesson.
  let showPlus: @MainActor @Sendable () -> Void
  /// Sign in or create an account.
  let signIn: @MainActor @Sendable () -> Void

  static let none = LessonPlayerRoutes(showPlus: {}, signIn: {})
}

extension EnvironmentValues {
  /// Set at the app root to the shell's subscription and sign-in sheets.
  @Entry var lessonPlayerRoutes: LessonPlayerRoutes = .none
}
