import SwiftUI

/// The reveal waits for the plan it reads, as main's does. An exam's plan first waits for research to
/// read its official documents, so the learner sees the plan they follow.
struct PlanStep: View {
  let view: GoalOnboarding

  @Environment(OnboardingStore.self) private var onboarding
  @Environment(PlanStore.self) private var plans
  /// Once the wait shows, reading the plan again never swaps it for a spinner.
  @State private var isWaiting = false

  private static var noticeCheck: Duration { .seconds(3) }

  var body: some View {
    let plan = plans.plan(goalId: view.goal.id)
    let read = plan.value?.plan
    let wait = Self.wait(read)

    PlanWaits(wait: wait) { holding in
      switch (plan.state, isWaiting) {
      case (.idle, false), (.loading, false):
        StepLoading()
      default:
        PlanBuilding(view: view, holding: holding, readResult: { await readUntilReady(plan) })
          .onAppear { isWaiting = true }
      }
    } notice: { holding in
      if let read {
        NoticeReadingView(
          document: read.examDocument, lastEdition: read.schedule.targetDateEstimated,
          deck: onboarding.waitDeck(for: view), goalID: view.goal.id, next: .reveal,
          holding: holding)
      }
    } ready: {
      if let read {
        PlanReveal(view: view, plan: read)
      }
    }
    .taskThroughPush(id: wait) {
      guard wait == .readingNotice else {
        return
      }

      while true {
        do {
          try await Task.sleep(for: Self.noticeCheck)
        } catch {
          return
        }

        await plan.refresh()
      }
    }
    .loads(plan, refreshable: false)
  }

  /// Main's plan wait on the reveal: the build, then an exam's notice being read.
  private static func wait(_ plan: GoalPlan?) -> ScheduleTime.Wait? {
    guard let plan, plan.ready else {
      return .building
    }

    return plan.notice == .reading ? .readingNotice : nil
  }

  private func readUntilReady(_ plan: Resource<PlanRead>) async -> Bool {
    for attempt in 0..<5 {
      await plan.refresh()

      if plan.value?.plan.ready == true {
        return true
      }

      do {
        try await Task.sleep(for: .seconds(attempt + 1))
      } catch {
        return true
      }
    }

    return false
  }
}

/// The plan's two waits: its build, then, for an exam, its notice being read. Each holds on its own:
/// playing on the build's doesn't hold the notice's after it.
struct PlanWaits<Building: View, Notice: View, Ready: View>: View {
  let wait: ScheduleTime.Wait?
  @ViewBuilder let building: (WaitHolding?) -> Building
  @ViewBuilder let notice: (WaitHolding?) -> Notice
  @ViewBuilder let ready: () -> Ready

  /// The notice's wait stays once the reading ends, for a learner still playing on it.
  @State private var readsNotice = false

  var body: some View {
    // A Group would give each wait its own `onChange`.
    ZStack {
      if wait == .readingNotice || (wait == nil && readsNotice) {
        hold(notice)
      } else {
        hold(building)
      }
    }
    .onChange(of: wait, initial: true) { _, wait in
      if let wait {
        readsNotice = wait == .readingNotice
      }
    }
  }

  private func hold<Wait: View>(_ wait: @escaping (WaitHolding?) -> Wait) -> some View {
    WaitHold(surface: .planWait, isReady: self.wait == nil, announcement: .planReady) { stage in
      switch stage {
      case .waiting(let holding): wait(holding)
      case .ready: ready()
      }
    }
  }
}

/// Where the plan's waits lead.
enum PlanNext {
  case reveal
  case timeQuestion

  /// Under "Your plan is ready" while a learner who played stays.
  var readyDescription: LocalizedStringResource {
    switch self {
    case .reveal:
      LocalizedStringResource(
        "See it whenever you're ready.", table: "Onboarding",
        comment: "Under \"Your plan is ready\" when the plan shows next")
    case .timeQuestion:
      LocalizedStringResource(
        "One last question, then you'll see it.", table: "Onboarding",
        comment: "Under \"Your plan is ready\" when the time question comes before the plan")
    }
  }

