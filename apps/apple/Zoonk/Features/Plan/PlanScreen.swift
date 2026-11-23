import SwiftUI

struct PlanScreen: View {
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    // The shell gates learners without a goal, so a missing goal is only the summary loading.
    if let goal = learner.summary.value?.shownGoal {
      GoalPlanView(goal: goal)
        .id(goal.id)
    } else {
      Color.clear
        .barTitleAfterHero(
          String(localized: "Plan", table: "Plan", comment: "Title of the Plan tab"))
    }
  }
}

private struct GoalPlanView: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var store

  let goal: LearnerGoal

  private func daysLeft(_ plan: GoalPlan?) -> (shown: String, spoken: String)? {
    goal.isSettingUp ? nil : planDaysLeft(plan)
  }

  var body: some View {
    let plan = store.plan(goalId: goal.id)
    let syllabus = store.syllabus(goalId: goal.id)
    let standing = store.standing(goalId: goal.id)

    Group {
      if goal.isSettingUp {
        PlanSetupLeft(goal: goal)
          .modifier(GoalOptionsToolbar(goal: goal))
      } else if goal.kind == .language {
        content(plan: plan)
          .loads(
            plan, syllabus, store.languageStanding(goalId: goal.id),
            store.languageUnits(goalId: goal.id))
      } else {
        content(plan: plan)
          .loads(plan, syllabus, standing)
      }
    }
    .barTitleAfterHero(String(localized: "Plan", table: "Plan", comment: "Title of the Plan tab"))
    .toolbar {
      // A bar subtitle drawn from text drops its spoken form; a view keeps it.
      if let days = daysLeft(plan.value?.plan) {
        ToolbarItem(placement: .subtitle) {
          Text(verbatim: days.shown)
            .accessibilityLabel(Text(verbatim: days.spoken))
        }
      }
    }
    .task(id: goal.contentCountry?.rebuild) {
      await learner.followRebuild(goalID: goal.id)
    }
  }

  @ViewBuilder
  private func content(plan: Resource<PlanRead>) -> some View {
    switch plan.state {
    case .loaded(let read) where read.plan.ready:
      PlanContent(goal: goal, plan: read.plan)
    case .loaded, .empty, .failed(.notFound):
      PlanBuildingView(goal: goal) {
        await plan.refresh()
      }
      .lonePage()
      .modifier(GoalOptionsToolbar(goal: goal))
    case .failed:
      PageLoadFailure {
        Label {
          Text(
            "Couldn't load your plan", tableName: "Plan",
            comment: "Title shown when the plan failed to load")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } description: {
        Text(
          "Check your connection and try again.", tableName: "Plan",
          comment: "Explains a failed load of the plan")
      } retry: {
        await plan.refresh()
      }
    case .idle, .loading:
      ProgressView()
        .lonePage()
    }
  }
}

/// The days left to a date still to come; nothing while the plan is set up or built, as main's.
/// An estimated date's "~60 days left" reads "About 60 days left".
func planDaysLeft(_ plan: GoalPlan?) -> (shown: String, spoken: String)? {
  guard let plan, plan.ready, let targetDate = plan.schedule.targetDate, targetDate >= plan.today
  else {
    return nil
  }

  let days = PlanDate.days(from: plan.today, to: targetDate)

  if days == 0 {
    let line = String(
      localized: "The day is here", table: "Plan", comment: "Plan subtitle on the goal's day")
    return (line, line)
  }

  return daysLeftText(days, estimated: plan.schedule.targetDateEstimated)
}

/// Main's `daysLeftText`: the days left to a date, one way on every screen. An estimated date's
/// count is marked "~60 days left" and read "About 60 days left".
func daysLeftText(_ days: Int, estimated: Bool) -> (shown: String, spoken: String) {
  guard estimated else {
    let line = String(
      localized: "\(days) days left", table: "Plan",
      comment: "How many days are left until the goal's date")
    return (line, line)
  }

  return (
    String(
      localized: "~\(days) days left", table: "Plan",
      comment: "About how many days are left until the goal's estimated date"),
    String(
      localized: "About \(days) days left", table: "Plan",
      comment: "\"~60 days left\" read aloud: about how many days are left")
  )
}

/// A plan is built while the questions are still answered, on a time the learner hasn't chosen
/// yet, so the Plan leads back to them as Today does. Paused, nothing asks for them until the
/// learner resumes the goal.
private struct PlanSetupLeft: View {
  @Environment(AppRouter.self) private var router

  let goal: LearnerGoal

  var body: some View {
    Group {
      if goal.status == .paused {
        paused
      } else {
        questionsLeft
      }
    }
    .lonePage()
  }

