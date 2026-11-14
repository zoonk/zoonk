import SwiftUI

struct LessonCompletionView: View {
  @Environment(AppRouter.self) private var router
  @State private var showsSaveReport = false
  let completion: LessonPlayerState.Completion
  let correct: Int
  let answered: Int
  let soundsEnabled: Bool
  var guestEnding: LessonGuestEnding?
  /// A spread shows the lesson's map under what was done; one column keeps it in the menu.
  var lesson: PlayableLesson?
  let finish: () -> Void
  let close: () -> Void

  @State private var reminderOffer: ReminderOfferState?

  var body: some View {
    PaneSplit {
      page {
        moment
        dayMoment
        finishedChapter

        if let lesson, let summary = lesson.summary {
          LessonMapSection(title: lesson.title, summary: summary)
        }
      }
    } secondary: {
      page {
        planRevealRow
        reminderOfferCard
        guestEndingView
      }
      .bottomBar { actionBar }
    } single: {
      page {
        moment
        dayMoment
        finishedChapter
        planRevealRow
        reminderOfferCard
        guestEndingView
      }
      .bottomBar { actionBar }
    }
    .onChange(of: offer, initial: true) {
      if let offer, reminderOffer == nil {
        reminderOffer = ReminderOfferState(
          time: ReminderTime.rounded(offer.time), timeZone: offer.timeZone)
      }
    }
    .completionMoments(day)
    .feedbackSheet(
      isPresented: $showsSaveReport,
      context: FeedbackContext(screen: "lesson-end", reportType: .saveFailure), isReport: true
    )
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
      title
        .typeStyle(.heroTitle)
        .accessibilityAddTraits(.isHeader)
    }

    switch completion.status {
    case .ready:
      EmptyView()
    case .saving:
      ProgressView()
    case .failed:
      SaveFailureNotice(
        failures: completion.saveFailures,
        firstMessage: LocalizedStringResource(
          "That didn't go through. Your answers are kept.", table: "Player",
          comment: "Under the title of a finished lesson whose save failed, above Try again"),
        onReport: { showsSaveReport = true })
    case .saved:
      if let summary = completion.summary {
        Group {
          readouts(summary)

          if let block = summary.block {
            DayProgressBlock(moment: block)
          }
        }
        .celebratesOnce(id: summary)
      }
    }
  }

  /// Only a saved lesson says it's complete: until then the server can still send the learner back
  /// to a question.
  @ViewBuilder
  private var title: some View {
    switch completion.status {
    case .saving:
      Text(
        "Saving your progress…", tableName: "Player",
        comment: "In place of a lesson's end title until the lesson is saved"
      )
      .foregroundStyle(.mutedForeground)
    case .failed:
      Text(
        "Your lesson isn't saved yet", tableName: "Player",
        comment: "Title at a lesson's end when saving it failed")
    case .ready, .saved:
      if completion.testedOut {
        Text(
          "You already knew this", tableName: "Player",
          comment: "Title after \"I already know this\" passed every check")
      } else {
        Text("Lesson complete", tableName: "Player", comment: "Title at the end of a lesson")
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

  private var offer: ReminderOffer? {
    completion.status == .saved ? completion.summary?.block?.reminderOffer : nil
  }

  @ViewBuilder
  private var reminderOfferCard: some View {
    if let offer = Binding($reminderOffer) {
      ReminderOfferCard(offer: offer)
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
  private var finishedChapter: some View {
    if completion.status == .saved, let chapter = completion.summary?.finishedChapter {
      FinishedChapterSection(chapter: chapter)
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
            )
          }
        case .failed:
          Button(action: finish) {
            Text("Try again", tableName: "Player", comment: "Tries saving the lesson again")
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
            )
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
            Text("Continue", tableName: "Player", comment: "Leaves the finished lesson")
          }
          .disabled(completion.status == .saving)
        }
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
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

      if let studied = studied(summary.seconds) {
        Text(studied)
          .typeStyle(.note.monospacedDigit())
          .foregroundStyle(.mutedForeground)
      }

      if let catchUp = summary.block?.dayProgress.catchUp {
        CatchUpLine(catchUp: catchUp)
      }
    }
  }

  private func studied(_ seconds: Int) -> String? {
    guard seconds > 0 else { return nil }

    return String(
      localized: "\(progressLearningTime(seconds)) studied",
      table: "Player",
      comment: "The study time this lesson counted; the argument is a duration like '4 min'")
  }
}

