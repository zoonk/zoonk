import SwiftUI

/// What a suggestion's answers do in the slot: `apply` saves edits and shows what they did with
/// Undo; `notNow` puts the suggestion off.
struct PlanSlotActions {
  let apply: ([PlanEdit]) -> Void
  let notNow: () -> Void
}

/// A suggestion's card: its mark and title, at most one line under it, what it holds, then its
/// buttons in one row, the main one last. In the suggestion's sheet its buttons are the sheet's
/// bottom bar.
struct PlanSlotCard<Content: View, Actions: View>: View {
  @Environment(\.isInSuggestionSheet) private var isInSheet
  @Environment(\.suggestionSheetNote) private var sheetNote

  let title: Text
  let mark: SuggestionMark.Kind
  let description: Text?
  let content: Content
  let actions: Actions

  init(
    title: Text, mark: SuggestionMark.Kind, description: Text?,
    @ViewBuilder content: () -> Content, @ViewBuilder actions: () -> Actions
  ) {
    self.title = title
    self.mark = mark
    self.description = description
    self.content = content()
    self.actions = actions()
  }

  var body: some View {
    if isInSheet {
      SuggestionSheetBody(note: sheetNote) {
        words
      } actions: {
        Group {
          actions
        }
        .buttonStyle(.outline)
      }
    } else {
      VStack(alignment: .leading, spacing: 8) {
        words

        ButtonRow {
          actions
        }
        .buttonStyle(.outline)
      }
    }
  }

  @ViewBuilder private var words: some View {
    Label {
      title.typeStyle(.body.weight(.semibold))
    } icon: {
      SuggestionMark(kind: mark)
    }

    if let description {
      description
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }

    content
  }
}

extension PlanSlotCard where Content == EmptyView {
  init(
    title: Text, mark: SuggestionMark.Kind, description: Text?,
    @ViewBuilder actions: () -> Actions
  ) {
    self.init(title: title, mark: mark, description: description) {
      EmptyView()
    } actions: {
      actions()
    }
  }
}

/// A change a suggestion's tap worked out, asked with main's anatomy: the question, its
/// consequence and "See all changes", "Change my plan" and "Not now".
struct PlanSlotAskedChange: Equatable {
  let edits: [PlanEdit]
  let question: String
  let effect: PlanEffect?
}

private struct PlanSlotAskedCard: View {
  let asked: PlanSlotAskedChange
  let context: PlanContext
  let actions: PlanSlotActions

  var body: some View {
    PlanSlotCard(title: Text(asked.question), mark: .sparkle, description: nil) {
      PlanEffectDiff(
        effect: asked.effect, today: context.plan.today, options: context.changeOptions)
    } actions: {
      Button(action: actions.notNow) {
        Text("Not now", tableName: "Plan", comment: "Puts a suggestion off")
      }

      Button {
        actions.apply(asked.edits)
      } label: {
        Text("Change my plan", tableName: "Plan", comment: "Applies a proposed plan change")
      }
      .buttonStyle(.mainAction)
    }
  }
}

extension PlanContext {
  var changeOptions: PlanChangeOptions {
    PlanChangeOptions(
      byDate: plan.schedule.targetDate != nil,
      dateKind: GoalDateKind(isExam: goal.kind == .exam))
  }

  /// What `edits` would do, asked as a question; nil when it couldn't be worked out.
  @MainActor
  func ask(_ edits: [PlanEdit], store: PlanStore) async -> PlanSlotAskedChange? {
    let goalId = goal.id
    let result = await store.write { api, token in
      try await api.preview(token: token, goalId: goalId, edits: edits)
    } changed: { _ in
      false
    }

    guard case .done(let preview?) = result, case .changes = PlanPreviewState(preview) else {
      return nil
    }

    let operations = edits.compactMap { try? PracticeJSON.recode($0, as: PlanChangeOperation.self) }
    let question =
      operations.count == 1
      ? operations.first.flatMap { PlanChangeWords.question($0, dateKind: changeOptions.dateKind) }
      : nil

    return PlanSlotAskedChange(
      edits: edits,
      question: question
        ?? String(
          localized: "Change your plan?", table: "Plan",
          comment: "Title of a plan change that makes several changes at once"),
      effect: preview.effect)
  }
}

