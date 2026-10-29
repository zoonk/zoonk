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
      if goal.kind == .language {
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
    case .idle, .loading:
      ProgressView()
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

private struct PlanContent: View {
  @Environment(PlanStore.self) private var store
  @State private var adjusting: AdjustPlanSheet.Section?
  @State private var isReporting = false

  let goal: LearnerGoal
  let plan: GoalPlan

  var body: some View {
    let syllabus = store.syllabus(goalId: goal.id).value
    let structure = syllabus.flatMap { $0.hasSubjectPages ? $0 : nil }
    let context = PlanContext(
      goal: goal, plan: plan, adjust: { adjusting = $0 }, report: { isReporting = true })

    PaneSplit(primaryShare: 0.55) {
      List {
        PlanHeaderRow(context: context)
        PlanRoadmapSection(context: context, structure: structure)
        structureSections(context: context, structure: structure)
      }
    } secondary: {
      List {
        PlanNumbersSection(context: context, syllabus: syllabus)
        PlanSuggestionSection(context: context)
        NextOnPathSection(context: context)
        PlanMoreSection(goal: goal)
        PlanSettingsSection(context: context)
      }
    } single: {
      List {
        PlanHeaderRow(context: context)
        PlanRoadmapSection(context: context, structure: structure)
        PlanNumbersSection(context: context, syllabus: syllabus)
        PlanSuggestionSection(context: context)
        structureSections(context: context, structure: structure)
        NextOnPathSection(context: context)
        PlanMoreSection(goal: goal)
        PlanSettingsSection(context: context)
      }
    }
    .sheet(item: $adjusting) { section in
      AdjustPlanSheet(goal: goal, plan: plan, section: section, store: store)
    }
    .sheet(isPresented: $isReporting) {
      FeedbackSheet(
        api: FeedbackAPI.live(),
        context: FeedbackContext(contentID: plan.planId, contentKind: .plan),
        isReport: true)
    }
  }

  @ViewBuilder
  private func structureSections(context: PlanContext, structure: GoalSyllabus?) -> some View {
    if let structure {
      PlanSyllabusSection(goalKind: goal.kind, syllabus: structure)
    } else {
      PlanPathSection(context: context)
    }
  }
}

struct PlanContext {
  let goal: LearnerGoal
  let plan: GoalPlan
  let adjust: (AdjustPlanSheet.Section) -> Void
  var report: () -> Void = {}

  var isPaused: Bool { goal.status == .paused }
}

private struct PlanHeaderRow: View {
  let context: PlanContext

  var body: some View {
    HStack {
      Button {
        context.adjust(.top)
      } label: {
        Text("Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
          .frame(maxHeight: .infinity)
      }

      PlanMenu(context: context)
    }
    .fixedSize(horizontal: false, vertical: true)
    .buttonStyle(.bordered)
    .listRowBackground(Color.clear)
    .listRowInsets(EdgeInsets())
  }
}