/// Never a dead end. As a screen it is main's `lesson-access-screen`: the reason as the title, at
/// most one line, and the one way on in the bottom bar (a free learner's is "Subscribe", and the
/// close button leaves). `isNotice` is main's `LessonNotWrittenNotice`: a lesson whose writing was
/// refused says so under its description, start-aligned with a small button.
struct LessonUnavailableView: View {
  @Environment(\.dismiss) private var dismiss

  let refusal: LessonRunRefusal
  var isNotice = false
  let retry: () -> Void

  var body: some View {
    if isNotice {
      VStack(alignment: .leading, spacing: 8) {
        GateWords(title: Text(title), line: noticeLine.map(Text.init))

        action
          .buttonStyle(.outline)
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
        if let line = screenLine {
          Text(line)
        }
      }
      .bottomBar {
        action
          .buttonStyle(.mainAction)
      }
      .task(id: refusal) {
        // Main's `LessonSlowDown`: the lesson opens on its own once the break is over.
        if case .slowDown(let seconds) = refusal,
          (try? await Task.sleep(for: .seconds(seconds))) != nil
        {
          retry()
        }
      }
    }
  }

  var said: String {
    let line = isNotice ? noticeLine.map { String(localized: $0) } : screenLine
    return ([String(localized: title)] + [line].compactMap(\.self)).joinedSentences()
  }

  @ViewBuilder
  private var action: some View {
    switch refusal {
    case .failed:
      Button(action: retry) {
        Text("Try again", tableName: "Player", comment: "Tries opening the lesson again")
      }
    case .slowDown:
      if isNotice {
        Button(action: retry) {
          Text("Try again", tableName: "Player", comment: "Tries opening the lesson again")
        }
      }
    case .limitReached(tier: .free, _):
      SubscribeButton()
    case .limitReached(tier: .guest, _):
      SignUpButton()
    case .limitReached(tier: .plus, _), .notFound:
      if !isNotice {
        Button {
          dismiss()
        } label: {
          Text("Back", tableName: "Player", comment: "Leaves a lesson that can't open")
        }
      }
    }
  }

  private var title: LocalizedStringResource {
    switch refusal {
    case .failed:
      LocalizedStringResource(
        "We couldn't open this lesson", table: "Player", comment: "A lesson failed to open")
    case .slowDown:
      LocalizedStringResource(
        "Take a short break", table: "Player", comment: "Fair use spaces new lessons out")
    case .notFound:
      LocalizedStringResource(
        "This lesson isn't available", table: "Player", comment: "The lesson doesn't exist anymore")
    case .limitReached:
      refusal.limit?.lessonWords.title
        ?? LocalizedStringResource(
          "We couldn't open this lesson", table: "Player", comment: "A lesson failed to open")
    }
  }

  /// In place, a limit's line says only when lessons come back.
  private var noticeLine: LocalizedStringResource? {
    refusal.limit?.lessonWords.line
  }

  private var screenLine: String? {
    switch refusal {
    case .failed, .notFound:
      return nil
    case .slowDown(let seconds):
      return String(
        localized:
          "You opened a lot of lessons quickly. This one opens on its own in \(Duration.seconds(seconds).formatted(.units(allowed: [.minutes, .seconds], width: .wide))).",
        table: "Player", comment: "How long until the next lesson opens; the argument is a duration"
      )
    case .limitReached(.guest, _):
      return String(
        localized: "Everything you learned comes with you.", table: "Player",
        comment: "A guest used the lessons they can try; signing up keeps their progress")
    case .limitReached:
      let stillFree = String(
        localized: "You can still review and practice your mistakes.", table: "Player")
      return ([stillFree] + [noticeLine.map { String(localized: $0) }].compactMap(\.self))
        .joinedSentences()
    }
  }

