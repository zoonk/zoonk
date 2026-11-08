import SwiftUI

struct LessonCompletionView: View {
  @Environment(AppRouter.self) private var router
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
        planRevealRow
        guestEndingView
      }
      .safeAreaBar(edge: .bottom) { actionBar }
    } single: {
      page {
        moment
        dayMoment
        planRevealRow
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
      .typeStyle(.heroTitle)
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
      .foregroundStyle(.mutedForeground)
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
      .typeStyle(.section)
      .accessibilityAddTraits(.isHeader)

      Text(
        "Finish to see how it went.", tableName: "Player",
        comment: "Under the title of a lesson opened again with every step answered"
      )
      .foregroundStyle(.mutedForeground)
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

  private var planReveal: PlanRevealLead? {
    completion.status == .saved ? completion.summary?.planReveal : nil
  }

  /// Main's `LessonCompletionPlan`: what the goal's first lesson leads to before its plan was seen.
  @ViewBuilder
  private var planRevealRow: some View {
    if let planReveal {
      VStack(alignment: .leading, spacing: 8) {
        Text("What's next", tableName: "Player", comment: "Header over where a lesson leads")
          .sectionTitleStyle()

        HStack(alignment: .firstTextBaseline, spacing: 12) {
          if planReveal.planReady {
            StatusMark(status: .done)
          } else {
            Image(systemName: "map")
              .foregroundStyle(.mutedForeground)
              .frame(width: 20)
              .accessibilityHidden(true)
          }

          VStack(alignment: .leading, spacing: 2) {
            if planReveal.planReady {
              Text(
                "Your plan is ready", tableName: "Player",
                comment: "At a first lesson's end: the goal's plan was built meanwhile")
            } else {
              Text(
                "Building your plan", tableName: "Player",
                comment: "At a first lesson's end: the goal's plan is still being built")
            }

            Text(planReveal.goalTitle)
              .typeStyle(.meta)
              .foregroundStyle(.mutedForeground)
          }
          .typeStyle(.rowTitle)
        }
        .accessibilityElement(children: .combine)
      }
    }
  }

  /// The plan's setup takes it from here: its wait while the plan is built, daily time when it's
  /// unanswered, then the reveal. A setup already under the lesson is gone back to.
  private func seePlan(_ lead: PlanRevealLead) {
    router.dismissTask()

    switch router.tasks.last {
    case .goalSetup(let goalID)? where goalID == lead.goalID:
      break
    case .startGoal?:
      break
    default:
      router.open(.goalSetup(goalId: lead.goalID))
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
        case .saved where planReveal != nil:
          Button {
            if let planReveal {
              seePlan(planReveal)
            }
          } label: {
            Text(
              "See your plan", tableName: "Player",
              comment: "Ends a goal's first lesson for the plan the learner hasn't seen yet"
            ).frame(maxWidth: .infinity)
          }
        case .saving, .saved:
          Button {
            if let moment = completion.summary?.block, let next = moment.next,
              next.opensInPlayer, let lessonID = next.block.lessonId, let blockID = next.block.id
            {
              router.dismissTask()
              router.openStudy(
                .instantLesson(
                  lessonID: lessonID, sessionID: moment.sessionId,
                  opening: .block(blockID)))
            } else {
              close()
            }
          } label: {
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

    // Main's `MomentReadouts`: each number with its words beside it, on one baseline.
    return VStack(alignment: .leading, spacing: 12) {
      FlowLayout(spacing: 32, alignment: .firstTextBaseline) {
        if answered > 0 {
          MomentReadout {
            Text("\(summary.correctCount)/\(answered)")
          } words: {
            Text("Right", tableName: "Player", comment: "Label under the lesson's score")
          }
        }

        if summary.brainPower > 0 {
          MomentReadout(tint: .brainText) {
            EarnedNumber(value: summary.brainPower)
          } words: {
            Text(
              "Brain Power", tableName: "Player",
              comment: "Label under the Brain Power a lesson earned")
          }
        }
      }

      if let reviewAt = summary.nextReviewAt {
        Text(
          "Review on \(reviewAt.formatted(.dateTime.day().month(.abbreviated)))",
          tableName: "Player",
          comment: "When the lesson's idea comes back for review"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
    }
  }
}

/// Never a dead end. `isNotice` is main's `LessonNotWrittenNotice`: a lesson its writing was
/// refused for says so under its description, start-aligned with small buttons, instead of the
/// centered state a lesson that can't open takes.
struct LessonUnavailableView: View {
  @Environment(\.dismiss) private var dismiss

  let refusal: LessonRunRefusal
  var isNotice = false
  let retry: () -> Void

  var body: some View {
    if isNotice {
      VStack(alignment: .leading, spacing: 12) {
        LessonNoticeText(title: Text(title), description: Text(description))

        HStack(spacing: 8) {
          actions
        }
        .controlSize(.small)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } else {
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
  }

  /// A notice's buttons are all quiet: the screen's own bar holds its main action.
  private var mainStyle: ZoonkButtonStyle {
    isNotice ? .outline : .mainAction
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
      .buttonStyle(mainStyle)
    case .slowDown:
      Button(action: retry) {
        Text("Try again", tableName: "Player", comment: "Tries opening the lesson again")
      }
      .buttonStyle(.outline)
    case .plusRequired, .limitReached(tier: .free, _):
      SeePlusButton()
        .buttonStyle(mainStyle)
        .onAppear {
          UsageAnalytics.track(.subscriptionGateShown)
        }

      if !isNotice {
        backButton
      }
    case .limitReached(tier: .guest, _):
      SignUpButton()
        .buttonStyle(mainStyle)
    case .limitReached(tier: .plus, _), .notFound:
      if !isNotice {
        backButton
      }
    }
  }

  private var backButton: some View {
    Button {
      dismiss()
    } label: {
      Text("Back", tableName: "Player", comment: "Leaves a lesson that can't open")
    }
    .buttonStyle(.outline)
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
                    .typeStyle(.body.weight(.semibold))
                  Text(
                    "\(course.chapterCount) chapters\u{00A0}· about \(Duration.seconds(max(1, (course.minutes + 30) / 60) * 3600).formatted(.units(allowed: [.hours], width: .wide))) at your pace",
                    tableName: "Player", comment: "A course's size at the end of a guest's lesson"
                  )
                  .typeStyle(.note)
                  .foregroundStyle(.mutedForeground)
                }
              } icon: {
                Image(systemName: "book")
              }
            }

            VStack(alignment: .leading, spacing: 6) {
              HStack(alignment: .firstTextBaseline) {
                Text(fit.chapterTitle)
                  .typeStyle(.meta.weight(.medium))
                Spacer()
                Text(
                  "\(fit.lessonNumber) of \(fit.lessonCount) lessons", tableName: "Player",
                  comment: "The lesson's place in its chapter"
                )
                .typeStyle(.data)
                .foregroundStyle(.mutedForeground)
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
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)

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
        .buttonStyle(.outline)
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
          .buttonStyle(.mainAction)
      case .limitReached(.free, _):
        SeePlusButton()
          .buttonStyle(.outline)
      default:
        EmptyView()
      }
    }
    .typeStyle(.note)
    .foregroundStyle(.mutedForeground)
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

/// Main's `LessonWaiting`: the lesson's description, then how its writing stands, and once that
/// takes a while something ready to do meanwhile. Only the learner asks for the lesson to be
/// written: it runs AI.
struct LessonWaitingView: View {
  static let lessonReady = LocalizedStringResource(
    "Your lesson is ready. Start it whenever you like.", table: "Player",
    comment: "A goal's first lesson is written while the learner still guesses on its wait")

  /// Main's `ALTERNATIVE_AFTER_MS`: a wait this long offers what's ready meanwhile.
  private static let lateAfter = Duration.seconds(15)

  let outline: LessonOutline
  let writing: LessonPlayerStore.LessonWriting
  let progress: GenerationWait
  var alternative: Components.Schemas.ReadyAlternative?
  var warmUpID: String?
  /// The learner's active goal, whose clock the wait and its quiz join.
  var goalID: String?
  var holding: WaitHolding?
  let write: () -> Void

  @State private var isLate = false

  var body: some View {
    Group {
      if let warmUpID {
        let title =
          holding == nil
          ? Text(
            "Writing your lesson", tableName: "Player",
            comment: "The lesson's status over the quiz while it's written")
          : Text(
            "Your lesson is ready", tableName: "Player",
            comment: "The lesson's status over the quiz once it's written")
        let shown = holding == nil && writing == .writing ? progress : progress.finished

        WaitScreen(
          deckID: warmUpID, goalID: goalID, progressTitle: title,
          ready: holding.map { holding in
            WaitReady(
              label: Text(
                "Start this lesson", tableName: "Player",
                comment: "Opens a goal's first lesson, written while the learner played on its wait"
              ),
              icon: .play, action: holding.moveOn)
          }
        ) {
          WaitStatusStrip(
            label: title, isDone: holding != nil, share: { shown.shownShare(at: $0) })
        } progress: {
          Section {
            page
          }
          .listRowBackground(Color.clear)
          .listRowSeparator(.hidden)

          if let shownAlternative {
            Section {
              shownAlternative
            }
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
          }
        }
      } else {
        ScrollView {
          VStack(alignment: .leading, spacing: 24) {
            page
            shownAlternative
          }
          .frame(maxWidth: 680, alignment: .leading)
          .frame(maxWidth: .infinity)
          .scenePadding()
        }
      }
    }
    .safeAreaBar(edge: .bottom) {
      if holding == nil, writing == .notStarted {
        Button(action: write) {
          Text(
            "Start this lesson", tableName: "Player",
            comment: "Starts a lesson that isn't written yet: it's written, then opens"
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .keyboardShortcut(.defaultAction)
        .frame(maxWidth: 680)
        .frame(maxWidth: .infinity)
        .scenePadding()
      }
    }
    .announcesStatus(notWrittenLine)
    .measuresWait(
      surface: "lessonWait", contentKind: "lesson", isActive: writing == .writing || holding != nil,
      goalID: goalID
    )
    .task(id: writing) {
      isLate = false

      guard writing == .writing else {
        return
      }

      try? await Task.sleep(for: Self.lateAfter)
      isLate = !Task.isCancelled
    }
  }

  private var page: some View {
    VStack(alignment: .leading, spacing: 24) {
      Text(outline.description)
        .typeStyle(.reading)
        .foregroundStyle(.mutedForeground)

      status
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder
  private var status: some View {
    switch (holding, writing) {
    case (nil, .notStarted):
      LessonNoticeText(
        title: Text(
          "This lesson isn't written yet", tableName: "Player",
          comment: "Under a lesson's description, before the learner starts it and it's written"),
        description: Text(
          "Zoonk writes it when you start. It takes a few minutes.", tableName: "Player",
          comment: "A lesson not written yet"))
    case (nil, .refused(let refusal)):
      LessonUnavailableView(refusal: refusal, isNotice: true, retry: write)
    case (nil, .setAside):
      LessonNoticeText(title: Text(Self.setAsideTitle), description: Text(Self.setAsideLine))
    case (nil, .failed):
      // A run that reported a phase stopped there; otherwise it never got going.
      GenerationTimeline(
        wait: progress,
        failure: progress.phases.contains(where: \.isReported) ? .generation : .notStarted,
        act: write)
    case (_?, _), (nil, .writing), (nil, .written):
      VStack(alignment: .leading, spacing: 24) {
        GenerationTimeline(
          wait: holding == nil && writing == .writing ? progress : progress.finished)

        Text(holding == nil ? Self.writingLine : Self.lessonReady)
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)
      }
    }
  }

  private var shownAlternative: LessonWaitAlternative? {
    guard let alternative, holding == nil else {
      return nil
    }

    return switch writing {
    case .refused, .setAside: LessonWaitAlternative(alternative: alternative, isInstead: true)
    case .failed: LessonWaitAlternative(alternative: alternative, isInstead: false)
    case .writing where isLate: LessonWaitAlternative(alternative: alternative, isInstead: false)
    default: nil
    }
  }

  private var notWrittenLine: String? {
    guard holding == nil else {
      return nil
    }

    return switch writing {
    case .refused(let refusal): LessonUnavailableView(refusal: refusal) {}.said
    case .setAside:
      [String(localized: Self.setAsideTitle), String(localized: Self.setAsideLine)]
        .joinedSentences()
    default: nil
    }
  }

  private static let writingLine = LocalizedStringResource(
    "It usually takes a few minutes. The lesson opens here as soon as it's ready.",
    table: "Player",
    comment: "While a lesson is written")

  private static let setAsideTitle = LocalizedStringResource(
    "This lesson isn't available", table: "Player",
    comment: "Every draft of a lesson was held back by its quality checks")

  private static let setAsideLine = LocalizedStringResource(
    "It didn't pass our quality checks, so your plan goes on without it.", table: "Player",
    comment: "Every draft of a lesson was held back by its quality checks")
}

/// Main's notice under a lesson's description: what happened in medium words, then its line.
private struct LessonNoticeText: View {
  let title: Text
  let description: Text

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      title
        .typeStyle(.rowTitle)
        .foregroundStyle(Color(.foreground))

      description
        .foregroundStyle(.mutedForeground)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
  }
}

/// Main's `Alternative`: a lesson that's written, or the reviews that are due, ready to do now.
private struct LessonWaitAlternative: View {
  @Environment(AppRouter.self) private var router

  let alternative: Components.Schemas.ReadyAlternative
  /// Offered in place of a lesson that won't be written, rather than while it is.
  let isInstead: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Group {
        if isInstead {
          Text(
            "Ready to do instead", tableName: "Player",
            comment:
              "Heading over a lesson or review the learner can start now, because this lesson couldn't be written."
          )
        } else {
          Text(
            "Ready while you wait", tableName: "Player",
            comment:
              "Heading over a lesson or review the learner can start while a lesson is written"
          )
        }
      }
      .typeStyle(.label)
      .foregroundStyle(.mutedForeground)
      .accessibilityAddTraits(.isHeader)

      Button(action: open) {
        HStack(spacing: 12) {
          KindMark(kind: kind)

          title
            .typeStyle(.rowTitle)
            .foregroundStyle(Color(.foreground))
            .frame(maxWidth: .infinity, alignment: .leading)

          DisclosureChevron()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 11)
        .frame(minHeight: 44)
        .background(.muted, in: .rect(cornerRadius: Radius.lg, style: .continuous))
        .contentShape(.rect)
      }
      .buttonStyle(.plain)
      .padding(.horizontal, -10)
    }
  }

  private var kind: LearnKind {
    if case .case1 = alternative { .lesson } else { .review }
  }

  private var title: Text {
    switch alternative {
    case .case1(let lesson):
      Text(lesson.title)
    case .case2(let review):
      Text(
        "Review \(review.dueSkills) ideas", tableName: "Player",
        comment: "Opens Today, where the ideas due for review are: ready while a lesson is written")
    }
  }

  private func open() {
    switch alternative {
    case .case1(let lesson):
      router.dismissTask()
      router.open(.lesson(lessonId: lesson.lessonId))
    case .case2:
      router.showRoot(of: .today)
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
        BusyButton(isBusy: isStarting, icon: .play) {
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
          .typeStyle(.note)
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
