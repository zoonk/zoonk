import SwiftUI

/// What the Plan's slot can say, the most pressing first (main's order): the goal is paused, each
/// exam choice still to make, the date came with lessons left, once the plan is finished what to
/// study next (after what the learner's time fits), the plan no longer fits, the learner is behind,
/// what their time fits or what it covers, and a free exam plan's week is over.
enum PlanSlotItem: Hashable {
  case behind(String)
  case choice(GoalPlan.ExamChoice)
  case coverage(String)
  case finished
  case fitLessons
  case freeWeekOver
  case pastDate(String)
  case paused
  case tooTight

  static func items(plan: GoalPlan, isPaused: Bool, isExam: Bool) -> [PlanSlotItem] {
    let fix = planPaceFix(plan, isExam: isExam)
    let status = plan.status?.kind
    let finished = plan.end != nil
    let open = !plan.access.freeWeekOver && status != .pastDate
    let coverage = planCoverageText(plan)
    let timeItems: [PlanSlotItem] = [
      open && plan.fitOffer != nil ? .fitLessons : nil,
      open && !(plan.feasibility?.timeCovers ?? false) ? coverage.map { .coverage($0) } : nil,
    ].compactMap(\.self)

    var items: [PlanSlotItem] = []

    if isPaused {
      items.append(.paused)
    }

    items += plan.examChoices.filter { $0.subject == nil }.map { .choice($0) }

    if status == .pastDate, let fix {
      items.append(.pastDate(fix.text))
    }

    if finished {
      items += timeItems
      items.append(.finished)
    }

    if status == .needsAdjusting, fix != nil {
      items.append(.tooTight)
    }

    if status == .behind, let fix {
      items.append(.behind(fix.text))
    }

    if !finished {
      items += timeItems
    }

    if plan.access.freeWeekOver {
      items.append(.freeWeekOver)
    }

    return items
  }
}

/// The Plan's one slot for what it wants the learner to know or decide, one thing at a time:
/// "Not now" moves on to the next for as long as the app runs.
struct PlanSuggestionSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @State private var dismissed: Set<PlanSlotItem> = []
  @State private var isWorking = false

  let context: PlanContext

  var body: some View {
    let items = PlanSlotItem.items(
      plan: context.plan, isPaused: context.isPaused, isExam: context.goal.kind == .exam
    ).filter { !dismissed.contains($0) }

    if let item = items.first {
      Section {
        slot(item)
          .padding(.vertical, 4)
      } footer: {
        if items.count > 1 {
          Text(
            "1 of \(items.count)", tableName: "Plan",
            comment: "The suggestion shown of the Plan's suggestions")
        }
      }
      .disabled(isWorking)
    }
  }

  @ViewBuilder
  private func slot(_ item: PlanSlotItem) -> some View {
    switch item {
    case .paused:
      PlanPausedSlot(context: context)
    case .choice(let choice):
      card(
        title: Text(
          "\(choice.group): which one will you take?", tableName: "Plan",
          comment: "Asks which option of an exam's choice the learner takes"),
        systemImage: "list.bullet",
        description: Text(
          "Pick the one you'll take. Until you do, your plan leaves \(choice.group) out.",
          tableName: "Plan", comment: "Explains an exam choice still to make")
      ) {
        Menu {
          ForEach(choice.options, id: \.self) { option in
            Button(option.name) {
              Task { await choose(option.name, in: choice) }
            }
          }
        } label: {
          Text("Choose", tableName: "Plan", comment: "Opens an exam choice's options")
        }
      }
    case .pastDate(let text):
      card(
        title: Text(
          "Your date came", tableName: "Plan",
          comment: "Title of the Plan's notice when the goal's date came"),
        systemImage: "calendar.badge.exclamationmark", description: Text(text)
      ) {
        adjustButton(.date)
        notNow(item)
      }
    case .fitLessons:
      fitLessons(item)
    case .coverage(let text):
      card(title: Text(text), systemImage: "clock", description: nil) {
        adjustButton(.time)
        notNow(item)
      }
    case .finished:
      PlanFinishedSlot(context: context)
    case .tooTight:
      card(
        title: Text(
          "Your plan no longer fits", tableName: "Plan",
          comment: "Title of the Plan's notice when the plan no longer fits"),
        systemImage: "calendar.badge.clock", description: nil
      ) {
        adjustButton(.top)
      }
    case .behind(let text):
      card(
        title: Text(
          "A little to catch up", tableName: "Plan",
          comment: "Title of the Plan's notice when behind"),
        systemImage: "calendar.badge.clock", description: Text(text)
      ) {
        Button {
          router.select(.today)
        } label: {
          Text(
            "Go to Today", tableName: "Plan", comment: "Opens Today, which puts what's behind first"
          )
        }
      }
    case .freeWeekOver:
      PlusNotice(
        title: Text(
          "Your free week of exam prep is over", tableName: "Plan",
          comment: "Title of the Plan's notice when a free exam plan's first week ended"),
        description: Text(
          "Reviews and fixing your mistakes stay free. Plus opens new lessons, the rest of your plan and mock exams.",
          tableName: "Plan", comment: "What stays free and what Plus opens after the free week"),
        isInset: true)
    }
  }

  @ViewBuilder
  private func fitLessons(_ item: PlanSlotItem) -> some View {
    if let offer = context.plan.fitOffer {
      let title =
        offer.fits && context.plan.schedule.targetDate != nil
        ? Text(
          "Your time covers everything by \(PlanDate.text(context.plan.schedule.targetDate ?? "", today: context.plan.today))",
          tableName: "Plan", comment: "Title of the offer that brings the whole goal in")
        : Text(
          "More lessons fit in your time", tableName: "Plan",
          comment: "Title of the offer that brings more lessons in")

      card(title: title, systemImage: "sparkles", description: nil) {
        if offer.canApply {
          Button {
            Task { await applyOffer(offer) }
          } label: {
            Text("Apply", tableName: "Plan", comment: "Applies a plan offer")
          }
        }

        notNow(item)
      }
    }
  }

  private func card(
    title: Text, systemImage: String, description: Text?,
    @ViewBuilder actions: () -> some View
  ) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Label {
        title.font(.headline)
      } icon: {
        Image(systemName: systemImage)
          .foregroundStyle(.warning)
      }

      if let description {
        description
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      HStack {
        actions()
      }
      .buttonStyle(.bordered)
    }
  }

  private func adjustButton(_ section: AdjustPlanSheet.Section) -> some View {
    Button {
      context.adjust(section)
    } label: {
      Text("Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
    }
  }

  private func notNow(_ item: PlanSlotItem) -> some View {
    Button {
      dismissed.insert(item)
    } label: {
      Text("Not now", tableName: "Plan", comment: "Puts a suggestion off")
    }
  }

  private func choose(_ subject: String, in choice: GoalPlan.ExamChoice) async {
    isWorking = true
    defer { isWorking = false }

    let goalId = context.goal.id
    let group = choice.group
    await planEditor.apply(
      sentence: String(
        localized: "Your plan studies \(subject) for \(group).", table: "Plan",
        comment: "Says which option the plan studies for an exam's choice")
    ) { api, token in
      try await api.chooseExamOption(token: token, goalId: goalId, group: group, subject: subject)
    }
  }

  private func applyOffer(_ offer: GoalPlan.FitOffer) async {
    isWorking = true
    defer { isWorking = false }

    await planEditor.change(
      offer.operations.map { .operation($0) },
      sentence: String(
        localized: "Your plan is updated.", table: "Plan", comment: "An offer applied"))
  }

  /// Saves from the slot; the plan, Today and the summary follow.
  private var planEditor: PlanEditor {
    PlanEditor(goalId: context.goal.id, store: store)
  }
}

