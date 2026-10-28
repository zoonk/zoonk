import SwiftUI

/// The end of a goal's onboarding: "Building your plan" while the goal's run writes it, then the plan itself, shown only once the plan says it's ready. An exam's plan first waits for research to read its official documents, so the learner sees the plan they follow.
struct PlanStep: View {
  let view: GoalOnboarding

  @Environment(OnboardingStore.self) private var onboarding
  @Environment(PlanStore.self) private var plans
  /// Once the wait shows, reading the plan again never swaps it for a spinner.
  @State private var isWaiting = false

  /// How often the reveal checks an exam's documents are read.
  private static let noticeCheck = Duration.seconds(3)

  var body: some View {
    let plan = plans.plan(goalId: view.goal.id)

    Group {
      switch plan.value?.plan {
      case let ready? where ready.ready && ready.notice != .reading:
        PlanReveal(view: view, plan: ready)
      case let reading? where reading.ready:
        NoticeReadingView(plan: reading)
          .task {
            while !Task.isCancelled {
              try? await Task.sleep(for: Self.noticeCheck)
              await plan.refresh()
            }
          }
      default:
        switch (plan.state, isWaiting) {
        case (.idle, false), (.loading, false):
          ProgressView()
        default:
          building(plan)
            .onAppear { isWaiting = true }
        }
      }
    }
    .loads(plan, refreshable: false)
  }

  private func building(_ plan: Resource<PlanRead>) -> some View {
    GenerationWaitView(
      title: LocalizedStringResource(
        "Building your plan", table: "Onboarding", comment: "Title while a goal's plan is built"),
      description: LocalizedStringResource(
        "We're choosing what to learn first and fitting it into your days. A new subject can take a minute or two.",
        table: "Onboarding", comment: "Shown while a goal's plan is built"),
      generationID: view.generationId,
      kind: .curriculum,
      readGenerationID: {
        let goal = onboarding.onboarding(goalID: view.goal.id)
        await goal.refresh()
        return goal.value?.generationId
      },
      restart: { try await onboarding.writeGoal(goalID: view.goal.id) },
      readResult: { await readUntilReady(plan) })
  }

  /// The run saved the plan: read it, again a moment later while the save lands.
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

/// An exam's plan while research reads its official documents: the plan from what the learner said is done, and the documents' subjects, topics and dates go into it before they see it.
private struct NoticeReadingView: View {
  let plan: GoalPlan

  var body: some View {
    List {
      StepHeader(title: title, description: description)

      Section {
        LabeledContent {
          Image(systemName: "checkmark")
            .fontWeight(.semibold)
            .foregroundStyle(.success)
            .accessibilityLabel(
              Text("Done", tableName: "Onboarding", comment: "A finished step of a wait"))
        } label: {
          Text(
            "Your plan, from what you told us", tableName: "Onboarding",
            comment: "The done step while an exam's official documents are read")
        }

        LabeledContent {
          ProgressView()
        } label: {
          Text(
            "Reading the official documents", tableName: "Onboarding",
            comment: "The step going while an exam's official documents are read")
        }
      }
    }
  }

  /// While the next edition's documents aren't out, the plan follows the last edition's.
  private var title: Text {
    plan.schedule.targetDateEstimated
      ? Text(
        "Reading the last edition's official documents", tableName: "Onboarding",
        comment: "Title while the last edition of an exam's official documents is read")
      : Text(
        "Reading the exam's official documents", tableName: "Onboarding",
        comment: "Title while an exam's official documents are read")
  }