func planPastDateTitle(isExam: Bool) -> String {
  isExam
    ? String(
      localized: "Your exam date has passed", table: "Plan",
      comment: "Title of the Plan's notice once the exam's date passed with lessons left")
    : String(
      localized: "Your end date has passed", table: "Plan",
      comment: "Title of the Plan's notice once the goal's end date passed with lessons left")
}

/// An exam whose date passed with lessons left: its answers are the Plan's bottom bar
/// (`examOverBar`), so it only says what's left.
struct PlanExamOverSlot: View {
  let context: PlanContext
  var isLine = false

  var body: some View {
    let lessons = context.plan.status?.lessons ?? 0

    PlanStatement(
      mark: .symbol("calendar.badge.clock"), title: Text(planPastDateTitle(isExam: true)),
      description: Text(
        "You have \(lessons) lessons left. Keep studying them, or archive this goal?",
        tableName: "Plan", comment: "Lessons left once the exam's date passed, and the question"),
      isLine: isLine)
  }
}

/// The end date passed with lessons left: it finds the end date that fits them.
struct PlanPastDateSlot: View {
  @Environment(PlanStore.self) private var store
  @State private var asked: PlanSlotAskedChange?
  @State private var isWorking = false
  @State private var failed = false
  @State private var noDate = false

  let context: PlanContext
  let actions: PlanSlotActions

  var body: some View {
    let lessons = context.plan.status?.lessons ?? 0

    if let asked {
      PlanSlotAskedCard(asked: asked, context: context, actions: actions)
    } else {
      PlanSlotCard(
        title: Text(planPastDateTitle(isExam: false)), mark: .symbol("calendar.badge.clock"),
        description: Text(description(lessons: lessons))
      ) {
        if failed {
          FailureLine(
            message: LocalizedStringResource(
              "We couldn't check what changes.", table: "Plan",
              comment: "A change's preview failed to load")
          )
          .typeStyle(.note)
        }
      } actions: {
        if noDate {
          Button(action: actions.notNow) {
            Text("Not now", tableName: "Plan", comment: "Puts a suggestion off")
          }

          Button {
            context.adjust(.top)
          } label: {
            Text(
              "Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
          }
          .buttonStyle(.mainAction)
        } else {
          PlanOtherOptions {
            Button {
              context.adjust(.top)
            } label: {
              Text(
                "Adjust plan", tableName: "Plan",
                comment: "Opens the plan's settings to change them")
            }

            Button(action: actions.notNow) {
              Text("Not now", tableName: "Plan", comment: "Puts a suggestion off")
            }
          }

          BusyButton(isBusy: isWorking) {
            Task { await findDate() }
          } label: {
            Text(
              "Find a date", tableName: "Plan",
              comment: "Works out the later end date that fits the lessons left")
          }
          .buttonStyle(.mainAction)
        }
      }
    }
  }

  private func description(lessons: Int) -> String {
    noDate
      ? String(
        localized: "No date fits all your lessons.", table: "Plan",
        comment: "No later end date fits the lessons left")
      : String(
        localized: "You have \(lessons) lessons left. A later end date fits them.", table: "Plan",
        comment: "Lessons left once the goal's end date passed")
  }

  private func findDate() async {
    isWorking = true
    defer { isWorking = false }
    failed = false

    let goalId = context.goal.id
    let found = await store.write { api, token in
      try await api.timeToCover(token: token, goalId: goalId)
    } changed: { _ in
      false
    }

    guard case .done(let time) = found else {
      failed = true
      return
    }

    guard let date = time.fittingDate else {
      noDate = true
      return
    }

    asked = await context.ask([.targetDate(date)], store: store)
    failed = asked == nil
  }

}

/// "Other options": a menu that opens under its own trigger, never over the button beside it.
struct PlanOtherOptions<Items: View>: View {
  @ViewBuilder let items: () -> Items

  var body: some View {
    Menu {
      items()
    } label: {
      Text("Other options", tableName: "Plan", comment: "Opens a suggestion's other answers")
    }
  }
}

/// Main's coverage sheet: it names the time that covers everything itself. Opened from the line's
/// "View", it asks at once; beside the page it asks when "See what changes" is pressed, since
/// finding the time plans the goal many times.
struct PlanCoverageSlot: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @State private var found: Found?
  @State private var asked: PlanSlotAskedChange?
  @State private var isPreviewing = false
  @State private var previewFailed = false

  let context: PlanContext
  let title: String
  let asksAtOnce: Bool
  let actions: PlanSlotActions

