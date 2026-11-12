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
        .navigationTitle(Text("Plan", tableName: "Plan", comment: "Title of the Plan tab"))
    }
  }
}

private struct GoalPlanView: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var store

  let goal: LearnerGoal

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
    .navigationTitle(Text("Plan", tableName: "Plan", comment: "Title of the Plan tab"))
    .navigationSubtitle(daysLeft(plan.value?.plan) ?? "")
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
      ContentUnavailableView {
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
      } actions: {
        Button {
          Task { await plan.refresh() }
        } label: {
          Text("Try again", tableName: "Plan", comment: "Retries loading the plan")
        }
        .buttonStyle(.outline)
      }
      .lonePage()
    case .idle, .loading:
      ProgressView()
        .lonePage()
    }
  }
}

private func daysLeft(_ plan: GoalPlan?) -> String? {
  guard let plan, let targetDate = plan.schedule.targetDate, targetDate >= plan.today else {
    return nil
  }

  let days = PlanDate.days(from: plan.today, to: targetDate)

  if days == 0 {
    return String(
      localized: "The day is here", table: "Plan", comment: "Plan subtitle on the goal's day")
  }

  if plan.schedule.targetDateEstimated {
    return String(
      localized: "~\(days) days left", table: "Plan",
      comment: "Plan subtitle: about how many days are left until the goal's estimated date")
  }

  return String(
    localized: "\(days) days left", table: "Plan",
    comment: "Plan subtitle: how many days are left until the goal's date")
}

/// Main's eyebrow: the goal, then the days left until its date.
private func planEyebrow(goal: LearnerGoal, plan: GoalPlan) -> Text {
  guard let left = daysLeft(plan) else {
    return Text(goal.displayName)
  }

  return Text(verbatim: "\(goal.displayName)\u{00A0}· \(left)")
}

/// A plan is built while the questions are still answered, on a time the learner hasn't chosen
/// yet, so the Plan leads back to them as Today does. Paused, nothing asks for them until the
/// learner resumes the goal.
private struct PlanSetupLeft: View {
  @Environment(AppRouter.self) private var router
  @Environment(\.resumeGoal) private var resumeGoal

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
    ContentUnavailableView {
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
    } actions: {
      Button {
        router.open(.goalSetup(goalId: goal.id))
      } label: {
        Text("Continue", tableName: "Plan", comment: "Opens the goal's setup questions")
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
    }
  }

  private var paused: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Your \(goal.displayName) goal is paused", tableName: "Plan",
          comment: "Title of the Plan's notice for a paused goal")
      } icon: {
        Image(systemName: "pause.circle")
      }
    } description: {
      Text(
        "Nothing is planned until you resume it.", tableName: "Plan",
        comment: "Explains a paused goal")
    } actions: {
      BusyButton(isBusy: resumeGoal.isBusy, action: resumeGoal.action) {
        Text("Resume", tableName: "Plan", comment: "Resumes the paused goal")
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
    }
  }
}