  /// The bar's action once the plan is ready, for a learner who stayed.
  func ready(_ holding: WaitHolding) -> WaitReady {
    switch self {
    case .reveal:
      WaitReady(
        label: Text(
          "See your plan", tableName: "Onboarding",
          comment: "Leaves the plan's wait, once the plan is ready, for the plan"),
        action: holding.moveOn)
    case .timeQuestion:
      WaitReady(
        note: readyDescription, noteOnQuizOnly: true,
        label: Text(
          "Continue", tableName: "Onboarding",
          comment: "Leaves the plan's wait, once the plan is ready, for the time question"),
        action: holding.moveOn)
    }
  }
}

/// Main's plan wait while the plan is built, which both the reveal and the time question wait for:
/// the build as a strip over the quiz, lesson 1 written alongside it.
struct PlanBuilding: View {
  let view: GoalOnboarding
  var next = PlanNext.reveal
  var holding: WaitHolding?
  let readResult: () async -> Bool
  var onRunEnd: (() -> Void)?
  /// Set once asking the plan failed: shows that, with the way to ask again.
  var reconnect: (() -> Void)?

  @Environment(AppRouter.self) private var router
  @Environment(OnboardingStore.self) private var onboarding

  var body: some View {
    GenerationFollower(
      generationID: view.generationId,
      kind: .curriculum,
      readGenerationID: {
        let goal = onboarding.onboarding(goalID: view.goal.id)
        await goal.refresh()
        return goal.value?.generationId
      },
      restart: { try await onboarding.writeGoal(goalID: view.goal.id) },
      readResult: readResult,
      onRunEnd: onRunEnd
    ) { run in
      let firstLesson = run.wait.firstLesson(
        read: view.firstLesson.map(GenerationWait.FirstLesson.init))
      let wait = holding == nil ? run.wait : run.wait.finished
      let failure = holding == nil ? run.failure : nil
      let ready = ready(firstLesson)

      WaitScreen(
        deck: deck(run),
        goalID: view.goal.id,
        progressTitle: Text(title),
        ready: ready,
        library: ready == nil
          ? view.libraryCourse.map {
            WaitLibraryCourse(courseID: $0.courseId, title: $0.title)
          } : nil
      ) {
        if let failure {
          GenerationFailureNotice(failure: failure, isActing: run.isRestarting, act: run.retry)
        } else if let reconnect {
          GenerationFailureNotice(failure: .connection, act: reconnect)
        } else {
          WaitStatusStrip(
            label: Text(title), isDone: holding != nil, share: { wait.shownShare(at: $0) },
            firstLesson: firstLesson?.isDone == true ? nil : firstLesson)
        }
      } progress: {
        WaitHeading(
          title: Text(title),
          description: Text(
            holding != nil
              ? next.readyDescription
              : run.isStopped
                ? LocalizedStringResource(
                  "Your answers are saved.", table: "Onboarding",
                  comment: "Shown when a goal's plan stopped building, over the way to try again")
                : LocalizedStringResource(
                  "We're choosing what to learn first and fitting it into your days. A new subject can take a minute or two.",
                  table: "Onboarding", comment: "Shown while a goal's plan is built")))

        Section {
          GenerationTimeline(
            wait: wait, failure: failure, isActing: run.isRestarting, act: run.retry)
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)

        if let reconnect {
          GenerationFailureSection(failure: .connection, act: reconnect)
        }

        if let firstLesson {
          FirstLessonSection(lesson: firstLesson, clockOffset: run.wait.clockOffset)
        }
      }
    }
    .measuresWait(
      surface: "planWait", contentKind: "curriculum", goalID: view.goal.id,
      onboardingID: view.onboardingID)
  }

  private var title: LocalizedStringResource {
    holding == nil
      ? LocalizedStringResource(
        "Building your plan", table: "Onboarding", comment: "Title while a goal's plan is built")
      : .planReady
  }

  /// Plan first when both are ready; lesson 1 first offers itself while the plan is still built.
  /// The run this wait follows has the last word on its deck: ready, or none coming once it stopped.
  private func deck(_ run: FollowedRun) -> WaitDeck {
    if let id = run.warmUpID {
      return WaitDeck(id: id)
    }

    var deck = onboarding.waitDeck(for: view)
    deck.isComing = deck.isComing && !run.isStopped
    return deck
  }