  private enum Found: Equatable {
    case asking
    case failed
    case time(TimeToCover)
  }

  var body: some View {
    if let asked {
      PlanSlotAskedCard(asked: asked, context: context, actions: actions)
    } else {
      let offer = offerMinutes

      PlanSlotCard(title: Text(heading), mark: .sparkle, description: line.map(Text.init)) {
        if previewFailed {
          FailureLine(
            message: LocalizedStringResource(
              "We couldn't check what changes.", table: "Plan",
              comment: "A change's preview failed to load")
          )
          .typeStyle(.note)
        }
      } actions: {
        otherOptions

        if found == .failed {
          Button {
            Task { await find() }
          } label: {
            Text("Try again", tableName: "Plan", comment: "Asks again after it failed")
          }
          .buttonStyle(.mainAction)
        } else if case .time? = found, offer == nil {
          if context.goal.kind == .exam, !context.plan.schedule.fullCourse {
            Button {
              context.adjust(.everything)
            } label: {
              Text(
                "Keep studying after the exam", tableName: "Plan",
                comment: "Opens studying what's left after the exam")
            }
            .buttonStyle(.mainAction)
          }
        } else {
          BusyButton(isBusy: found == .asking || isPreviewing) {
            Task { await seeChanges() }
          } label: {
            Text(
              "See what changes", tableName: "Plan",
              comment: "Works out the time that covers everything and shows what it changes")
          }
          .buttonStyle(.mainAction)
        }
      }
      .task {
        if asksAtOnce, found == nil {
          await find()
        }
      }
    }
  }

  private var suggested: TimeToCover.Suggested? {
    guard case .time(let time)? = found else {
      return nil
    }

    return time.suggested
  }

  /// The time worth offering: one the learner doesn't study already.
  private var offerMinutes: Int? {
    guard let suggested, suggested.minutes != context.plan.schedule.dailyMinutes else {
      return nil
    }

    return suggested.minutes
  }

  private var heading: String {
    guard let suggested, offerMinutes != nil else {
      return title
    }

    let time = planDurationText(minutes: Double(suggested.minutes))

    return suggested.kind == .everything
      ? String(
        localized: "\(time) a day covers everything", table: "Plan",
        comment: "The time a day that covers the whole goal; the argument is a duration")
      : String(
        localized: "We suggest \(time) a day", table: "Plan",
        comment:
          "The time a day worth most, when none covers everything; the argument is a duration"
      )
  }

  private var line: String? {
    switch found {
    case .asking?:
      return String(
        localized: "Finding the time that covers everything…", table: "Plan",
        comment: "While the time a day that covers everything is worked out")
    case .failed?:
      return String(
        localized: "We couldn't work out the time needed.", table: "Plan",
        comment: "The time a day that covers everything couldn't be worked out")
    case .time(let time)?:
      if let suggested, offerMinutes != nil {
        return suggested.kind == .everything
          ? title
          : planCoverageLine(
            minutes: suggested.minutes, share: suggested.coveredShare,
            exam: context.plan.feasibility?.measure == "exam")
      }

      return nothingToOffer(time)
    case nil:
      return nil
    }
  }

  private func nothingToOffer(_ time: TimeToCover) -> String {
    if let minutes = time.recommendedMinutes {
      return String(
        localized:
          "Covering everything takes about \(planDurationText(minutes: Double(minutes))) a day.",
        table: "Plan",
        comment: "The time a day that would cover everything; the argument is a duration"
      )
    }

    if let most = time.most {
      return String(
        localized:
          "The most any time covers is about \(most.coveredShare.formatted(.percent.precision(.fractionLength(0)))), at \(planDurationText(minutes: Double(most.minutes))) a day.",
        table: "Plan",
        comment: "No time a day covers everything: the most any covers, and at what time a day")
    }

    let date = context.plan.schedule.targetDate.map {
      PlanDate.longDay($0, today: context.plan.today)
    }

    return String(
      localized: "No time a day covers everything by \(date ?? "").", table: "Plan",
      comment:
        "No time a day covers the whole goal by its date; the argument is a day like \"May 5\""
    )
  }

