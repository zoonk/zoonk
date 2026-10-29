import SwiftUI

/// An exam's plan first waits for research to read its official documents, so the learner sees the
/// plan they follow.
struct PlanStep: View {
  let view: GoalOnboarding

  @Environment(OnboardingStore.self) private var onboarding
  @Environment(PlanStore.self) private var plans
  /// Once the wait shows, reading the plan again never swaps it for a spinner.
  @State private var isWaiting = false

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

private struct PlanReveal: View {
  let view: GoalOnboarding
  let plan: GoalPlan

  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans
  @State private var adjusting: AdjustPlanSheet.Section?
  @State private var showsTopics = false

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
        PlanRoadmapSection(context: context, structure: structure, listsPhases: true)
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

      if let syllabus = syllabus.value {
        AreaWeights(syllabus: syllabus)
      }

      PlanSuggestionSection(context: context)

      if let structure {
        Section {
          Text(syllabusSummary(structure, dailyMinutes: plan.schedule.dailyMinutes))
            .foregroundStyle(.secondary)

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
    .loads(syllabus, refreshable: false)
    .sheet(item: $adjusting) { section in
      AdjustPlanSheet(goal: goal, plan: plan, section: section, store: plans)
    }
    .sheet(isPresented: $showsTopics) {
      if let structure {
        SyllabusTopicsSheet(syllabus: structure)
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

  /// To five minutes under two hours and to the hour above, as "about" says.
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

/// Main's `useSyllabusSummaryText`: the plan's subjects in one line.
func syllabusSummary(_ syllabus: GoalSyllabus, dailyMinutes: Int) -> String {
  let firstSubjects = syllabus.subjects.prefix(2).map(\.shortName).joined(separator: " · ")
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

  return [title, detail].compactMap { $0?.isEmpty == false ? $0 : nil }.joined(separator: " · ")
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

  let heaviest = counted.prefix(3).map { "\($0.0.shortName) \($0.1)" }.joined(separator: " · ")
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
      List {
        ForEach(syllabus.subjects) { subject in
          if subject.topics.isEmpty {
            label(subject)
          } else {
            DisclosureGroup {
              ForEach(subject.topics) { topic in
                Text(topic.name)
                  .foregroundStyle(topic.status == "notPlanned" ? .secondary : .primary)
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
          .font(.footnote)
          .monospacedDigit()
          .foregroundStyle(.secondary)
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

    return parts.isEmpty ? nil : parts.joined(separator: " · ")
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
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(.secondary)
            }

            ProgressView(value: weight.share)
              .tint(.primary)
              .accessibilityHidden(true)
          }
          .accessibilityElement(children: .combine)
        }
      } header: {
        Text(
          "Weight by area", tableName: "Onboarding",
          comment: "Header over an exam's areas and how much each weighs")
      } footer: {
        if assumed > 0 {
          Text(estimateNote(assumed))
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