  private func ready(_ firstLesson: GenerationWait.FirstLesson?) -> WaitReady? {
    if let holding {
      return next.ready(holding)
    }

    guard let firstLesson, firstLesson.isReady, !firstLesson.isDone else {
      return nil
    }

    return WaitReady(
      note: LocalizedStringResource(
        "Your plan will be waiting when you finish.", table: "Onboarding",
        comment: "Over Start lesson 1, while the plan is still built"),
      label: Text(
        "Start lesson 1", tableName: "Onboarding",
        comment: "Opens the goal's first lesson, written before its plan"),
      icon: .play
    ) {
      router.open(.lesson(lessonId: firstLesson.id))
    }
  }
}

extension GenerationWait.FirstLesson {
  init(_ read: Components.Schemas.Onboarding.FirstLessonPayload) {
    self.init(
      id: read.id, title: read.title, isReady: read.status != .writing, isDone: read.status == .done
    )
  }
}

extension LocalizedStringResource {
  static var planReady: LocalizedStringResource {
    LocalizedStringResource(
      "Your plan is ready", table: "Onboarding",
      comment: "Title of the plan's wait once the plan is ready, for a learner still playing")
  }
}

/// Main's `RevealNoticeDay`: research found the exam's day after the plan was built, or the month
/// the learner named has no sitting; the plan keeps its date until the learner switches.
private struct RevealNoticeDay: View {
  @Environment(PlanStore.self) private var plans
  @Binding var isSaving: Bool
  @Binding var failed: Bool

  let goalID: String
  let plan: GoalPlan

  var body: some View {
    let schedule = plan.schedule

    if plan.notice != .usual {
      if let noticeDay = schedule.noticeDay {
        Section {
          planNoticeDayText(noticeDay, document: plan.examDocument)

          BusyButton(isBusy: isSaving, isRow: true) {
            use(noticeDay.date)
          } label: {
            Text("Use this date", tableName: "Plan", comment: "Takes the notice's day as the date")
          }

          failure
        }
      } else if let noSitting = schedule.noSitting, let month = studyDate(noSitting.month) {
        Section {
          Text(
            "No exam date in \(month.formatted(.studyDay.month(.wide)))", tableName: "Exam",
            comment: "An exam with no sitting in the learner's month")

          ForEach(noSitting.closest, id: \.self) { closest in
            if let date = studyDate(closest) {
              Button {
                use(closest)
              } label: {
                Text(
                  "Use \(date.formatted(.studyDay.month(.wide).day().year()))", tableName: "Exam",
                  comment: "Moves the plan to one of the closest sittings")
              }
            }
          }

          failure
        }
        .disabled(isSaving)
      }
    }
  }

  @ViewBuilder
  private var failure: some View {
    if failed {
      FailureLine(
        message: LocalizedStringResource(
          "That didn't go through. Try again in a moment.", table: "Exam",
          comment: "Changing the date failed"))
    }
  }

  private func use(_ date: String) {
    isSaving = true
    failed = false

    Task {
      switch await plans.change(goalId: goalID, edits: [.targetDate(date)]) {
      case .done(.applied), .done(.undone), .done(.unchanged), .obsolete: break
      case .done(.invalid), .failed: failed = true
      }

      isSaving = false
    }
  }
}

/// Main's `PlanChoiceLines`: which option of each exam choice the plan follows. An unpicked choice
/// is the plan suggestion's to ask.
private struct RevealExamChoices: View {
  let plan: GoalPlan
  let change: (_ group: String) -> Void

  var body: some View {
    ForEach(plan.examChoices) { choice in
      if let line = choice.followingLine {
        Section {
          Text(line)
            .foregroundStyle(.mutedForeground)

          Button {
            change(choice.group)
          } label: {
            Text(
              "Change", tableName: "Plan",
              comment:
                "Opens the plan's settings to change the option of an exam's choice it follows")
          }
        }
      }
    }
  }
}

