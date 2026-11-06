import SwiftUI

struct LessonCompletionView: View {
  let completion: LessonPlayerState.Completion
  let correct: Int
  let answered: Int
  let soundsEnabled: Bool
  var guestEnding: LessonGuestEnding?
  /// A spread shows the lesson's map under what was done; one column keeps it in the menu.
  var lesson: PlayableLesson?
  let finish: () -> Void
  let close: () -> Void

  var body: some View {
    PaneSplit {
      page {
        moment
        dayMoment

        if let lesson, let summary = lesson.summary {
          LessonMapSection(title: lesson.title, summary: summary)
        }
      }
    } secondary: {
      page {
        guestEndingView
      }
      .safeAreaBar(edge: .bottom) { actionBar }
    } single: {
      page {
        moment
        dayMoment
        guestEndingView
      }
      .safeAreaBar(edge: .bottom) { actionBar.keepsOffFold() }
    }
    .completionMoments(day)
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
    if completion.status == .ready {
      finishReady
    } else {
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
    }

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
          .celebratesOnce(id: summary)
      }
    }
  }

  /// Saved answers can reopen a lesson at its end, but finishing may start memory work, so it waits
  /// for the learner's tap.
  private var finishReady: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(
        "Nothing left to answer", tableName: "Player",
        comment: "Title of a lesson opened again with every step answered, before Finish saves it"
      )
      .font(.title2.bold())
      .accessibilityAddTraits(.isHeader)

      Text(
        "Finish to see how it went.", tableName: "Player",
        comment: "Under the title of a lesson opened again with every step answered"
      )
      .foregroundStyle(.secondary)
    }
  }

  private var day: DayResult? {
    completion.status == .saved ? completion.summary?.day : nil
  }

  @ViewBuilder
  private var dayMoment: some View {
    if let day, !day.isEmpty {
      DayMomentSections(result: day)
    }
  }

  @ViewBuilder
  private var guestEndingView: some View {
    if completion.status == .saved, let guestEnding {
      LessonGuestEndingView(ending: guestEnding)
    }
  }

  @ViewBuilder
  private var actionBar: some View {
    // As on main, a guest's ending leads with Build my plan, and the close button leaves.
    if guestEnding == nil || completion.status == .ready || completion.status == .failed {
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
            EarnedNumber(value: summary.brainPower)
              .font(.largeTitle.weight(.semibold))
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

/// Never a dead end.
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

  var said: String {
    [String(localized: title), String(localized: description)].joinedSentences()
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
        .onAppear {
          UsageAnalytics.track(.subscriptionGateShown)
        }
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
      FreeWeekOverNotice.title
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
      FreeWeekOverNotice.description
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

struct LessonGuestEnding: Hashable {
  let lessonTitle: String
  let fit: LessonFit?
}

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
                    "\(course.chapterCount) chapters\u{00A0}· about \(Duration.seconds(max(1, (course.minutes + 30) / 60) * 3600).formatted(.units(allowed: [.hours], width: .wide))) at your pace",
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
          comment:
            "At the end of a guest's lesson: once saved, Zoonk brings back a quick review later")
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
        .keyboardShortcut(.defaultAction)

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

struct LessonHelpLimitNote: View {
  let refusal: LessonRunRefusal

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(Self.message(refusal))

      switch refusal {
      case .limitReached(.guest, _):
        SignUpButton()
      case .limitReached(.free, _):
        SeePlusButton()
          .buttonStyle(.bordered)
      default:
        EmptyView()
      }
    }
    .font(.subheadline)
    .foregroundStyle(.secondary)
  }

  static func message(_ refusal: LessonRunRefusal) -> String {
    switch refusal {
    case .slowDown:
      String(
        localized: "Take a short break", table: "Player", comment: "Fair use spaces AI help out")
    case .limitReached(.guest, _):
      String(
        localized: "Save your progress to keep going", table: "Player",
        comment: "A guest used their AI help")
    case .limitReached(.free, _):
      String(
        localized: "You used today's AI help. Plus gives you more.", table: "Player",
        comment: "A free learner used the day's AI help")
    default:
      String(
        localized: "You've used today's AI help. It's back tomorrow.", table: "Player",
        comment: "A learner used the day's AI help")
    }
  }
}

/// Only the learner asks for the lesson to be written: it runs AI.
struct LessonWaitingView: View {
  static let lessonReady = LocalizedStringResource(
    "Your lesson is ready. Start it whenever you like.", table: "Player",
    comment: "A goal's first lesson is written while the learner still guesses on its wait")

  let outline: LessonOutline
  let writing: LessonPlayerStore.LessonWriting
  let progress: GenerationWait
  var warmUpID: String?
  var holding: WarmUpHolding?
  let write: () -> Void

  var body: some View {
    if let warmUpID {
      List {
        Section {
          notice
        }
        .listRowBackground(Color.clear)

        WarmUpSection(deckID: warmUpID)
      }
      .warmUpDeck(warmUpID)
      .warmUpHoldBar(
        holding,
        label: Text(
          "Start this lesson", tableName: "Player",
          comment: "Opens a goal's first lesson, written while the learner guessed on its wait"))
    } else {
      notice
    }
  }

