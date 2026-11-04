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

    items += plan.examChoices.filter(\.subjects.isEmpty).map { .choice($0) }

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

/// An answer given in the suggestion slot and the editor that saved it. Its screen keeps it above
/// the panes a fold rebuilds, for its window alone, as main keeps it for one page.
struct PlanSlotAnswer {
  let key: PlanStore.SuggestionKey
  let item: PlanSlotItem
  let editor: PlanEditor
  /// When what it did stops showing; set once it first shows. Leaving the screen and coming back
  /// later finds it gone, as main's page does.
  var until: Date?

  var isOver: Bool { until.map { $0 <= .now } ?? false }
}

/// One thing at a time: "Not now" moves on to the next for as long as the app runs. An answer
/// that changes the plan says what it did, with Undo, for a moment, as main's slot does.
struct PlanSuggestionSection: View {
  private enum Focus: Hashable {
    case item
    case result
    case undo
  }

  private static let resultSeconds: TimeInterval = 8

  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @AccessibilityFocusState private var focus: Focus?
  @State private var isHovering = false

  let context: PlanContext
  @Binding var answer: PlanSlotAnswer?

  var body: some View {
    let state = store.suggestionState(goalId: context.goal.id)
    let items = PlanSlotItem.items(
      plan: context.plan, isPaused: context.isPaused, isExam: context.goal.kind == .exam
    ).filter { !state.dismissed.contains($0) }
    let answer = currentAnswer
    let applied: (change: AppliedPlanChange, sentence: String)? =
      if case .applied(let change, let sentence) = answer?.editor.latest, answer?.isOver == false {
        (change, sentence)
      } else {
        nil
      }

    if let item = applied == nil ? items.first : answer?.item {
      Section {
        // One row whichever shows, so a pointer resting on it stays on it.
        VStack(alignment: .leading, spacing: 8) {
          if let answer, let applied {
            result(answer, change: applied.change, sentence: applied.sentence)
          } else {
            slot(item)

            if answer?.item == item, answer?.editor.latest == nil, answer?.editor.failed == true {
              saveError
            }
          }
        }
        .padding(.vertical, 4)
        .onHover { isHovering = $0 }
        .task(id: applied?.change.id) {
          if let answer, applied != nil {
            await settle(answer)
          }
        }
      } footer: {
        if applied == nil, items.count > 1 {
          Text(
            "1 of \(items.count)", tableName: "Plan",
            comment: "The suggestion shown of the Plan's suggestions")
        }
      }
      .disabled(answer?.editor.isSaving == true)
      .onChange(of: applied?.change.id) { _, shown in
        // The control used leaves with the answer, so VoiceOver lands on what it did, and after
        // Undo on what shows next.
        if shown != nil {
          focus = .result
        } else if currentAnswer?.editor.latest == .undone {
          focus = .item
        }
      }
    }
  }

  /// Only the session and goal that gave it see it.
  private var currentAnswer: PlanSlotAnswer? {
    answer.flatMap { $0.key == store.suggestionKey(goalId: context.goal.id) ? $0 : nil }
  }

  @ViewBuilder
  private func result(
    _ answer: PlanSlotAnswer, change: AppliedPlanChange, sentence: String
  ) -> some View {
    // An exam choice keeps its question, as main's does.
    if case .choice(let choice) = answer.item {
      header(
        choiceTitle(choice), icon: Image(systemName: "list.bullet").foregroundStyle(.warning))
    } else {
      header(
        Text("Plan updated", tableName: "Plan", comment: "Title once a plan suggestion is applied"),
        icon: StatusMark(status: .done))
    }

    Text(sentence)
      .font(.subheadline)
      .accessibilityFocused($focus, equals: .result)

    if change.canUndo {
      ButtonRow {
        Button {
          Task {
            await answer.editor.undo()
            // A failed Undo gets the whole moment again, so there's time to try once more.
            extend(answer)
          }
        } label: {
          Text("Undo", tableName: "Plan", comment: "Undoes the latest plan change")
        }
        .accessibilityFocused($focus, equals: .undo)
      }
      .buttonStyle(.bordered)
    }

    if answer.editor.failed {
      saveError
    }
  }

  /// Clears the answer once its moment is over, later while the learner is on it or its Undo is
  /// saving.
  private func settle(_ shown: PlanSlotAnswer) async {
    if shown.until == nil {
      extend(shown)
    }

    while answer?.editor === shown.editor, let until = answer?.until {
      do {
        try await Task.sleep(for: .seconds(max(0, until.timeIntervalSinceNow)))
      } catch {
        return
      }

      if answer?.until != until {
        continue
      }

      if focus != nil || isHovering || shown.editor.isSaving {
        extend(shown)
      } else {
        answer = nil
      }
    }
  }