/// Main's `NoticeReading`; `lastEdition` while the next edition's documents aren't out, so the plan
/// follows the last one's.
struct NoticeReadingView: View {
  let document: ExamDocument
  let lastEdition: Bool
  /// The goal's run, which reports its warm-up deck.
  let deck: WaitDeck
  let goalID: String
  let next: PlanNext
  let holding: WaitHolding?
  /// Set once asking the plan failed: shows that, with the way to ask again.
  var reconnect: (() -> Void)?

  @State private var since = Date.now

  /// Reading a notice and fitting it into the plan usually takes about four minutes, after the plan
  /// built from the learner's answers.
  private static let readingSeconds = 240.0
  private static let planBuilt = 0.4

  var body: some View {
    WaitScreen(
      deck: deck, goalID: goalID,
      progressTitle: title, ready: holding.map(next.ready)
    ) {
      if let reconnect {
        GenerationFailureNotice(failure: .connection, act: reconnect)
      } else {
        WaitStatusStrip(label: title, isDone: holding != nil, share: share(at:))
      }
    } progress: {
      WaitHeading(title: title, description: description)

      Section {
        LabeledContent {
          done
        } label: {
          Text(
            "Your plan, from what you told us", tableName: "Onboarding",
            comment: "The done step while an exam's official documents are read")
        }

        LabeledContent {
          if holding == nil {
            ProgressView()
          } else {
            done
          }
        } label: {
          Text(
            "Reading the official documents", tableName: "Onboarding",
            comment: "The step going while an exam's official documents are read")
        }
      }

      if let reconnect {
        GenerationFailureSection(failure: .connection, act: reconnect)
      }
    }
    .measuresWait(surface: "examNotice", contentKind: "curriculum", goalID: goalID)
  }

  /// Main's `useNoticeProgress`: from the plan built toward the end over the reading's usual time.
  private func share(at date: Date) -> Double {
    let elapsed = max(0, date.timeIntervalSince(since))
    return Self.planBuilt + (0.97 - Self.planBuilt)
      * (1 - exp(-elapsed / (Self.readingSeconds / 2)))
  }

  private var done: some View {
    Image(systemName: "checkmark")
      .fontWeight(.semibold)
      .foregroundStyle(.success)
      .accessibilityLabel(
        Text("Done", tableName: "Onboarding", comment: "A finished step of a wait"))
  }

  private var title: Text {
    guard holding == nil else {
      return Text(.planReady)
    }

    return lastEdition
      ? Text(
        "Reading the last edition's official documents", tableName: "Onboarding",
        comment: "Title while the last edition of an exam's official documents is read")
      : Text(
        "Reading the exam's official documents", tableName: "Onboarding",
        comment: "Title while an exam's official documents are read")
  }

  private var description: Text {
    if holding != nil {
      return Text(next.readyDescription)
    }

    if lastEdition {
      return Text(
        "The next edition's documents aren't out yet, so your plan follows the last one's subjects and topics. We'll tell you when the new ones are out. This usually takes a few minutes.",
        tableName: "Onboarding", comment: "While the last edition of an exam's documents is read")
    }

    switch document {
    case .notice:
      return Text(
        "Your plan will follow the notice's subjects, topics and dates. This usually takes a few minutes.",
        tableName: "Onboarding", comment: "While an exam's public notice is read")
    case .guide:
      return Text(
        "Your plan will follow the official guide's parts, topics and dates. This usually takes a few minutes.",
        tableName: "Onboarding", comment: "While a language certificate's official guide is read")
    }
  }
}

private struct PlanReveal: View {
  let view: GoalOnboarding
  let plan: GoalPlan

  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(OnboardingStore.self) private var onboarding
  @Environment(PlanStore.self) private var plans
  @Environment(TodayStore.self) private var today
  @State private var adjusting: AdjustPlanSheet.Section?
  @State private var sheet: PlanSheet?
  @State private var showsTopics = false
  @State private var openingToday: Task<Void, Never>?
  @State private var startFailed = false
  @State private var isChangingDate = false
  @State private var dateChangeFailed = false
  @State private var slotAnswer: PlanSlotAnswer?
  /// The moment plays the first time this device shows the reveal before its action is pressed;
  /// opened again, after a restart too, the reveal draws its end, still.
  @State private var playsMoment: Bool