  private var otherOptions: some View {
    let isExam = context.goal.kind == .exam
    let areas = context.plan.areas.filter { !$0.skipped && $0.partOf == nil }

    return PlanOtherOptions {
      if !isExam {
        Button {
          context.adjust(.date)
        } label: {
          Text(
            "Move your date to cover everything", tableName: "Plan",
            comment: "Opens the goal's date to move it later")
        }
      }

      if areas.count > 1 {
        Button {
          context.adjust(.focus)
        } label: {
          Text(
            "Choose where to focus", tableName: "Plan",
            comment: "Opens the choice of the subjects that get more time")
        }
      }

      if context.plan.focusTest?.notStartedOffer != nil {
        Button {
          router.open(.focusTest(goalId: context.goal.id))
        } label: {
          Text(FocusTestCopy.takeTest)
        }
      }

      if !context.plan.schedule.fullCourse {
        Button {
          context.adjust(.everything)
        } label: {
          isExam
            ? Text(
              "Keep studying after the exam", tableName: "Plan",
              comment: "Opens studying what's left after the exam")
            : Text(
              "Study everything", tableName: "Plan",
              comment: "Opens studying the whole goal with no end date")
        }
      }

      Button(action: actions.notNow) {
        Text("Not now", tableName: "Plan", comment: "Puts a suggestion off")
      }
    }
  }

  private func find() async {
    found = .asking

    let goalId = context.goal.id
    let result = await store.write { api, token in
      try await api.timeToCover(token: token, goalId: goalId)
    } changed: { _ in
      false
    }

    switch result {
    case .done(let time) where time.ready: found = .time(time)
    case .done, .failed: found = .failed
    case .obsolete: found = nil
    }
  }

  private func seeChanges() async {
    if found == nil {
      await find()
    }

    guard let minutes = offerMinutes else {
      return
    }

    isPreviewing = true
    defer { isPreviewing = false }

    asked = await context.ask([.dailyMinutes(minutes)], store: store)
    previewFailed = asked == nil
  }
}

/// Main's fit offer: more lessons fit the learner's time. The tap checks today's numbers: the
/// same ones apply, other ones show with "The numbers are different today." and the next tap
/// applies them.
struct PlanFitSlot: View {
  @Environment(PlanStore.self) private var store
  @State private var repriced: PlanChangePreview?
  @State private var isChecking = false
  @State private var failed = false

  let context: PlanContext
  let offer: GoalPlan.FitOffer
  let title: Text
  let actions: PlanSlotActions

  var body: some View {
    let unchanged = repriced?.unchanged == true

    PlanSlotCard(title: title, mark: .sparkle, description: nil) {
      PlanEffectDiff(
        effect: unchanged ? nil : repriced?.effect ?? offer.effect, today: context.plan.today,
        options: context.changeOptions, repriced: repriced != nil, saysLessonsAdded: true)

      if failed {
        SuggestionSaveError()
      }
    } actions: {
      Button(action: actions.notNow) {
        Text("Not now", tableName: "Plan", comment: "Puts a suggestion off")
      }

      if !unchanged {
        BusyButton(isBusy: isChecking) {
          Task { await add() }
        } label: {
          Text(
            "Add to my plan", tableName: "Plan",
            comment: "Brings into the plan the lessons the learner's time fits")
        }
        .buttonStyle(.mainAction)
      }
    }
  }

  private func add() async {
    let edits = offer.operations.map { PlanEdit.operation($0) }

    guard repriced == nil else {
      actions.apply(edits)
      return
    }

    isChecking = true
    defer { isChecking = false }
    failed = false

    let goalId = context.goal.id
    let result = await store.write { api, token in
      try await api.preview(token: token, goalId: goalId, edits: edits)
    } changed: { _ in
      false
    }

    guard case .done(let preview?) = result else {
      failed = true
      return
    }

    if !preview.unchanged, preview.effect == offer.effect {
      actions.apply(edits)
    } else {
      repriced = preview
    }
  }
}

/// "{time} a day covers about {share} of your exam topics".
func planCoverageLine(minutes: Int, share: Double, exam: Bool) -> String {
  let time = planDurationText(minutes: Double(minutes))
  let percent = share.formatted(.percent.precision(.fractionLength(0)))

  return exam
    ? String(
      localized: "\(time) a day covers about \(percent) of your exam topics", table: "Plan",
      comment: "The share of an exam's topics a time a day covers; the first argument is a duration"
    )
    : String(
      localized: "\(time) a day covers about \(percent) of your goal", table: "Plan",
      comment: "The share of a goal a time a day covers; the first argument is a duration")
}