  private var questionsLeft: some View {
    StateMessage {
      Label {
        Text(
          "Your plan comes after a few questions", tableName: "Plan",
          comment: "The Plan of a goal whose setup questions are left")
      } icon: {
        Image(systemName: "list.bullet.clipboard")
      }
    } description: {
      Text(
        "Answer them and we'll plan every day until you reach your goal.", tableName: "Plan",
        comment: "Why the Plan waits for the goal's setup questions")
    }
    .bottomBar {
      Button {
        router.open(.goalSetup(goalId: goal.id))
      } label: {
        Text("Continue", tableName: "Plan", comment: "Opens the goal's setup questions")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    }
  }

  private var paused: some View {
    StateMessage {
      Label {
        Text(
          "This goal is paused", tableName: "Plan",
          comment: "Title of the Plan's notice for a paused goal")
      } icon: {
        Image(systemName: "pause.circle")
      }
    } description: {
      Text(
        "Nothing is planned until you resume it.", tableName: "Plan",
        comment: "Explains a paused goal")
    }
    .resumeGoalBar()
  }
}

private struct PlanContent: View {
  @Environment(\.stacksContent) private var isStacked
  @Environment(AppRouter.self) private var router
  @Environment(CertificatesStore.self) private var certificates
  @Environment(PlanStore.self) private var store
  @State private var adjusting: AdjustPlanSheet.Section?
  @State private var sheet: PlanSheet?
  @State private var isReporting = false
  @State private var claimed: [CertificateFacts] = []
  @State private var slotAnswer: PlanSlotAnswer?
  @State private var slotChecks = PlanSlotChecks()
  @State private var alphabetSkip = VisitRequest<Bool>()
  @State private var rebuildRetry = VisitRequest<Bool>()
  /// The new plan arrived while the learner watched; gone on the next visit.
  @State private var rebuildReady = false

  let goal: LearnerGoal
  let plan: GoalPlan

  var body: some View {
    let syllabus = store.syllabus(goalId: goal.id).value
    let structure = syllabus.flatMap { $0.hasSubjectPages ? $0 : nil }
    let context: PlanContext = {
      var context = PlanContext(
        goal: goal, plan: plan, adjust: { adjusting = $0 }, report: { isReporting = true },
        show: { sheet = $0 }, claimCertificate: claimCertificate, showClaim: show,
        slotChecks: slotChecks, alphabetSkip: alphabetSkip)
      let openingContext = context
      context.slotOpening = {
        SuggestionOpening(
          item: openingContext.suggestions(in: store).shown, plan: plan,
          inSheet: sheet?.isSuggestion == true, editing: adjusting != nil)
      }
      return context
    }()
    let opening = context.slotOpening?()

    GeometryReader { proxy in
      if PaneSpace(proxy).pages(primaryShare: 0.5, stacked: isStacked) != nil {
        ZoonkList {
          rebuildNotice
          // Main's wide page: the plan in the column, and beside it the aside with the numbers,
          // the suggestion, the plan's settings and the other places.
          BlockGridSection(asideWidth: 300) {
            VStack(alignment: .leading, spacing: 32) {
              PageSection {
                PageHeader(
                  Text("Plan", tableName: "Plan", comment: "Title of the Plan tab"),
                  supporting: daysLeft(context)
                ) {
                  PlanHeaderActions(context: context)
                }
                .rowSeparatorHiddenBelow()
                PlanRoadmapContent(context: context, structure: structure)
                  .rowSeparatorHiddenBelow()
                if structure != nil, let focusTest = context.plan.focusTest {
                  PlanFocusTestRow(goalId: goal.id, summary: focusTest)
                }
              } header: {
                EmptyView()
              }

              structureSections(
                context: context, structure: structure, namesChoices: false,
                includesFocusTest: structure == nil)
            }

            VStack(alignment: .leading, spacing: 32) {
              PlanNumbersSection(context: context, syllabus: syllabus, timeShownBeside: true)
              PlanSuggestionSection(context: context, answer: $slotAnswer, isInline: true)
              PlanSettingsSection(context: context)
              PlanMoreSection(goal: goal)
            }
          }
        }
        .sheetColumn()
        .paneSplit(true)
      } else {
        ZoonkList {
          header(context, structure: structure)
          rebuildNotice
          PlanNumbersSection(context: context, syllabus: syllabus)
          PlanSuggestionSection(context: context, answer: $slotAnswer)
          structureSections(context: context, structure: structure, namesChoices: true)
          // The plan's settings are main's wide side column; a phone reaches them from Adjust plan.
          PlanMoreSection(goal: goal)
        }
      }
    }
    .resumeGoalBar(isShown: goal.status == .paused)
    .examOverBar(
      goal: goal,
      isShown: goal.status != .paused && goal.kind == .exam && plan.status?.kind == .pastDate
    )
    .announcesStatus(rebuildStatus)
    .onChange(of: goal.contentCountry?.rebuild) { old, new in
      rebuildReady = old == .preparing && new == ContentCountry.Rebuild.none
    }
    .modifier(PlanToolbar(context: context))
    .planSheets($sheet, context: context, syllabus: syllabus, slotAnswer: $slotAnswer)
    .completionMoments(certificates: claimed)
    .loads(planEnd, refreshable: false)
    .sheet(item: $adjusting) { section in
      AdjustPlanSheet(goal: goal, plan: plan, section: section, store: store)
        .zoonkSheet()
    }
    .feedbackSheet(
      isPresented: $isReporting,
      context: FeedbackContext(contentID: plan.planId, contentKind: .plan), isReport: true
    )
    .onChange(of: opening) { slotChecks.leave(except: opening) }
    .onDisappear {
      slotAnswer?.editor.cancel()
      slotAnswer = nil
      alphabetSkip.leave()
      rebuildRetry.leave()
      slotChecks.leave()
    }
  }