  init(view: GoalOnboarding, plan: GoalPlan) {
    self.view = view
    self.plan = plan
    _playsMoment = State(
      initialValue: !view.planRevealed && !UserDefaults.standard.bool(forKey: Self.momentKey(view)))
  }

  private static func momentKey(_ view: GoalOnboarding) -> String {
    "planReveal.momentPlayed.\(view.goal.id)"
  }

  var body: some View {
    let goal = learnerGoal
    let context = PlanContext(
      goal: goal, plan: plan, adjust: { adjusting = $0 }, show: { sheet = $0 })
    let syllabus = plans.syllabus(goalId: goal.id)
    let structure = syllabus.value.flatMap { $0.hasSubjectPages ? $0 : nil }
    let day = onboarding.revealToday(goalID: goal.id)

    PaneSplit {
      ZoonkList {
        heroSections(goal: goal, day: day)
      }
      .safeAreaBar(edge: .bottom) { actions(day: day.value) }
      // Adjust is see-through, so the plan scrolling under the bar stops at its edge.
      .scrollEdgeEffectStyle(.hard, for: .bottom)
    } secondary: {
      ZoonkList {
        detailSections(context: context, syllabus: syllabus.value, structure: structure)
      }
    } single: {
      ZoonkList {
        heroSections(goal: goal, day: day)
        detailSections(context: context, syllabus: syllabus.value, structure: structure)
      }
      .safeAreaBar(edge: .bottom) { actions(day: day.value) }
      // Adjust is see-through, so the plan scrolling under the bar stops at its edge.
      .scrollEdgeEffectStyle(.hard, for: .bottom)
      .onboardingColumn()
    }
    .loads(syllabus, day, refreshable: false)
    .environment(\.celebrates, playsMoment)
    .onAppear {
      if playsMoment {
        UserDefaults.standard.set(true, forKey: Self.momentKey(view))
      }
    }
    .onDisappear { openingToday?.cancel() }
    .planSheets($sheet, context: context, syllabus: syllabus.value, slotAnswer: $slotAnswer)
    .sheet(item: $adjusting) { section in
      AdjustPlanSheet(goal: goal, plan: plan, section: section, store: plans)
        .zoonkStyles()
    }
    .sheet(isPresented: $showsTopics) {
      if let structure {
        SyllabusTopicsSheet(syllabus: structure)
          .zoonkStyles()
      }
    }
  }

  @ViewBuilder
  private func heroSections(goal: LearnerGoal, day: Resource<StudyDay>) -> some View {
    Section {
      VStack(alignment: .leading, spacing: 20) {
        RevealHero(title: goal.title, buddy: learner.summary.value?.buddy ?? BuddyLook())
        RevealReadouts(plan: plan, isExam: goal.kind == .exam)
      }
      .listRowBackground(Color.clear)
    }

    RevealNoticeDay(
      isSaving: $isChangingDate, failed: $dateChangeFailed, goalID: goal.id, plan: plan)

    RevealExamChoices(plan: plan) { adjusting = .choice($0) }

    switch day.state {
    case .loaded(let day):
      RevealToday(day: day)
      RevealWeek(plan: plan, today: day)
    case .idle, .loading:
      // Today's rows hold their place; the week waits for them, since it leaves out their lessons.
      RevealTodayPlaceholder()
    case .empty, .failed:
      RevealWeek(plan: plan, today: nil)
    }
  }

  /// Main's `RevealActions`: pinned under the plan, and working from the moment's first frame.
  private func actions(day: StudyDay?) -> some View {
    VStack(spacing: 10) {
      if startFailed {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't save. Try again.", table: "Onboarding",
            comment: "A change couldn't be saved"))
      }

      HStack(spacing: 10) {
        Button {
          adjusting = .top
        } label: {
          Text(
            "Adjust", tableName: "Onboarding", comment: "Opens the plan's settings to change it")
        }
        .buttonStyle(.outline)
        .fixedSize()

        BusyButton(isBusy: openingToday != nil, icon: .play, action: openToday) {
          if day?.blocks.contains(where: \.isFinished) == true {
            Text(
              "Continue", tableName: "Onboarding",
              comment: "Opens Today once a lesson of the plan's first day is done")
          } else {
            Text("Start", tableName: "Onboarding", comment: "Opens Today with the plan's first day")
          }
        }
        .buttonStyle(.mainAction)
        .buttonSizing(.flexible)
        .keyboardShortcut(.defaultAction)
      }