  private func extend(_ shown: PlanSlotAnswer) {
    if answer?.editor === shown.editor {
      answer?.until = .now.addingTimeInterval(Self.resultSeconds)
    }
  }

  private var saveError: some View {
    Text(
      "That didn't save. Try again.", tableName: "Plan",
      comment: "A plan suggestion's change or its Undo didn't save; trying again may work"
    )
    .font(.footnote)
    .foregroundStyle(.destructive)
  }

  @ViewBuilder
  private func slot(_ item: PlanSlotItem) -> some View {
    switch item {
    case .paused:
      PlanPausedSlot(context: context)
    case .choice(let choice) where choice.take > 1:
      card(
        title: choiceTitle(choice), systemImage: "list.bullet",
        description: Text(choice.leftOut.line),
        options: {
          Text.examPickLimit(choice.take)
            .font(.subheadline)
            .foregroundStyle(.secondary)

          ExamOptionToggles(
            options: choice.options, take: choice.take,
            picked: Binding(
              get: { draft(choice) },
              set: { names in
                store.setSuggestionState(store.suggestionKey(goalId: context.goal.id)) {
                  $0.choiceDrafts[choice.group] = names
                }
              }))
        },
        actions: {
          Button {
            choose(draft(choice), in: choice, item: item)
          } label: {
            Text(
              "Save", tableName: "Plan", comment: "Saves the options picked for an exam's choice")
          }
          .disabled(draft(choice).isEmpty)
        })
    case .choice(let choice):
      card(
        title: choiceTitle(choice), systemImage: "list.bullet",
        description: Text(choice.leftOut.line)
      ) {
        Menu {
          ForEach(choice.options, id: \.self) { option in
            Button(option.name) {
              choose([option.name], in: choice, item: item)
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

  private func choiceTitle(_ choice: GoalPlan.ExamChoice) -> Text {
    choice.take > 1
      ? Text(
        "\(choice.group): which ones will you take?", tableName: "Plan",
        comment:
          "Asks which options of an exam's choice, like the modules a course takes, the learner takes; they take several"
      )
      : Text(
        "\(choice.group): which one will you take?", tableName: "Plan",
        comment:
          "Asks which option of an exam's choice, like its foreign language, the learner takes")
  }

  private func fitTitle(_ offer: GoalPlan.FitOffer) -> Text {
    guard offer.fits, let covers = planCoversEverythingText(context.plan) else {
      return Text(
        "\(offer.effect.lessonsAdded) more lessons fit in your time", tableName: "Plan",
        comment: "Title of the offer that brings more lessons in")
    }

    return covers
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
            applyOffer(offer, item: item)
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
    @ViewBuilder options: () -> some View = { EmptyView() },
    @ViewBuilder actions: () -> some View
  ) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      header(title, icon: Image(systemName: systemImage).foregroundStyle(.warning))

      if let description {
        description
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      PlanEffectDiff(effect: effect, today: context.plan.today)

      options()

      ButtonRow {
        actions()
      }
      .buttonStyle(.bordered)
    }
  }

  private func header(_ title: Text, icon: some View) -> some View {
    Label {
      title.font(.headline)
    } icon: {
      icon
    }
    .accessibilityFocused($focus, equals: .item)
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

    return sentences.isEmpty ? nil : sentences.joinedSentences()
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

  private func draft(_ choice: GoalPlan.ExamChoice) -> [String] {
    store.suggestionState(goalId: context.goal.id).choiceDrafts[choice.group] ?? []
  }

  private func choose(_ subjects: [String], in choice: GoalPlan.ExamChoice, item: PlanSlotItem) {
    apply(item) { editor in
      await editor.chooseExamOptions(subjects, in: choice.group)
    } saved: {
      $0.choiceDrafts[choice.group] = nil
    }
  }

  /// Main words the change from its one operation, `fitLessons`.
  private func applyOffer(_ offer: GoalPlan.FitOffer, item: PlanSlotItem) {
    apply(item) { editor in
      await editor.change(
        offer.operations.map { .operation($0) },
        sentence: String(
          localized: "The lessons your time fits come into your plan.", table: "Plan",
          comment: "Says a plan change brought in the lessons the learner's study time fits"))
    }
  }

  /// A new editor for each answer, so the last answer's result never shows as this one's.
  private func apply(
    _ item: PlanSlotItem, _ write: @escaping (PlanEditor) async -> Bool,
    saved: @escaping (inout PlanStore.SuggestionState) -> Void = { _ in }
  ) {
    let key = store.suggestionKey(goalId: context.goal.id)
    let editor = PlanEditor(goalId: context.goal.id, store: store)
    answer = PlanSlotAnswer(key: key, item: item, editor: editor)

    Task {
      if await write(editor) {
        store.setSuggestionState(key, saved)
      }
    }
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