  @ViewBuilder private var rebuildNotice: some View {
    if let rebuild = goal.contentCountry?.rebuild, rebuild != .none {
      PlanRebuildNotice(goalID: goal.id, failed: rebuild == .failed, retry: rebuildRetry)
    } else if rebuildReady {
      Section {
        Text(
          "Your new plan is ready.", tableName: "Plan",
          comment: "Replaces the notice that a new plan was being prepared, once it's ready"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
    }
  }

  private var rebuildStatus: String? {
    switch goal.contentCountry?.rebuild {
    case .preparing:
      String(
        localized: "Getting your new plan ready", table: "Plan",
        comment: "Title of the notice while a goal's plan is made again for its new country")
    case .failed:
      String(
        localized: "Your new plan couldn't be made", table: "Plan",
        comment: "Title of the notice when making a goal's new plan failed")
    case .some(.none), nil:
      rebuildReady
        ? String(
          localized: "Your new plan is ready.", table: "Plan",
          comment: "Replaces the notice that a new plan was being prepared, once it's ready")
        : nil
    }
  }

  /// Main's `PlanHeader` subtitle: the days left to the goal's date, under the title.
  private func daysLeft(_ context: PlanContext) -> Text? {
    planDaysLeft(context.plan).map {
      Text(verbatim: $0.shown).accessibilityLabel(Text(verbatim: $0.spoken))
    }
  }

  private func header(_ context: PlanContext, structure: GoalSyllabus?) -> some View {
    Section {
      PageHeader(
        Text("Plan", tableName: "Plan", comment: "Title of the Plan tab"),
        supporting: daysLeft(context)
      ) {
        PlanHeaderActions(context: context)
      }
      .listRowSeparator(.hidden)
      PlanRoadmapContent(context: context, structure: structure)
        .listRowSeparator(.hidden)
    }
  }

  /// Its certificates, for the suggestion line: an exam's course can finish before its plan does
  /// (its exam-day mocks come after), and a finished plan offers its own.
  private var planEnd: [any CachedResource] {
    goal.kind == .exam || plan.end != nil ? [store.planEnd(goalId: goal.id)] : []
  }

  /// The learner asked for them, so when every moment already played, the certificate opens
  /// instead.
  private func claimCertificate() async -> PlanClaim? {
    switch await certificates.claim(goalID: goal.id) {
    case .done(let claimed) where !claimed.isEmpty:
      let unshown = claimed.filter { !$0.wasShown }.map(\.facts)

      if !unshown.isEmpty {
        return .moments(unshown)
      } else if let only = claimed.first, claimed.count == 1 {
        return .certificate(code: only.facts.code)
      } else {
        return .certificates
      }
    case .done, .failed: return nil
    case .obsolete: return .unchanged
    }
  }

  private func show(_ claim: PlanClaim) {
    switch claim {
    case .moments(let facts): claimed = facts
    case .certificate(let code): sheet = .certificate(code: code)
    case .certificates: router.present(.account(.certificates))
    case .unchanged: break
    }
  }

  @ViewBuilder
  private func structureSections(
    context: PlanContext, structure: GoalSyllabus?, namesChoices: Bool,
    includesFocusTest: Bool = true
  ) -> some View {
    let focusTest = (includesFocusTest ? context.plan.focusTest : nil).map {
      PlanFocusTestRow(goalId: goal.id, summary: $0)
    }

    if let structure {
      // Unpicked choices are the suggestion's; beside the page its settings name the pick.
      PlanSyllabusSection(
        goalKind: goal.kind, syllabus: structure,
        choices: namesChoices ? context.plan.examChoices.filter { !$0.subjects.isEmpty } : [],
        change: { context.adjust(.choice($0)) }, focusTest: focusTest)
    } else {
      PlanPathSection(
        context: context, course: context.plan.libraryCourse, focusTest: focusTest)
    }
  }
}

/// What claiming the plan's certificates earned, for the Plan to show.
enum PlanClaim {
  /// Moments that haven't played yet.
  case moments([CertificateFacts])
  case certificate(code: String)
  case certificates
  case unchanged
}

@MainActor
struct PlanContext {
  let goal: LearnerGoal
  let plan: GoalPlan
  var adjust: (AdjustPlanSheet.Section) -> Void
  var report: () -> Void = {}
  var show: (PlanSheet) -> Void
  /// Nil when it didn't save; `showClaim` shows what it earned.
  var claimCertificate: () async -> PlanClaim? = { nil }
  var showClaim: (PlanClaim) -> Void = { _ in }
  /// The screen's, above its panes.
  var slotChecks = PlanSlotChecks()
  var slotOpening: (() -> SuggestionOpening)?
  /// A language plan's "I can already read it"; true once the alphabet is skipped.
  var alphabetSkip = VisitRequest<Bool>()

  var isPaused: Bool { goal.status == .paused }
}

/// One opening of the Plan's suggestion: whatever changes a field (put off, paged past, a refresh
/// that shows another, its sheet closed, another goal, the editor opened) ends what the opening
/// asked for. Nothing else does: the rest of the plan can change under it.
struct SuggestionOpening: Equatable {
  /// The suggestion shown, with what it says (a coverage line's time and share).
  let item: PlanSlotItem?
  /// What the fit or optional-study offer's check previewed.
  let offer: GoalPlan.Offer?
  /// The same inputs the store uses to invalidate the read these previews came from.
  let inputs: PlanInputs?
  /// Its sheet: closing it ends what was asked in it.
  let inSheet: Bool
  /// The Plan's editor: the learner changes the plan by hand, and nothing lands under it.
  let editing: Bool

  /// A claim and the next level depend on nothing in the plan.
  init(item: PlanSlotItem?, plan: GoalPlan, inSheet: Bool, editing: Bool) {
    self.item = item
    self.inSheet = inSheet
    self.editing = editing
    offer =
      switch item {
      case .fitLessons?: plan.fitOffer
      case .extraLessons?: plan.extraOffer
      default: nil
      }

    switch item {
    case .pastDate?, .coverage?:
      inputs = PlanInputs(plan)
    default:
      inputs = nil
    }
  }
}

/// Main's notice above the roadmap while the plan is rebuilt for a new content country: the old plan
/// stays usable meanwhile, and a failure keeps it.
private struct PlanRebuildNotice: View {
  @Environment(LearnerSummaryStore.self) private var learner

  let goalID: String
  let failed: Bool
  /// The Plan's, above its panes; true once the new plan started again.
  let retry: VisitRequest<Bool>

  var body: some View {
    Section {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        Group {
          if failed {
            Image(systemName: "exclamationmark.triangle.fill")
              .foregroundStyle(.warning)
          } else {
            ProgressView()
          }
        }
        .accessibilityHidden(true)

        VStack(alignment: .leading, spacing: 4) {
          title
            .typeStyle(.rowTitle)
            .foregroundStyle(Color(.foreground))

          description
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)

          if failed {
            BusyButton(isBusy: retry.isRunning, action: startAgain) {
              Text("Try again", tableName: "Plan", comment: "Starts preparing the new plan again")
            }
            .buttonStyle(.outline)
            .controlSize(.small)
            .padding(.top, 8)

            if retry.outcome == false {
              FailureLine(
                message: LocalizedStringResource(
                  "That didn't save. Try again.", table: "Plan",
                  comment: "Starting the new plan again failed")
              )
              .typeStyle(.note)
            }
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .padding(16)
      .panel()
      .listRowBackground(Color.clear)
      .listRowSeparator(.hidden)
    }
  }

  private var title: Text {
    failed
      ? Text(
        "Your new plan couldn't be made", tableName: "Plan",
        comment: "Title of the notice when making a goal's new plan failed")
      : Text(
        "Getting your new plan ready", tableName: "Plan",
        comment: "Title of the notice while a goal's plan is made again for its new country")
  }

  private var description: Text {
    failed
      ? Text(
        "Your plan is as it was.", tableName: "Plan",
        comment: "Under the notice that a goal's new plan couldn't be made")
      : Text(
        "Keep studying this one until then.", tableName: "Plan",
        comment: "Under the notice while a goal's plan is made again for its new country")
  }

  private func startAgain() {
    retry.run { [learner, goalID] in
      await learner.retryRebuild(goalID: goalID)
    }
  }
}