      if learner.summary.value?.identity.isAnonymous == true {
        HStack(spacing: 8) {
          Text(
            "Save your plan so it's here next time.", tableName: "Onboarding",
            comment: "A guest's plan isn't saved to an account yet")

          Button {
            router.present(.signIn)
          } label: {
            Text(
              "Create an account", tableName: "Onboarding", comment: "Opens sign-up from the plan")
          }
        }
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
    }
    .controlSize(.large)
    .keepsOffFold()
    .scenePadding(.horizontal)
    .padding(.vertical, 10)
  }

  @ViewBuilder
  private func detailSections(
    context: PlanContext, syllabus: GoalSyllabus?, structure: GoalSyllabus?
  ) -> some View {
    // A plan of one phase has nothing to draw in time: its chapters say its shape instead.
    if plan.roadPhases.count > 1 {
      PlanRoadmapSection(context: context, structure: structure, listsPhases: true)
    } else {
      RevealChapters(plan: plan)
    }

    if plan.notice == .usual {
      Section {
      } footer: {
        SectionFooter {
          Text(
            "This plan follows the exam's usual structure while we finish reading its official documents. If they change your plan, you'll decide on Today.",
            tableName: "Onboarding",
            comment: "Under a plan revealed before its exam's official documents were read")
        }
      }
    }

    if let syllabus {
      AreaWeights(syllabus: syllabus)
    }

    PlanSuggestionSection(context: context, answer: $slotAnswer)

    if let structure {
      Section {
        Text(syllabusSummary(structure, dailyMinutes: plan.schedule.dailyMinutes))
          .foregroundStyle(.mutedForeground)

        Button {
          showsTopics = true
        } label: {
          Text("See topics", tableName: "Onboarding", comment: "Opens what the plan studies")
        }
      }
    } else if plan.roadPhases.count > 1 {
      PlanPathSection(context: context)
    }
  }

  /// Today waits for the reveal to be seen: until it's saved, Today brings the learner back here,
  /// so a failed save stays here to try again.
  private func openToday() {
    guard openingToday == nil else {
      return
    }

    startFailed = false

    openingToday = Task {
      defer { openingToday = nil }

      do {
        try await onboarding.markPlanRevealed(goalID: view.goal.id)
      } catch is CancellationError {
        return
      } catch {
        startFailed = true
        return
      }

      await today.today.refresh()

      if !Task.isCancelled {
        router.showRoot(of: .today)
      }
    }
  }

  /// The goal as the plan's sections read it; the summary has it only once it refreshes.
  private var learnerGoal: LearnerGoal {
    LearnerGoal(
      dailyMinutes: plan.schedule.dailyMinutes,
      id: view.goal.id,
      kind: LearnerGoal.Kind(rawValue: view.goal.kind.rawValue) ?? .learn,
      status: .active,
      targetDate: plan.schedule.targetDate,
      title: view.goal.title)
  }

}

/// Lessons still being written ahead aren't chapters yet.
private struct RevealChapters: View {
  let plan: GoalPlan

  private static let shown = 5

  var body: some View {
    let chapters = plan.roadPhases.flatMap(\.chapters).filter { !($0.writing && !$0.far) }
    let rest = chapters.count - Self.shown

    if !chapters.isEmpty {
      Section {
        ForEach(Array(chapters.prefix(Self.shown).enumerated()), id: \.element.id) {
          index, chapter in
          Label {
            chapter.title.isEmpty
              ? Text(
                "More lessons", tableName: "Onboarding",
                comment: "A new plan's chapter whose lessons are still being written")
              : Text(chapter.title)
          } icon: {
            Text(index + 1, format: .number)
              .monospacedDigit()
              .foregroundStyle(.mutedForeground)
          }
        }
      } header: {
        SectionTitle(
          Text("Chapters", tableName: "Onboarding", comment: "Header over a new plan's chapters"))
      } footer: {
        SectionFooter {
          if rest > 0 {
            Text(
              "\(rest) more chapters", tableName: "Onboarding",
              comment: "Under a new plan's first chapters: how many more it holds")
          }
        }
      }
    }
  }
}

