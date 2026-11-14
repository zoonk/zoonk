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

  @Environment(\.scenePhase) private var scenePhase

  private struct LessonFollow: Equatable {
    let id: String?
    let active: Bool
  }

  private func followFirstLesson() async {
    let resource = onboarding.onboarding(goalID: view.goal.id)
    let deadline = ContinuousClock.now + .seconds(600)
    var failures = 0
    while ContinuousClock.now < deadline && failures < 3 && !Task.isCancelled {
      do { try await Task.sleep(for: .seconds(3)) } catch { return }
      let before = resource.revision
      await resource.refresh()
      failures = resource.revision == before ? failures + 1 : 0
      if resource.revision != before && resource.value?.firstLesson?.status != .writing {
        return
      }
    }
  }

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
        read: view.firstLesson.map(GenerationWait.FirstLesson.init),
        readGenerationID: view.generationId, generationID: run.id)
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
            .task(
              id: LessonFollow(
                id: run.id,
                active: (run.ended || run.isStopped) && !firstLesson.isReady
                  && !firstLesson.isStopped
                  && scenePhase == .active)
            ) {
              guard
                (run.ended || run.isStopped) && !firstLesson.isReady && !firstLesson.isStopped
                  && scenePhase == .active
              else { return }
              await followFirstLesson()
            }
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
      id: read.id, title: read.title, isReady: read.status == .ready || read.status == .done,
      isDone: read.status == .done, isStopped: read.status == .stopped
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
      case .done(.applied), .done(.saved), .done(.undone), .done(.unchanged), .obsolete: break
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
  /// Start's, or a row's while `openingRow` names it.
  @State private var opening: Task<Void, Never>?
  @State private var openingRow: Int?
  @State private var failedRow: Int?
  @State private var startFailure: StartFailure?
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
      .bottomBar(note: barNote) { actions(day: day.value?.today) }
      // Adjust is see-through, so the plan scrolling under the bar stops at its edge.
      .scrollEdgeEffectStyle(.hard, for: .bottom)
    } secondary: {
      ZoonkList {
        detailSections(context: context, structure: structure)
      }
    } single: {
      ZoonkList {
        heroSections(goal: goal, day: day)
        detailSections(context: context, structure: structure)
      }
      .bottomBar(note: barNote) { actions(day: day.value?.today) }
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
    .onDisappear { opening?.cancel() }
    .planSheets($sheet, context: context, syllabus: syllabus.value, slotAnswer: $slotAnswer)
    .sheet(item: $adjusting) { section in
      AdjustPlanSheet(goal: goal, plan: plan, section: section, store: plans)
        .zoonkStyles()
    }
  }

  @ViewBuilder
  private func heroSections(goal: LearnerGoal, day: Resource<PlanRevealRead>) -> some View {
    Section {
      VStack(alignment: .leading, spacing: 20) {
        RevealHero(title: goal.displayName, buddy: learner.summary.value?.buddy ?? BuddyLook())
        RevealReadouts(plan: plan, isExam: goal.kind == .exam)
        coverage
      }
      .listRowBackground(Color.clear)
    }

    RevealExamChoices(plan: plan) { adjusting = .choice($0) }

    RevealNoticeDay(
      isSaving: $isChangingDate, failed: $dateChangeFailed, goalID: goal.id, plan: plan)

    switch day.state {
    case .loaded(let reveal):
      RevealToday(
        day: reveal.today, minutes: reveal.minutes, busy: openingRow, failed: failedRow,
        open: opening != nil && openingRow == nil ? nil : { open($0, on: reveal.today) })
      RevealWeek(days: reveal.nextDays, week: reveal.week)
    case .idle, .loading:
      // Today's rows hold their place, so the week doesn't move as they come.
      RevealTodayPlaceholder()
    case .empty, .failed:
      EmptyView()
    }
  }

  /// Main's `RevealCoverage`: the one thing a learner may want to change before starting, when
  /// their time doesn't cover the goal. What fits lives on the Plan. A plan that goes on after the
  /// exam covers the rest then.
  @ViewBuilder private var coverage: some View {
    if !plan.schedule.fullCourse, let covered = planCoverageText(plan) {
      ViewThatFits(in: .horizontal) {
        HStack(spacing: 16) {
          coverageLine(covered)
          addTime
        }

        VStack(alignment: .leading, spacing: 8) {
          coverageLine(covered)
          addTime
        }
      }
    }
  }

  private func coverageLine(_ text: String) -> some View {
    Text(text)
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
      .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var addTime: some View {
    Button {
      adjusting = .time
    } label: {
      Text(
        "Add time", tableName: "Onboarding",
        comment: "Opens the plan's time a day, beside the line saying it doesn't cover the goal")
    }
    .buttonStyle(.outline)
    .controlSize(.small)
    .fixedSize()
  }

  /// Main's `RevealActions`: pinned under the plan, and working from the moment's first frame.
  @ViewBuilder
  private func actions(day: StudyDay?) -> some View {
    Button {
      adjusting = .top
    } label: {
      Text("Adjust", tableName: "Onboarding", comment: "Opens the plan's settings to change it")
    }
    .buttonStyle(.outline)

    BusyButton(isBusy: opening != nil && openingRow == nil) {
      start(on: day)
    } label: {
      if day?.blocks.contains(where: \.isFinished) == true {
        Text(
          "Continue", tableName: "Onboarding",
          comment: "Opens the plan's next step once a lesson of its first day is done")
      } else {
        Text("Start", tableName: "Onboarding", comment: "Opens the plan's first step")
      }
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
    .disabled(openingRow != nil)
  }

  /// What a tap couldn't do, or, for a guest, that the plan isn't saved yet.
  private var barNote: BarNote? {
    switch startFailure {
    case .save:
      return BarNote(
        LocalizedStringResource(
          "That didn't save. Try again.", table: "Onboarding",
          comment: "A change couldn't be saved"))
    case .open:
      return BarNote(
        LocalizedStringResource(
          "We couldn't open this step. Try again.", table: "Today",
          comment: "Under a step of the day, or a mission, that didn't open"))
    case nil:
      guard learner.summary.value?.identity.isAnonymous == true else { return nil }

      return BarNote(
        LocalizedStringResource(
          "Save your plan so it's here next time.", table: "Onboarding",
          comment: "A guest's plan isn't saved to an account yet"),
        tone: .status,
        action: BarNote.Action(
          label: Text(
            "Create an account", tableName: "Onboarding", comment: "Opens sign-up from the plan"),
          perform: { router.present(.signIn) }))
    }
  }

  @ViewBuilder
  private func detailSections(context: PlanContext, structure: GoalSyllabus?) -> some View {
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

    if structure == nil, plan.roadPhases.count > 1 {
      PlanPathSection(context: context)
    }
  }

  /// Today waits for the reveal to be seen: until it's saved, Today brings the learner back here,
  /// so a failed save stays here to try again.
  private func openToday() {
    guard opening == nil else {
      return
    }

    startFailure = nil
    failedRow = nil

    opening = Task {
      defer { opening = nil }

      do {
        try await onboarding.markPlanRevealed(goalID: view.goal.id)
      } catch is CancellationError {
        return
      } catch {
        startFailure = .save
        return
      }

      await today.today.refresh()

      if !Task.isCancelled {
        router.showRoot(of: .today)
      }
    }
  }

  /// Start opens the step tagged where to start, as its row does; with none to open, Today.
  private func start(on day: StudyDay?) {
    if let day, let next = day.nextBlock, next.opensFromReveal {
      open(next, on: day, fromStart: true)
    } else {
      openToday()
    }
  }

  /// A row ends the reveal as Start does, then opens its step the way Today's row does, so the
  /// learner comes back from it to Today.
  private func open(_ block: StudyBlock, on day: StudyDay, fromStart: Bool = false) {
    guard opening == nil else {
      return
    }

    startFailure = nil
    failedRow = nil
    openingRow = fromStart ? nil : block.position
    let shown = router.shown

    func fail(_ failure: StartFailure) {
      if fromStart {
        startFailure = failure
      } else {
        failedRow = block.position
      }
    }

    opening = Task {
      defer {
        opening = nil
        openingRow = nil
      }

      do {
        try await onboarding.markPlanRevealed(goalID: view.goal.id)
      } catch is CancellationError {
        return
      } catch {
        fail(.save)
        return
      }

      // The step opens over Today, and the session screen reads the day from it.
      await today.today.refresh()

      // A learner who left the reveal while it saved isn't taken anywhere.
      guard !Task.isCancelled, router.shown == shown else {
        return
      }

      if day.waitsForStart(block) {
        router.showRoot(of: .today)
        router.showIntro(of: block)
        return
      }

      switch await today.open(block, as: .block, on: day, goalID: view.goal.id) {
      // The day changed under the row: the reveal reads it again, as Today would.
      case .done(.changed):
        break
      case .done(let destination) where !Task.isCancelled && router.shown == shown:
        router.showRoot(of: .today)
        router.openStudy(destination)
      case .failed:
        fail(.open)
      case .done, .obsolete:
        break
      }
    }
  }

  private enum StartFailure {
    case save
    case open
  }

  /// The goal as the plan's sections read it; the summary has it only once it refreshes.
  private var learnerGoal: LearnerGoal {
    LearnerGoal(
      dailyMinutes: plan.schedule.dailyMinutes,
      id: view.goal.id,
      kind: LearnerGoal.Kind(rawValue: view.goal.kind.rawValue) ?? .learn,
      language: view.goal.language,
      status: .active,
      targetDate: plan.schedule.targetDate,
      displayName: view.goal.displayName, title: view.goal.title)
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
