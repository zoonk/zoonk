import SwiftUI

/// The most pressing first, in main's order.
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

/// One thing at a time: "Not now" moves on to the next for as long as the app runs.
struct PlanSuggestionSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store

  let context: PlanContext

  var body: some View {
    let state = store.suggestionState(goalId: context.goal.id)
    let items = PlanSlotItem.items(
      plan: context.plan, isPaused: context.isPaused, isExam: context.goal.kind == .exam
    ).filter { !state.dismissed.contains($0) }

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
      .disabled(state.isWorking)
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
          comment:
            "Asks which option of an exam's choice, like its foreign language, the learner takes"),
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
        Button {
          context.adjust(.date)
        } label: {
          Text("Change the date", tableName: "Plan", comment: "Opens the plan's date to change it")
        }

        notNow(item)
      }
    case .fitLessons:
      fitLessons(item)
    case .coverage(let text):
      card(title: Text(text), systemImage: "clock", description: nil) {
        Button {
          context.adjust(.time)
        } label: {
          Text(
            "Change time a day", tableName: "Plan",
            comment: "Opens the plan's study time a day to change it")
        }

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
        Button {
          context.adjust(.top)
        } label: {
          Text(
            "Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
        }
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
      FreeWeekOverNotice()
    }
  }

  private func fitTitle(_ offer: GoalPlan.FitOffer) -> Text {
    let schedule = context.plan.schedule

    guard offer.fits, let targetDate = schedule.targetDate else {
      return Text(
        "\(offer.effect.lessonsAdded) more lessons fit in your time", tableName: "Plan",
        comment: "Title of the offer that brings more lessons in")
    }

    let date = PlanDate.text(
      targetDate, today: context.plan.today, month: schedule.targetDateNamedMonth)

    return schedule.targetDateNamedMonth
      ? Text(
        "Your time covers everything by the start of \(date)", tableName: "Plan",
        comment:
          "Title of the offer that brings the whole goal in; the argument is the month the learner named, like 'May 2027'"
      )
      : Text(
        "Your time covers everything by \(date)", tableName: "Plan",
        comment:
          "Title of the offer that brings the whole goal in; the argument is a date like 'May 5'")
  }

  @ViewBuilder
  private func fitLessons(_ item: PlanSlotItem) -> some View {
    if let offer = context.plan.fitOffer {
      let title = fitTitle(offer)

      card(
        title: title, systemImage: "sparkles",
        description: topicsMoved(offer.effect).map(Text.init),
        effect: offer.effect
      ) {
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
    title: Text, systemImage: String, description: Text?, effect: PlanEffect? = nil,
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

      PlanEffectDiff(effect: effect, today: context.plan.today)

      HStack {
        actions()
      }
      .buttonStyle(.bordered)
    }
  }

  /// Main's `useTopicsMovedSentence`, naming two topics.
  private func topicsMoved(_ effect: PlanEffect) -> String? {
    let out = (effect.topicsLeftOut ?? []).flatMap(\.topics)
    let back = (effect.topicsAdded ?? []).flatMap(\.topics)
    let outList = planTopicList(out, named: 2)
    let backList = planTopicList(back, named: 2)
    let sentences = [
      out.isEmpty
        ? nil
        : out.count == 1
          ? String(
            localized: "\(outList) no longer fits by your date.", table: "Plan",
            comment: "One topic a change leaves out of what the goal's date covers")
          : String(
            localized: "\(outList) no longer fit by your date.", table: "Plan",
            comment: "Topics a change leaves out of what the goal's date covers, listed"),
      back.isEmpty
        ? nil
        : back.count == 1
          ? String(
            localized: "\(backList) now fits by your date.", table: "Plan",
            comment: "One topic a change brings into what the goal's date covers")
          : String(
            localized: "\(backList) now fit by your date.", table: "Plan",
            comment: "Topics a change brings into what the goal's date covers, listed"),
    ].compactMap(\.self)

    return sentences.isEmpty ? nil : sentences.joined(separator: " ")
  }

  private func notNow(_ item: PlanSlotItem) -> some View {
    Button {
      store.setSuggestionState(store.suggestionKey(goalId: context.goal.id)) {
        $0.dismissed.insert(item)
      }
    } label: {
      Text("Not now", tableName: "Plan", comment: "Puts a suggestion off")
    }
  }

  private func choose(_ subject: String, in choice: GoalPlan.ExamChoice) async {
    let key = store.suggestionKey(goalId: context.goal.id)
    store.setSuggestionState(key) { $0.isWorking = true }
    defer { store.setSuggestionState(key) { $0.isWorking = false } }

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
    let key = store.suggestionKey(goalId: context.goal.id)
    store.setSuggestionState(key) { $0.isWorking = true }
    defer { store.setSuggestionState(key) { $0.isWorking = false } }

    await planEditor.change(
      offer.operations.map { .operation($0) },
      sentence: String(
        localized: "Your plan is updated.", table: "Plan", comment: "An offer applied"))
  }

  private var planEditor: PlanEditor {
    PlanEditor(goalId: context.goal.id, store: store)
  }
}

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

private struct PlanFinishedSlot: View {
  @Environment(AppRouter.self) private var router
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

        ForEach(value.related) { course in
          Button {
            router.open(.course(courseId: course.courseId, title: course.title))
          } label: {
            Label(course.title, systemImage: "books.vertical")
              .font(.subheadline)
          }
          .buttonStyle(.borderless)
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
    switch await store.continueAtNextLevel(goalId: context.goal.id) {
    case .done(let started): failed = !started
    case .failed: failed = true
    case .obsolete: break
    }
    isStarting = false
  }
}

func planLevelName(_ level: String) -> String {
  switch level {
  case "overview": String(localized: "Overview", table: "Plan", comment: "A course level")
  case "beginner": String(localized: "Beginner", table: "Plan", comment: "A course level")
  case "intermediate": String(localized: "Intermediate", table: "Plan", comment: "A course level")
  default: String(localized: "Advanced", table: "Plan", comment: "A course level")
  }
}

/// A free exam plan's first week ended, on the Plan and Today.
struct FreeWeekOverNotice: View {
  var body: some View {
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