/// Main's `useSyllabusSummaryText`: the plan's subjects in one line.
func syllabusSummary(_ syllabus: GoalSyllabus, dailyMinutes: Int) -> String {
  let firstSubjects = syllabus.subjects.prefix(2).map(\.shortName).joinedFacts()
  let noticeSubjects = syllabus.subjects.filter { $0.source == "notice" }.count
  let coverage = syllabusCoverage(syllabus, dailyMinutes: dailyMinutes)
  let title: String
  let detail: String?

  if syllabus.kind != "notice" {
    title = String(
      localized: "\(syllabus.subjects.count) modules", table: "Onboarding",
      comment: "How many modules a plan has")
    detail = firstSubjects
  } else if syllabus.fromMaterial {
    title = String(
      localized:
        "\(syllabus.topicCount > 0 ? syllabus.topicCount : noticeSubjects) topics from your material",
      table: "Onboarding", comment: "How many topics the learner's material lists")
    detail =
      syllabus.topicCount == 0 ? firstSubjects : syllabus.topicsMapped ? coverage : nil
  } else {
    title =
      syllabus.examDocument == .notice
      ? String(
        localized: "\(noticeSubjects) subjects from the notice", table: "Onboarding",
        comment: "How many subjects the exam notice lists")
      : String(
        localized: "\(noticeSubjects) parts from the official guide", table: "Onboarding",
        comment: "How many parts the exam's official guide lists")

    if syllabus.topicCount == 0 {
      detail = heaviestSubjects(syllabus) ?? firstSubjects
    } else if !syllabus.topicsMapped {
      detail = String(
        localized: "\(syllabus.topicCount) topics", table: "Onboarding",
        comment: "How many topics the exam notice lists")
    } else {
      detail = coverage
    }
  }

  return [title, detail].compactMap { $0?.isEmpty == false ? $0 : nil }.joinedFacts()
}

/// A subject's basics the learner starts past aren't left out: the plan counts them as known.
private func syllabusCoverage(_ syllabus: GoalSyllabus, dailyMinutes: Int) -> String {
  let topics = syllabus.subjects.flatMap(\.topics)
  let out = topics.filter { $0.status == "notPlanned" && $0.notPlannedReason != "pastBasics" }
  let total = syllabus.topicCount

  if out.isEmpty {
    return String(
      localized: "\(total) topics, all in your plan", table: "Onboarding",
      comment: "Every topic of the goal fits in the plan")
  }

  if out.allSatisfy({ $0.notPlannedReason == "time" }) {
    return String(
      localized:
        "\(out.count) of \(total) topics don't fit in \(planDurationText(minutes: Double(dailyMinutes))) a day",
      table: "Onboarding", comment: "Topics left out because the daily time can't reach them")
  }

  return String(
    localized: "\(total - out.count) of \(total) topics in your plan", table: "Onboarding",
    comment: "Topics the plan holds of the goal's topics")
}

private func heaviestSubjects(_ syllabus: GoalSyllabus) -> String? {
  let subjects = syllabus.subjects.filter { $0.source == "notice" }
  let counted = subjects.compactMap { subject in subject.questions.map { (subject, $0) } }

  guard !counted.isEmpty, counted.count == subjects.count else {
    return nil
  }

  let heaviest = counted.prefix(3).map { "\($0.0.shortName) \($0.1)" }.joinedFacts()
  return String(
    localized: "Most questions: \(heaviest)", table: "Onboarding",
    comment: "The exam's subjects with the most questions and how many each has")
}

/// Main's topics sheet: each subject with how much it asks and its topics.
private struct SyllabusTopicsSheet: View {
  @Environment(\.dismiss) private var dismiss

  let syllabus: GoalSyllabus

