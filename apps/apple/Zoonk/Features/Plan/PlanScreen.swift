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
  @Environment(PlanStore.self) private var store

  let goal: LearnerGoal

  var body: some View {
    let plan = store.plan(goalId: goal.id)
    let syllabus = store.syllabus(goalId: goal.id)
    let standing = store.standing(goalId: goal.id)

    Group {
      if goal.isSettingUp {
        PlanSetupLeft(goalID: goal.id)
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
    .navigationSubtitle(subtitle(plan.value?.plan) ?? Text(verbatim: ""))
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
        .buttonStyle(.bordered)
      }
      .lonePage()
    case .idle, .loading:
      ProgressView()
        .lonePage()
    }
  }

  private func subtitle(_ plan: GoalPlan?) -> Text? {
    guard let plan, let targetDate = plan.schedule.targetDate, targetDate >= plan.today else {
      return nil
    }

    let days = PlanDate.days(from: plan.today, to: targetDate)

    if days == 0 {
      return Text("The day is here", tableName: "Plan", comment: "Plan subtitle on the goal's day")
    }

    if plan.schedule.targetDateEstimated {
      return Text(
        "~\(days) days left", tableName: "Plan",
        comment: "Plan subtitle: about how many days are left until the goal's estimated date")
    }

    return Text(
      "\(days) days left", tableName: "Plan",
      comment: "Plan subtitle: how many days are left until the goal's date")
  }
}

/// A plan is built while the questions are still answered, on a time the learner hasn't chosen
/// yet, so the Plan leads back to them as Today does.
private struct PlanSetupLeft: View {
  @Environment(AppRouter.self) private var router

  let goalID: String

  var body: some View {
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
        router.open(.goalSetup(goalId: goalID))
      } label: {
        Text("Continue", tableName: "Plan", comment: "Opens the goal's setup questions")
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
    }
    .lonePage()
  }
}

private struct PlanContent: View {
  @Environment(AppRouter.self) private var router
  @Environment(CertificatesStore.self) private var certificates
  @Environment(PlanStore.self) private var store
  @State private var adjusting: AdjustPlanSheet.Section?
  @State private var sheet: PlanSheet?
  @State private var isReporting = false
  @State private var claimed: [CertificateFacts] = []
  @State private var slotAnswer: PlanSlotAnswer?

  let goal: LearnerGoal
  let plan: GoalPlan

  var body: some View {
    let syllabus = store.syllabus(goalId: goal.id).value
    let structure = syllabus.flatMap { $0.hasSubjectPages ? $0 : nil }
    let context = PlanContext(
      goal: goal, plan: plan, adjust: { adjusting = $0 }, report: { isReporting = true },
      show: { sheet = $0 }, claimCertificate: claimCertificate)

    PaneSplit(primaryShare: 0.55) {
      List {
        PlanRoadmapSection(context: context, structure: structure)
        structureSections(context: context, structure: structure)
      }
    } secondary: {
      List {
        PlanNumbersSection(context: context, syllabus: syllabus)
        PlanSuggestionSection(context: context, answer: $slotAnswer)
        NextOnPathSection(context: context)
        PlanMoreSection(goal: goal)
        PlanSettingsSection(context: context)
      }
    } single: {
      List {
        PlanRoadmapSection(context: context, structure: structure)
        PlanNumbersSection(context: context, syllabus: syllabus)
        PlanSuggestionSection(context: context, answer: $slotAnswer)
        structureSections(context: context, structure: structure)
        NextOnPathSection(context: context)
        PlanMoreSection(goal: goal)
        PlanSettingsSection(context: context)
      }
    }
    .modifier(PlanToolbar(context: context))
    .planSheets($sheet, context: context, syllabus: syllabus)
    .completionMoments(certificates: claimed)
    .loads(courseEnd, refreshable: false)
    .sheet(item: $adjusting) { section in
      AdjustPlanSheet(goal: goal, plan: plan, section: section, store: store)
        .accessibilitySizeStyles()
    }
    .feedbackSheet(
      isPresented: $isReporting,
      context: FeedbackContext(contentID: plan.planId, contentKind: .plan), isReport: true)
  }

  /// An exam's course can finish before its plan does: its exam-day mocks come after.
  private var courseEnd: [any CachedResource] {
    goal.kind == .exam && plan.end == nil ? [store.planEnd(goalId: goal.id)] : []
  }

  /// The learner asked for them, so when every moment already played, the certificate opens
  /// instead.
  private func claimCertificate() async -> Bool {
    switch await certificates.claim(goalID: goal.id) {
    case .done(let claimed) where !claimed.isEmpty:
      let unshown = claimed.filter { !$0.wasShown }.map(\.facts)

      if !unshown.isEmpty {
        self.claimed = unshown
      } else if let only = claimed.first, claimed.count == 1 {
        sheet = .certificate(code: only.facts.code)
      } else {
        router.present(.account(.certificates))
      }
      return true
    case .done, .failed: return false
    case .obsolete: return true
    }
  }

  @ViewBuilder
  private func structureSections(context: PlanContext, structure: GoalSyllabus?) -> some View {
    if let structure {
      PlanSyllabusSection(goalKind: goal.kind, syllabus: structure)
    } else {
      PlanPathSection(context: context, course: context.plan.libraryCourse)
    }
  }
}

struct PlanContext {
  let goal: LearnerGoal
  let plan: GoalPlan
  let adjust: (AdjustPlanSheet.Section) -> Void
  var report: () -> Void = {}
  var show: (PlanSheet) -> Void
  /// False when it didn't save; the Plan plays the certificate's moment.
  var claimCertificate: () async -> Bool = { false }

  var isPaused: Bool { goal.status == .paused }
}