  private var description: Text {
    if plan.schedule.targetDateEstimated {
      return Text(
        "The next edition's documents aren't out yet, so your plan follows the last one's subjects and topics. We'll tell you when the new ones are out. This usually takes a few minutes.",
        tableName: "Onboarding", comment: "While the last edition of an exam's documents is read")
    }

    switch plan.examDocument {
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

/// "Plan created", as the plan's page: the goal and its facts in one line, Start (Return) and Adjust, then the phases in time, the goal's structure or its path, and the one thing the plan wants the learner to know.
private struct PlanReveal: View {
  let view: GoalOnboarding
  let plan: GoalPlan

  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans
  @State private var adjusting: AdjustPlanSheet.Section?

  var body: some View {
    let goal = learnerGoal
    let context = PlanContext(goal: goal, plan: plan, adjust: { adjusting = $0 })
    let syllabus = plans.syllabus(goalId: goal.id)
    let structure = syllabus.value.flatMap { $0.hasSubjectPages ? $0 : nil }

    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Label {
            Text(
              "Plan created", tableName: "Onboarding",
              comment: "Eyebrow over a goal whose plan was just built")
          } icon: {
            Image(systemName: "checkmark.circle.fill")
          }
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(.success)

          Text(goal.title)
            .font(.title2.bold())
            .accessibilityAddTraits(.isHeader)

          Text(facts.joined(separator: " · "))
            .font(.subheadline)
            .monospacedDigit()
            .foregroundStyle(.secondary)
        }
        .listRowBackground(Color.clear)
      }

      Section {
        VStack(spacing: 12) {
          Button {
            router.showRoot(of: .today)
          } label: {
            Text("Start", tableName: "Onboarding", comment: "Opens Today with the plan's first day")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.mainAction)
          .keyboardShortcut(.defaultAction)

          Button {
            adjusting = .top
          } label: {
            Text(
              "Adjust", tableName: "Onboarding", comment: "Opens the plan's settings to change it"
            )
            .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
        }
        .controlSize(.large)
        .keepsOffFold()
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
      } footer: {
        if learner.summary.value?.identity.isAnonymous == true {
          VStack(alignment: .leading, spacing: 8) {
            Text(
              "Save your plan so it's here next time.", tableName: "Onboarding",
              comment: "A guest's plan isn't saved to an account yet")
            Button {
              router.present(.signIn)
            } label: {
              Text(
                "Create an account", tableName: "Onboarding", comment: "Opens sign-up from the plan"
              )
            }
          }
        }
      }

      // A plan of one phase has nothing to draw in time: its chapters say its shape instead.
      if plan.roadPhases.count > 1 {
        PlanRoadmapSection(context: context, structure: structure)
      } else {
        RevealChapters(plan: plan)
      }

      if plan.notice == .usual {
        Section {
        } footer: {
          Text(
            "This plan follows the exam's usual structure while we finish reading its official documents. If they change your plan, you'll decide on Today.",
            tableName: "Onboarding",
            comment: "Under a plan revealed before its exam's official documents were read")
        }
      }

      PlanSuggestionSection(context: context)

      if let structure {
        PlanSyllabusSection(goalKind: goal.kind, syllabus: structure)
      } else if plan.roadPhases.count > 1 {
        PlanPathSection(context: context)
      }
    }
    .loads(syllabus, refreshable: false)
    .sheet(item: $adjusting) { section in
      AdjustPlanSheet(goal: goal, plan: plan, section: section, store: plans)
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

  /// How long until the goal (or when it ends at this pace), the time a day and the study time it adds up to: "About 375 days · 30 min a day · about 120 hr of study".
  private var facts: [String] {
    let schedule = plan.schedule
    var facts: [String] = []

    if let targetDate = schedule.targetDate, targetDate >= plan.today {
      let days = PlanDate.days(from: plan.today, to: targetDate)
      facts.append(
        schedule.targetDateEstimated
          ? String(
            localized: "About \(days) days", table: "Onboarding",
            comment: "How long until a goal's estimated date")
          : String(
            localized: "\(days) days", table: "Onboarding", comment: "How long until a goal's date")
      )
    } else if schedule.targetDate == nil, let endDate = plan.estimate.endDate {
      // The month when it's far off; the day within a few weeks, so it never reads "October" in October.
      let isNear = PlanDate.days(from: plan.week.startDate, to: endDate) <= 42
      facts.append(
        String(
          localized:
            "Until about \(PlanDate.text(endDate, today: plan.today, month: !isNear))",
          table: "Onboarding", comment: "When a plan without a date ends at this pace"))
    }

    facts.append(
      String(
        localized: "\(planDurationText(minutes: Double(schedule.dailyMinutes))) a day",
        table: "Onboarding", comment: "How long the learner studies each day"))

    if let study = studyMinutes, study > 0 {
      facts.append(
        String(
          localized: "about \(planDurationText(minutes: study)) of study", table: "Onboarding",
          comment: "The study time a plan adds up to"))
    }

    return facts
  }

  /// What the plan studies before the date, or all of it without one; to five minutes under two hours and to the hour above, as "about" says.
  private var studyMinutes: Double? {
    guard let numbers = plan.numbers else {
      return nil
    }

    let minutes =
      numbers.context.targetDate == nil
      ? numbers.scheduledMinutes : (numbers.beforeDeadlineMinutes ?? 0)

    return minutes >= 120 ? (minutes / 60).rounded() * 60 : (minutes / 5).rounded() * 5
  }
}

/// A one-phase plan's chapters in order, the first few with a count of the rest, so the learner sees what the plan holds before starting (main's `PlanChapterList`). Lessons still being written ahead aren't chapters yet.
private struct RevealChapters: View {
  let plan: GoalPlan

  /// How many rows the reveal shows; the Plan has the rest.
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
              .foregroundStyle(.secondary)
          }
        }
      } header: {
        Text("Chapters", tableName: "Onboarding", comment: "Header over a new plan's chapters")
      } footer: {
        if rest > 0 {
          Text(
            "\(rest) more chapters", tableName: "Onboarding",
            comment: "Under a new plan's first chapters: how many more it holds")
        }
      }
    }
  }
}