/// A paused goal, first, with the way back: nothing is planned until the learner resumes it. When
/// resuming changes the plan (the pause left lessons behind), it says so before Resume.
private struct PlanPausedSlot: View {
  @Environment(PlanStore.self) private var store
  @State private var isResuming = false

  let context: PlanContext

  var body: some View {
    let preview = store.resumeChangesPlan(goalId: context.goal.id)

    VStack(alignment: .leading, spacing: 8) {
      Label {
        Text(
          "\(context.goal.title) is paused", tableName: "Plan",
          comment: "Title of the Plan's notice for a paused goal"
        )
        .font(.headline)
      } icon: {
        Image(systemName: "pause")
          .foregroundStyle(.warning)
      }

      Group {
        if preview.value == true {
          Text(
            "Your plan picks up from today, starting with the lessons planned for the days you paused.",
            tableName: "Plan", comment: "Explains how resuming the paused goal changes its plan")
        } else {
          Text(
            "Nothing is planned until you resume it.", tableName: "Plan",
            comment: "Explains a paused goal")
        }
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)

      Button {
        Task {
          isResuming = true
          _ = await store.setStatus(.active, goalId: context.goal.id)
          isResuming = false
        }
      } label: {
        Text("Resume", tableName: "Plan", comment: "Resumes the paused goal")
      }
      .buttonStyle(.bordered)
      .disabled(isResuming)
    }
    .loads(preview, refreshable: false)
  }
}

/// Once every lesson is studied or tested out: the plan is finished, and what to study next is the
/// next level of the same course in one tap, and the other courses the plan drew from.
private struct PlanFinishedSlot: View {
  @Environment(PlanStore.self) private var store
  @State private var failed = false
  @State private var isStarting = false

  let context: PlanContext

  var body: some View {
    let next = store.studyNext(goalId: context.goal.id)

    VStack(alignment: .leading, spacing: 8) {
      Label {
        Text("You finished your plan", tableName: "Plan", comment: "Title once the plan is over")
          .font(.headline)
      } icon: {
        StatusMark(status: .done)
      }

      if let value = next.value, value.nextLevel != nil || !value.related.isEmpty {
        Text(
          "Here's what to study next.", tableName: "Plan", comment: "Leads to what to study next"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)

        if let level = value.nextLevel {
          Button {
            Task { await continueAtNextLevel() }
          } label: {
            Text(
              "Continue at \(planLevelName(level.level))", tableName: "Plan",
              comment: "Starts the next level of the plan's course")
          }
          .buttonStyle(.bordered)
          .disabled(isStarting)
        }

        // TODO(S10): open each course's catalog page once the shell has a route for one.
        ForEach(value.related) { course in
          Label(course.title, systemImage: "books.vertical")
            .font(.subheadline)
        }
      }

      if failed {
        Text(
          "That didn't work. Try again in a moment.", tableName: "Plan",
          comment: "Says the next level didn't start"
        )
        .font(.subheadline)
        .foregroundStyle(.destructive)
      }
    }
    .loads(next, refreshable: false)
  }

  private func continueAtNextLevel() async {
    isStarting = true
    failed = !(await store.continueAtNextLevel(goalId: context.goal.id))
    isStarting = false
  }
}

/// A course level's name: "Beginner", "Advanced".
func planLevelName(_ level: String) -> String {
  switch level {
  case "overview": String(localized: "Overview", table: "Plan", comment: "A course level")
  case "beginner": String(localized: "Beginner", table: "Plan", comment: "A course level")
  case "intermediate": String(localized: "Intermediate", table: "Plan", comment: "A course level")
  default: String(localized: "Advanced", table: "Plan", comment: "A course level")
  }
}