  var body: some View {
    NavigationStack {
      ZoonkList {
        ForEach(syllabus.subjects) { subject in
          if subject.topics.isEmpty {
            label(subject)
          } else {
            DisclosureGroup {
              ForEach(subject.topics) { topic in
                Text(topic.name)
                  .foregroundStyle(topic.status == "notPlanned" ? .mutedForeground : .primary)
              }
            } label: {
              label(subject)
            }
          }
        }
      }
      .navigationTitle(
        Text("What you'll study", tableName: "Onboarding", comment: "Title of the topics sheet")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
  }

  private func label(_ subject: SyllabusSubject) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(subject.name)

      if let line = subjectLine(subject) {
        Text(line)
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      }
    }
  }

  private func subjectLine(_ subject: SyllabusSubject) -> String? {
    let total = subject.topics.count
    let leftOut = subject.topics.filter { $0.status == "notPlanned" }.count
    let topics: String? =
      leftOut > 0
      ? String(
        localized: "\(total) topics, \(leftOut) out of your plan", table: "Onboarding",
        comment: "A subject's topics and how many the plan leaves out")
      : total > 0
        ? String(
          localized: "\(total) topics", table: "Onboarding",
          comment: "How many topics the exam notice lists")
        : nil
    let questions = subject.questions.flatMap { count in
      count > 0
        ? String(
          localized: "\(count) questions", table: "Onboarding",
          comment: "How many questions a subject has on the exam")
        : nil
    }
    let parts = [questions, topics].compactMap(\.self)

    return parts.isEmpty ? nil : parts.joinedFacts()
  }
}

private struct AreaWeights: View {
  let syllabus: GoalSyllabus

  var body: some View {
    let weighed = syllabus.subjects
      .compactMap { subject in subject.displayWeight.map { (subject, $0) } }
      .sorted { $0.1.share > $1.1.share }
    let assumed = weighed.filter { $0.1.basis == .assumed }.count

    if weighed.count >= 2 {
      Section {
        ForEach(weighed, id: \.0.id) { subject, weight in
          VStack(alignment: .leading, spacing: 6) {
            PlanPathRow {
              Text(subject.name)
            } value: {
              Text(percentText(weight))
                .typeStyle(.data)
                .foregroundStyle(.mutedForeground)
            }

            Meter(value: weight.share, fill: .primary)
              .accessibilityHidden(true)
          }
          .accessibilityElement(children: .combine)
        }
      } header: {
        SectionTitle(
          Text(
            "Weight by area", tableName: "Onboarding",
            comment: "Header over an exam's areas and how much each weighs"))
      } footer: {
        SectionFooter {
          if assumed > 0 {
            Text(estimateNote(assumed))
          }
        }
      }
    }
  }

  private func percentText(_ weight: SyllabusSubject.DisplayWeight) -> String {
    let percent = (Double(weight.percent) / 100).formatted(.percent)

    return weight.basis == .assumed
      ? String(
        localized: "~\(percent)", table: "Onboarding",
        comment: "An area's weight the official documents don't give, so it's estimated")
      : percent
  }

  private func estimateNote(_ count: Int) -> String {
    switch (syllabus.fromMaterial, syllabus.examDocument, count == 1) {
    case (true, _, true):
      String(
        localized: "~ Estimated: your material doesn't say how much this area weighs.",
        table: "Onboarding",
        comment: "Under a weight estimated because the learner's material doesn't give it")
    case (true, _, false):
      String(
        localized: "~ Estimated: your material doesn't say how much these areas weigh.",
        table: "Onboarding",
        comment: "Under weights estimated because the learner's material doesn't give them")
    case (false, .guide, true):
      String(
        localized: "~ Estimated: the official guide doesn't say how much this area weighs.",
        table: "Onboarding",
        comment: "Under a weight estimated because the exam's official guide doesn't give it")
    case (false, .guide, false):
      String(
        localized: "~ Estimated: the official guide doesn't say how much these areas weigh.",
        table: "Onboarding",
        comment: "Under weights estimated because the exam's official guide doesn't give them")
    case (false, .notice, true):
      String(
        localized: "~ Estimated: the notice doesn't say how much this area weighs.",
        table: "Onboarding",
        comment: "Under a weight estimated because the exam notice doesn't give it")
    case (false, .notice, false):
      String(
        localized: "~ Estimated: the notice doesn't say how much these areas weigh.",
        table: "Onboarding",
        comment: "Under weights estimated because the exam notice doesn't give them")
    }
  }

}