  private var symbol: String {
    switch refusal {
    case .failed, .notFound: "exclamationmark.circle"
    case .slowDown, .limitReached(.plus, _): "hourglass"
    case .limitReached(.free, _): "sparkles"
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

extension LessonRunRefusal {
  /// The refusal as the limit every limit notice reads; a lesson that failed or is gone has none.
  var limit: HelpLimit? {
    switch self {
    case .slowDown(let seconds):
      .slowDown(retryAfterSeconds: seconds)
    case .limitReached(_, .last30Days(let opensAt)):
      .freeLessonsUsed(opensAt: opensAt)
    case .limitReached(let tier, let period):
      .limitReached(period: period.helpPeriod, tier: tier.learnerTier)
    case .failed, .notFound:
      nil
    }
  }
}

extension LessonRunRefusal.Tier {
  fileprivate var learnerTier: LearnerTier {
    switch self {
    case .guest: .guest
    case .free: .free
    case .plus: .plus
    }
  }
}

extension LessonRunRefusal.Period {
  /// `last30Days` is read as `freeLessonsUsed` before it gets here.
  fileprivate var helpPeriod: HelpLimit.Period {
    switch self {
    case .day: .day
    case .month, .last30Days: .month
    case .total: .total
    }
  }
}

/// Main's `LessonWaiting`: the lesson's description, then how its writing stands, and once that
/// takes a while something ready to do meanwhile. Only the learner asks for the lesson to be
/// written: it runs AI.
struct LessonWaitingView: View {
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
        let writingTitle =
          progress.kind == .challenge
          ? Text(
            "Getting your challenge ready", tableName: "Player",
            comment: "The challenge's status over the quiz while it's made")
          : Text(Self.gettingReady)
        let title = holding == nil ? writingTitle : Text(Self.ready)
        let shown = holding == nil && writing == .writing ? progress : progress.finished

        WaitScreen(
          deck: WaitDeck(id: warmUpID), goalID: goalID, progressTitle: title,
          ready: holding.map { holding in
            WaitReady(
              label: Text(
                "Start this lesson", tableName: "Player",
                comment: "Opens a goal's first lesson, made while the learner played on its wait"),
              action: holding.moveOn)
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
    .bottomBar {
      if holding == nil, writing == .notStarted {
        Button(action: write) {
          Text(
            "Get it ready", tableName: "Player",
            comment: "Starts making a lesson that isn't ready yet; it opens once it's ready")
        }
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
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
          "This lesson isn't ready yet", tableName: "Player",
          comment: "Under a lesson's description, before the learner asks for it to be made"),
        description: Text(Self.takesMinutes))
    case (nil, .refused(let refusal)):
      LessonUnavailableView(refusal: refusal, isNotice: true, retry: write)
    case (nil, .setAside):
      LessonNoticeText(title: Text(Self.setAsideTitle), description: Text(Self.setAsideLine))
    case (nil, .failed):
      Text(
        "We couldn't get this lesson ready", tableName: "Player",
        comment: "Making a lesson stopped; its retry is under the progress"
      )
      .typeStyle(.rowTitle)

      // A run that reported a phase stopped there; otherwise it never got going.
      GenerationTimeline(
        wait: progress,
        failure: progress.phases.contains(where: \.isReported) ? .generation : .notStarted,
        act: write)
    case (_?, _), (nil, .writing), (nil, .written):
      VStack(alignment: .leading, spacing: 24) {
        if holding == nil {
          LessonNoticeText(title: Text(Self.gettingReady), description: Text(Self.takesMinutes))
        } else {
          Text(Self.ready)
            .typeStyle(.rowTitle)
        }

        GenerationTimeline(
          wait: holding == nil && writing == .writing ? progress : progress.finished)
      }
    }
  }

  private var shownAlternative: LessonWaitAlternative? {
    guard let alternative, holding == nil else {
      return nil
    }

    return switch writing {
    case .refused, .setAside, .failed: LessonWaitAlternative(alternative: alternative)
    case .writing where isLate: LessonWaitAlternative(alternative: alternative)
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

  private static let gettingReady = LocalizedStringResource(
    "Getting your lesson ready", table: "Player", comment: "While a lesson is made")

  static let ready = LocalizedStringResource(
    "Your lesson is ready", table: "Player",
    comment: "A lesson made while the learner waited, before they start it")

  private static let takesMinutes = LocalizedStringResource(
    "It takes a few minutes, and keeps going if you leave.", table: "Player",
    comment: "How long making a lesson takes; it goes on when the learner leaves")

  private static let setAsideTitle = LocalizedStringResource(
    "This lesson isn't available", table: "Player",
    comment: "Every draft of a lesson was held back by its quality checks")

  private static let setAsideLine = LocalizedStringResource(
    "Your plan goes on without it.", table: "Player",
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

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(
        "Ready to start now", tableName: "Player",
        comment:
          "Heading over a lesson or review the learner can start now, while or instead of the lesson that isn't ready"
      )
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