private struct PlanContent: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(AppRouter.self) private var router
  @Environment(CertificatesStore.self) private var certificates
  @Environment(PlanStore.self) private var store
  @State private var adjusting: AdjustPlanSheet.Section?
  @State private var sheet: PlanSheet?
  @State private var isReporting = false
  @State private var claimed: [CertificateFacts] = []
  @State private var slotAnswer: PlanSlotAnswer?
  /// The new plan arrived while the learner watched; gone on the next visit.
  @State private var rebuildReady = false

  let goal: LearnerGoal
  let plan: GoalPlan

  var body: some View {
    let syllabus = store.syllabus(goalId: goal.id).value
    let structure = syllabus.flatMap { $0.hasSubjectPages ? $0 : nil }
    let context = PlanContext(
      goal: goal, plan: plan, adjust: { adjusting = $0 }, report: { isReporting = true },
      show: { sheet = $0 }, claimCertificate: claimCertificate, showClaim: show)

    PaneSplit(primaryShare: 0.55) {
      ZoonkList {
        header
        rebuildNotice
        PlanRoadmapSection(context: context, structure: structure)
        structureSections(context: context, structure: structure, namesChoices: false)
      }
    } secondary: {
      ZoonkList {
        PlanNumbersSection(context: context, syllabus: syllabus)
        PlanSuggestionSection(context: context, answer: $slotAnswer, isInline: true)
        NextOnPathSection(context: context)
        PlanMoreSection(goal: goal)
        PlanSettingsSection(context: context)
      }
    } single: {
      ZoonkList {
        header
        rebuildNotice
        PlanRoadmapSection(context: context, structure: structure)
        PlanNumbersSection(context: context, syllabus: syllabus)
        PlanSuggestionSection(context: context, answer: $slotAnswer)
        structureSections(context: context, structure: structure, namesChoices: true)

        // Main's tablet column: what's next beside the other places.
        if horizontalSizeClass == .regular {
          BlockGridSection {
            NextOnPathSection(context: context)
            PlanMoreSection(goal: goal)
          }
        } else {
          NextOnPathSection(context: context)
          PlanMoreSection(goal: goal)
        }

        PlanSettingsSection(context: context)
      }
    }
    .barTitleAfterHero(String(localized: "Plan", table: "Plan", comment: "Title of the Plan tab"))
    .announcesStatus(rebuildStatus)
    .onChange(of: goal.contentCountry?.rebuild) { old, new in
      rebuildReady = old == .preparing && new == ContentCountry.Rebuild.none
    }
    .modifier(PlanToolbar(context: context))
    .planSheets($sheet, context: context, syllabus: syllabus, slotAnswer: $slotAnswer)
    .completionMoments(certificates: claimed)
    .loads(courseEnd, refreshable: false)
    .sheet(item: $adjusting) { section in
      AdjustPlanSheet(goal: goal, plan: plan, section: section, store: store)
        .zoonkStyles()
    }
    .feedbackSheet(
      isPresented: $isReporting,
      context: FeedbackContext(contentID: plan.planId, contentKind: .plan), isReport: true)
  }

  @ViewBuilder private var rebuildNotice: some View {
    if let rebuild = goal.contentCountry?.rebuild, rebuild != .none {
      PlanRebuildNotice(goalID: goal.id, failed: rebuild == .failed)
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
        localized: "Preparing your new plan", table: "Plan",
        comment: "Title of the notice while a goal's plan is rebuilt for its new content country")
    case .failed:
      String(
        localized: "Your new plan couldn't be prepared", table: "Plan",
        comment: "Title of the notice when rebuilding a goal's plan failed")
    case .some(.none), nil:
      rebuildReady
        ? String(
          localized: "Your new plan is ready.", table: "Plan",
          comment: "Replaces the notice that a new plan was being prepared, once it's ready")
        : nil
    }
  }

  private var header: some View {
    Section {
      PageHeader(
        Text("Plan", tableName: "Plan", comment: "Title of the Plan tab"),
        eyebrow: planEyebrow(goal: goal, plan: plan))
    }
  }

  /// An exam's course can finish before its plan does: its exam-day mocks come after.
  private var courseEnd: [any CachedResource] {
    goal.kind == .exam && plan.end == nil ? [store.planEnd(goalId: goal.id)] : []
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
    context: PlanContext, structure: GoalSyllabus?, namesChoices: Bool
  ) -> some View {
    let focusTest = context.plan.focusTest.map {
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

struct PlanContext {
  let goal: LearnerGoal
  let plan: GoalPlan
  var adjust: (AdjustPlanSheet.Section) -> Void
  var report: () -> Void = {}
  var show: (PlanSheet) -> Void
  /// Nil when it didn't save; `showClaim` shows what it earned.
  var claimCertificate: () async -> PlanClaim? = { nil }
  var showClaim: (PlanClaim) -> Void = { _ in }

  var isPaused: Bool { goal.status == .paused }
}

/// Main's notice above the roadmap while the plan is rebuilt for a new content country: the old plan
/// stays usable meanwhile, and a failure keeps it.
private struct PlanRebuildNotice: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @State private var isRetrying = false
  @State private var retryFailed = false

  let goalID: String
  let failed: Bool

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
            BusyButton(isBusy: isRetrying, action: retry) {
              Text("Try again", tableName: "Plan", comment: "Starts preparing the new plan again")
            }
            .buttonStyle(.outline)
            .controlSize(.small)
            .padding(.top, 8)

            if retryFailed {
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
        "Your new plan couldn't be prepared", tableName: "Plan",
        comment: "Title of the notice when rebuilding a goal's plan failed")
      : Text(
        "Preparing your new plan", tableName: "Plan",
        comment: "Title of the notice while a goal's plan is rebuilt for its new content country")
  }

  private var description: Text {
    failed
      ? Text(
        "Your plan still has the lessons it had before.", tableName: "Plan",
        comment: "Under the notice that a goal's new plan couldn't be prepared")
      : Text(
        "Keep studying: this plan stays until the new one is ready, and the lessons you've finished stay done.",
        tableName: "Plan",
        comment: "Under the notice while a goal's plan is rebuilt for its new content country")
  }

  private func retry() {
    isRetrying = true
    retryFailed = false

    Task {
      retryFailed = !(await learner.retryRebuild(goalID: goalID))
      isRetrying = false
    }
  }
}
