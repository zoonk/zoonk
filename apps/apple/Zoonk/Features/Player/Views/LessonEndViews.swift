import SwiftUI

/// The quick moment at the end of a lesson: the title, the score and the Brain Power earned, when
/// the idea comes back, the belt level it reached, then the way on. On a spread it's the leading
/// page, and the way on stays on the trailing one, where Continue sat through the lesson.
struct LessonCompletionView: View {
  let completion: LessonPlayerState.Completion
  let correct: Int
  let answered: Int
  let soundsEnabled: Bool
  /// A guest's lesson ends with where it fits and "Build my plan".
  var guestEnding: LessonGuestEnding?
  let finish: () -> Void
  let close: () -> Void

  var body: some View {
    PaneSplit {
      page {
        moment
      }
    } secondary: {
      page {
        guestEndingView
      }
      .safeAreaBar(edge: .bottom) { actionBar }
    } single: {
      page {
        moment
        guestEndingView
      }
      .safeAreaBar(edge: .bottom) { actionBar.keepsOffFold() }
    }
    .sensoryFeedback(.success, trigger: completion.status == .saved)
    .onChange(of: completion.status) { _, status in
      if status == .saved, soundsEnabled {
        LessonSounds.shared.play(.finish)
      }
    }
  }

  private func page<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 24) {
        content()
      }
      .frame(maxWidth: 680, alignment: .leading)
      .frame(maxWidth: .infinity)
      .scenePadding()
    }
  }

  @ViewBuilder
  private var moment: some View {
    Group {
      if completion.testedOut {
        Text(
          "You already knew this", tableName: "Player",
          comment: "Title after \"I already know this\" passed every check")
      } else {
        Text("Lesson complete", tableName: "Player", comment: "Title at the end of a lesson")
      }
    }
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

  @ViewBuilder
  private var guestEndingView: some View {
    if completion.status == .saved, let guestEnding {
      LessonGuestEndingView(ending: guestEnding)
    }
  }

  private var actionBar: some View {
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

  private func readouts(_ summary: LessonCompletionSummary) -> some View {
    // With nothing answered (an explanation read again, a lesson without checks), no score shows.
    let answered = summary.correctCount + summary.incorrectCount

    return VStack(alignment: .leading, spacing: 16) {
      Grid(alignment: .leading, horizontalSpacing: 32, verticalSpacing: 4) {
        GridRow {
          if answered > 0 {
            Text("\(summary.correctCount)/\(answered)")
              .font(.largeTitle.weight(.semibold).monospacedDigit())
          }
          if summary.brainPower > 0 {
            Text("+\(summary.brainPower)")
              .font(.largeTitle.weight(.semibold).monospacedDigit())
              .foregroundStyle(.brain)
          }
        }
        GridRow {
          if answered > 0 {
            Text("Right", tableName: "Player", comment: "Label under the lesson's score")
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
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
      SeePlusButton()
        .buttonStyle(.mainAction)
      backButton
    case .limitReached(tier: .guest, _):
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
    case .notFound:
      LocalizedStringResource(
        "This lesson isn't available anymore.", table: "Player",
        comment: "The lesson doesn't exist anymore")
    }
  }

  private var symbol: String {
    switch refusal {
    case .failed, .notFound: "exclamationmark.circle"
    case .slowDown, .limitReached(.plus, _): "hourglass"
    case .plusRequired, .limitReached(.free, _): "lock.fill"
    case .limitReached(.guest, _): "person.crop.circle.badge.plus"
    }
  }
}

/// What a guest's lesson ends with: the lesson's title (onboarding starts from it outside a course)
/// and where it fits, once read.
struct LessonGuestEnding: Hashable {
  let lessonTitle: String
  let fit: LessonFit?
}

/// Where a guest's lesson fits, and two ways on: "Build my plan" starts a plan from the lesson's
/// course without typing it again, and an account keeps the lesson and its review.
private struct LessonGuestEndingView: View {
  @Environment(\.lessonPlayerRoutes) private var routes

  let ending: LessonGuestEnding

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      if let fit = ending.fit {
        GroupBox {
          VStack(alignment: .leading, spacing: 12) {
            if let course = fit.course {
              Label {
                VStack(alignment: .leading, spacing: 2) {
                  Text(course.title)
                    .font(.headline)
                  Text(
                    "\(course.chapterCount) chapters · about \(Duration.seconds(max(1, (course.minutes + 30) / 60) * 3600).formatted(.units(allowed: [.hours], width: .wide))) at your pace",
                    tableName: "Player", comment: "A course's size at the end of a guest's lesson"
                  )
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
                }
              } icon: {
                Image(systemName: "book")
              }
            }

            VStack(alignment: .leading, spacing: 6) {
              HStack(alignment: .firstTextBaseline) {
                Text(fit.chapterTitle)
                  .font(.caption.weight(.medium))
                Spacer()
                Text(
                  "\(fit.lessonNumber) of \(fit.lessonCount) lessons", tableName: "Player",
                  comment: "The lesson's place in its chapter"
                )
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
              }

              MeterParts(
                parts: (0..<max(1, fit.lessonCount)).map {
                  MeterParts.Part(fill: $0 < fit.lessonNumber ? .color(.success) : .track)
                })
            }
          }
        } label: {
          Text(
            "This is part of", tableName: "Player",
            comment: "Above the course a guest's lesson is in")
        }
      }

      Label {
        Text(
          "Save your progress and a quick review comes back to help it stick.", tableName: "Player",
          comment: "At the end of a guest's lesson")
      } icon: {
        Image(systemName: "calendar.badge.clock")
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)

      VStack(spacing: 8) {
        Button {
          if let course = ending.fit?.course {
            routes.startCourse(course.id, course.startChapterId)
          } else {
            routes.startGoal(ending.fit?.course?.title ?? ending.lessonTitle)
          }
        } label: {
          Text("Build my plan", tableName: "Player", comment: "Starts a plan from a guest's lesson")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)

        Button {
          routes.signIn()
        } label: {
          Text(
            "Create an account to save", tableName: "Player",
            comment: "A guest creates an account at the end of a lesson"
          ).frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .controlSize(.large)
      }
    }
  }
}

/// The lesson's summary card, one tap away in the menu once the lesson is done.
struct LessonSummarySheet: View {
  @Environment(\.dismiss) private var dismiss

  let ideas: [String]

  var body: some View {
    NavigationStack {
      List(Array(ideas.enumerated()), id: \.offset) { _, idea in
        LessonRichText(idea)
      }
      .navigationTitle(
        Text("Lesson summary", tableName: "Player", comment: "Opens the lesson's summary card")
      )
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
        SeePlusButton()
          .buttonStyle(.bordered)
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
            "Start this lesson", tableName: "Player",
            comment: "Starts a lesson that isn't written yet: it's written, then opens")
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
        "Zoonk writes it when you start. It takes a minute or two.", table: "Player",
        comment: "A lesson not written yet")
    case .writing:
      LocalizedStringResource(
        "It usually takes a minute or two. The lesson opens here as soon as it's ready.",
        table: "Player",
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
  /// Sign in or create an account.
  let signIn: @MainActor @Sendable () -> Void
  /// "Build my plan" after a guest's lesson: the lesson's course as their goal, from its chapter
  /// when that's where they began (`chapterId`), else from the course's start (`.courseStart`).
  let startCourse: @MainActor @Sendable (_ courseId: String, _ chapterId: String?) -> Void
  /// "Build my plan" for a lesson in no public course: onboarding with its subject filled in.
  let startGoal: @MainActor @Sendable (_ goal: String) -> Void

  static let none = LessonPlayerRoutes(signIn: {}, startCourse: { _, _ in }, startGoal: { _ in })
}

extension EnvironmentValues {
  /// Set at the app root to the shell's subscription and sign-in sheets.
  @Entry var lessonPlayerRoutes: LessonPlayerRoutes = .none
}