  private var notice: some View {
    noticeContent
      .announcesStatus(notWrittenLine)
  }

  @ViewBuilder
  private var noticeContent: some View {
    if holding == nil, case .refused(let refusal) = writing {
      LessonUnavailableView(refusal: refusal, retry: write)
    } else {
      unavailable
    }
  }

  private var unavailable: some View {
    ContentUnavailableView {
      Label {
        Text(outline.title)
      } icon: {
        Image(systemName: symbol)
      }
    } description: {
      Text(description)
    } actions: {
      switch (holding, writing) {
      case (_?, _):
        EmptyView()
      case (nil, .notStarted), (nil, .failed):
        Button(action: write) {
          Text(
            "Start this lesson", tableName: "Player",
            comment: "Starts a lesson that isn't written yet: it's written, then opens")
        }
        .buttonStyle(.mainAction)
      case (nil, .writing):
        LessonWritingSteps(phases: progress.visiblePhases)
      case (nil, .written):
        ProgressView()
      case (nil, .refused), (nil, .setAside):
        EmptyView()
      }
    }
  }

  private var notWrittenLine: String? {
    guard holding == nil else {
      return nil
    }

    return switch writing {
    case .refused(let refusal): LessonUnavailableView(refusal: refusal) {}.said
    case .setAside: String(localized: description)
    default: nil
    }
  }

  private var symbol: String {
    guard holding == nil else {
      return "doc.text"
    }

    switch writing {
    case .writing, .written: return "pencil.and.scribble"
    case .failed, .setAside: return "exclamationmark.circle"
    default: return "doc.text"
    }
  }

  private var description: LocalizedStringResource {
    guard holding == nil else {
      return Self.lessonReady
    }

    return switch writing {
    case .notStarted:
      LocalizedStringResource(
        "Zoonk writes it when you start. It takes a few minutes.", table: "Player",
        comment: "A lesson not written yet")
    case .writing, .written:
      LocalizedStringResource(
        "It usually takes a few minutes. The lesson opens here as soon as it's ready.",
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

private struct LessonWritingSteps: View {
  /// `StatusMark`'s width, so the spinner's step lines up with the others.
  @ScaledMetric(relativeTo: .body) private var markWidth = 20.0

  let phases: [GenerationWait.Phase]

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(phases) { phase in
        Label {
          Text(phase.label)
            .foregroundStyle(phase.state == .waiting ? .secondary : .primary)
        } icon: {
          if phase.state == .working {
            ProgressView()
              .frame(width: markWidth)
              .accessibilityHidden(true)
          } else {
            StatusMark(status: phase.state == .done ? .done : .todo)
          }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(state(phase.state))
      }
    }
  }

  private func state(_ state: GenerationWait.PhaseState) -> Text {
    switch state {
    case .waiting:
      Text(
        "Not started yet", tableName: "Onboarding",
        comment: "VoiceOver: a step of a wait that hasn't started")
    case .working:
      Text(
        "In progress", tableName: "Onboarding",
        comment: "VoiceOver: the step of a wait that's running")
    case .done:
      Text("Done", tableName: "Onboarding", comment: "A finished step of a wait")
    }
  }
}

struct LessonGuestGateView: View {
  @Environment(\.lessonGuestStart) private var guestStart
  @Environment(\.lessonPlayerRoutes) private var routes
  @State private var isStarting = false
  @State private var startFailed = false
  @State private var starting: Task<Void, Never>?

  let outline: LessonOutline
  let reload: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(outline.title)
      } icon: {
        Image(systemName: "book")
          .accessibilityHidden(true)
      }
    } description: {
      Text(outline.description)
    } actions: {
      if let start = guestStart.start {
        BusyButton(isBusy: isStarting) {
          isStarting = true
          startFailed = false
          starting = Task {
            if await start() {
              reload()
            } else {
              startFailed = true
            }
            isStarting = false
          }
        } label: {
          Text(
            "Start this lesson", tableName: "Player",
            comment: "A visitor starts a public lesson as a guest")
        }
        .buttonStyle(.mainAction)

        if startFailed {
          FailureLine(
            message: LocalizedStringResource(
              "We couldn't open this lesson", table: "Player",
              comment: "A lesson failed to open")
          )
          .font(.footnote)
        }
      } else {
        Button {
          routes.signIn()
        } label: {
          Text("Sign in", tableName: "Player", comment: "A visitor signs in to play a lesson")
        }
        .buttonStyle(.mainAction)
      }
    }
    .onDisappear {
      starting?.cancel()
    }
  }
}

struct LessonPlayerRoutes: Sendable {
  let signIn: @MainActor @Sendable () -> Void
  /// "Build my plan" after a guest's lesson: the lesson's course as their goal, from its chapter
  /// when that's where they began (`chapterId`), else from the course's start (`.courseStart`).
  let startCourse: @MainActor @Sendable (_ courseId: String, _ chapterId: String?) -> Void
  let startGoal: @MainActor @Sendable (_ goal: String) -> Void

  static let none = LessonPlayerRoutes(signIn: {}, startCourse: { _, _ in }, startGoal: { _ in })
}

extension EnvironmentValues {
  @Entry var lessonPlayerRoutes: LessonPlayerRoutes = .none
}
