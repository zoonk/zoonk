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
  @Environment(\.isPlanChangeCard) private var isPlanChange

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
    // Main's change to the plan is titled alone, its card saying what it is.
    if isPlanChange {
      title.typeStyle(.body.weight(.semibold))
    } else {
      Label {
        title.typeStyle(.body.weight(.semibold))
      } icon: {
        SuggestionMark(kind: mark)
      }
    }

    if let description {
      description
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }

    content
  }
}

extension EnvironmentValues {
  /// Main's `PlanChangeSuggestion`: a change to the plan's card, titled without a mark.
  @Entry var isPlanChangeCard = false
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
/// consequence and "All changes", "Change my plan" and "Not now".
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
      .mainActionUnlessBarHoldsOne()
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
    let result = await store.ask { api, token in
      try await api.preview(token: token, goalId: goalId, edits: edits)
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
/// (`examOverBar`), so it asks their question. The Schedule tile beside it says what's left.
struct PlanExamOverSlot: View {
  let context: PlanContext
  var isLine = false

  var body: some View {
    PlanStatement(
      mark: .symbol("calendar.badge.clock"), title: Text(planPastDateTitle(isExam: true)),
      description: Text(
        "Keep studying, or archive this goal?", tableName: "Plan",
        comment: "Under the Plan's notice once the exam's date passed: its bottom bar's question"),
      isLine: isLine)
  }
}

/// The end date passed with lessons left: it finds the end date that fits them.
struct PlanPastDateSlot: View {
  @Environment(PlanStore.self) private var store

  let context: PlanContext
  let actions: PlanSlotActions

  var body: some View {
    card
  }

  private var check: PlanSlotCheck {
    context.slotCheck(.pastDate)
  }

  @ViewBuilder private var card: some View {
    let lessons = context.plan.status?.lessons ?? 0

    if let asked = check.asked {
      PlanSlotAskedCard(asked: asked, context: context, actions: actions)
    } else {
      PlanSlotCard(
        title: Text(planPastDateTitle(isExam: false)), mark: .symbol("calendar.badge.clock"),
        description: Text(description(lessons: lessons))
      ) {
        if check.failed {
          FailureLine(
            message: LocalizedStringResource(
              "We couldn't check what changes.", table: "Plan",
              comment: "A change's preview failed to load")
          )
          .typeStyle(.note)
        }
      } actions: {
        if check.noDate {
          Button(action: actions.notNow) {
            Text("Not now", tableName: "Plan", comment: "Puts a suggestion off")
          }

          Button {
            context.adjust(.top)
          } label: {
            Text(
              "Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
          }
          .mainActionUnlessBarHoldsOne()
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

          BusyButton(isBusy: check.isWorking) {
            check.run { await findDate() }
          } label: {
            Text(
              "Find a date", tableName: "Plan",
              comment: "Works out the later end date that fits the lessons left")
          }
          .mainActionUnlessBarHoldsOne()
        }
      }
    }
  }

  private func description(lessons: Int) -> String {
    check.noDate
      ? String(
        localized: "No date fits all your lessons.", table: "Plan",
        comment: "No later end date fits the lessons left")
      : String(
        localized: "You have \(lessons) lessons left. A later end date fits them.", table: "Plan",
        comment: "Lessons left once the goal's end date passed")
  }

  private func findDate() async {
    let check = check
    check.isWorking = true
    defer { check.isWorking = false }
    check.failed = false

    let time = store.timeToCover(goalId: context.goal.id)
    await time.load()

    guard !Task.isCancelled else {
      return
    }

    guard let time = time.freshValue else {
      check.failed = true
      return
    }

    guard let date = time.fittingDate else {
      check.noDate = true
      return
    }

    let asked = await context.ask([.targetDate(date)], store: store)

    guard !Task.isCancelled else {
      return
    }

    check.asked = asked
    check.failed = asked == nil
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

/// Main's suggested time card, while the learner studies less than the plan suggests: "See what
/// changes" previews that time, and the next tap applies it.
struct PlanCoverageSlot: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store

  let context: PlanContext
  let suggested: TimeToCover.Suggested
  let actions: PlanSlotActions

  private var check: PlanSlotCheck {
    context.slotCheck(.coverage)
  }

  var body: some View {
    if let asked = check.asked {
      PlanSlotAskedCard(asked: asked, context: context, actions: actions)
    } else {
      PlanSlotCard(
        title: Text(Self.title(suggested)), mark: .sparkle, description: Text(description)
      ) {
        if check.failed {
          FailureLine(
            message: LocalizedStringResource(
              "We couldn't check what changes.", table: "Plan",
              comment: "A change's preview failed to load")
          )
          .typeStyle(.note)
        }
      } actions: {
        otherOptions

        BusyButton(isBusy: check.isWorking) {
          check.run { await seeChanges() }
        } label: {
          Text(
            "See what changes", tableName: "Plan",
            comment: "Shows what the suggested time a day changes in the plan, before it applies")
        }
        .mainActionUnlessBarHoldsOne()
      }
    }
  }

  static func title(_ suggested: TimeToCover.Suggested) -> String {
    String(
      localized: "We suggest \(planDurationText(minutes: Double(suggested.minutes))) a day",
      table: "Plan",
      comment: "The title of a suggestion to change the daily study time. {time} is like \"4 h\"."
    )
  }

  /// What the suggested time gets the learner: everything by the date, or what matters most first.
  private var description: String {
    let exam = context.goal.kind == .exam
    let schedule = context.plan.schedule

    guard suggested.kind == .everything, let targetDate = schedule.targetDate else {
      return exam
        ? String(localized: "Your plan starts with what matters most for your exam.", table: "Plan")
        : String(localized: "Your plan starts with what matters most for your goal.", table: "Plan")
    }

    let date = PlanDate.longText(targetDate, month: schedule.targetDateNamedMonth)

    return exam
      ? String(
        localized: "That's enough to be ready for your exam by \(date).", table: "Plan",
        comment:
          "Under \"We suggest {time} a day\": that time covers the whole exam by its date. In the month form, {date} is a month, like \"May 2027\"; otherwise a day, like \"May 5\"."
      )
      : String(
        localized: "That's enough to reach your goal by \(date).", table: "Plan",
        comment:
          "Under \"We suggest {time} a day\": that time covers the whole goal by its date. In the month form, {date} is a month, like \"May 2027\"; otherwise a day, like \"May 5\"."
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
        Text("The Focus test shows what to study most.", tableName: "Today")
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }

      if !context.plan.schedule.fullCourse {
        Button {
          context.adjust(.everything)
        } label: {
          isExam
            ? Text(
              "Keep studying after the exam", tableName: "Plan",
              comment: "Opens studying what's left after the exam")
            : Text("Remove end date", tableName: "Plan")
        }
      }

      Button(action: actions.notNow) {
        Text("Not now", tableName: "Plan", comment: "Puts a suggestion off")
      }
    }
  }

  private func seeChanges() async {
    let check = check
    check.isWorking = true
    defer { check.isWorking = false }

    let asked = await context.ask([.dailyMinutes(suggested.minutes)], store: store)

    guard !Task.isCancelled else {
      return
    }

    check.asked = asked
    check.failed = asked == nil
  }
}

/// Main's fit offer: more lessons fit the learner's time. The tap checks today's numbers: the
/// same ones apply, other ones show with "Your plan changed since you saw this. Here's what it does now." and the next tap
/// applies them.
struct PlanFitSlot: View {
  @Environment(PlanStore.self) private var store

  let context: PlanContext
  let offer: GoalPlan.FitOffer
  let title: Text
  let actions: PlanSlotActions

  private var check: PlanSlotCheck {
    context.slotCheck(.fitLessons)
  }

  var body: some View {
    let repriced = check.repriced?.preview
    let unchanged = repriced?.unchanged == true

    PlanSlotCard(title: title, mark: .sparkle, description: nil) {
      PlanEffectDiff(
        effect: unchanged ? nil : repriced?.effect ?? offer.effect, today: context.plan.today,
        options: context.changeOptions, repriced: repriced != nil, saysLessonsAdded: true)

      if check.failed {
        SuggestionSaveError()
      }
    } actions: {
      Button(action: actions.notNow) {
        Text("Not now", tableName: "Plan", comment: "Puts a suggestion off")
      }

      if !unchanged {
        BusyButton(isBusy: check.isWorking) {
          check.run { await add() }
        } label: {
          Text(
            "Add to plan", tableName: "Plan",
            comment: "Brings into the plan the lessons the learner's time fits")
        }
        .mainActionUnlessBarHoldsOne()
      }
    }
  }

  private func add() async {
    let check = check

    if let repriced = check.repriced {
      actions.apply(repriced.edits)
      return
    }

    check.isWorking = true
    defer { check.isWorking = false }
    check.failed = false

    let landing: ([PlanEdit]) -> Void = { [actions] edits in check.land { actions.apply(edits) } }

    switch await store.addFitOffer(offer, goalId: context.goal.id, apply: landing) {
    case .repriced(let repriced): check.repriced = repriced
    case .failed: check.failed = true
    case .applied, nil: break
    }
  }
}

/// What "Add to plan" found.
enum FitOfferCheck: Equatable {
  /// Today's numbers are the offer's, so its edits were applied.
  case applied
  /// Other numbers, shown before the next tap applies them.
  case repriced(PlanSlotRepriced)
  case failed
}

extension PlanStore {
  /// Checks the offer against today's numbers and applies its edits when they're the same. Nil when
  /// the check was canceled, as a dismissed suggestion's is: then nothing is applied.
  func addFitOffer(
    _ offer: GoalPlan.FitOffer, goalId: String, apply: ([PlanEdit]) -> Void
  ) async -> FitOfferCheck? {
    let edits = offer.operations.map { PlanEdit.operation($0) }
    let result = await ask { api, token in
      try await api.preview(token: token, goalId: goalId, edits: edits)
    }

    switch result {
    case .done(let preview?) where !preview.unchanged && preview.effect == offer.effect:
      apply(edits)
      return .applied
    case .done(let preview?):
      return .repriced(PlanSlotRepriced(edits: edits, preview: preview))
    case .done(nil), .failed:
      return .failed
    case .obsolete:
      return nil
    }
  }
}

extension PlanContext {
  /// What `item`'s card asks for (its offer's check, its certificate claim, the next level), kept
  /// for the opening shown now.
  func slotCheck(_ item: PlanSlotItem, request: PlanSlotChecks.Request = .offer) -> PlanSlotCheck {
    slotChecks.check(item, request: request, goalId: goal.id, opening: slotOpening?())
  }
}

/// What the Plan's suggestions asked for and what they found, kept by the Plan above its panes: a
/// card is drawn again as the Plan splits into panes or joins them, and its check goes on and shows
/// there, or in the sheet the line opens. Each belongs to an opening of its suggestion
/// (`SuggestionOpening`); the Plan calls `leave()` whenever the opening changes, whatever changed
/// it, and as it closes. What an opening asked for lands only while it's still the one shown
/// (`PlanSlotCheck.land`), and the next opening starts clean.
@MainActor
@Observable
final class PlanSlotChecks {
  enum Request: Hashable {
    case offer
    case claim
    case nextLevel
  }

  private struct Key: Hashable {
    let visit: Int
    let goalId: String
    let item: PlanSlotItem
    let request: Request
  }

  private struct Kept {
    let opening: SuggestionOpening?
    let check: PlanSlotCheck
  }

  private var visit = 0
  @ObservationIgnored private var checks: [Key: Kept] = [:]

  func check(
    _ item: PlanSlotItem, request: Request, goalId: String, opening: SuggestionOpening? = nil
  ) -> PlanSlotCheck {
    let key = Key(visit: visit, goalId: goalId, item: item, request: request)
    if let kept = checks[key], kept.opening == opening { return kept.check }
    checks[key]?.check.leave()
    let check = PlanSlotCheck()
    checks[key] = Kept(opening: opening, check: check)
    return check
  }

  /// A newly drawn suggestion can act before the old opening's onChange runs.
  func leave(except opening: SuggestionOpening? = nil) {
    if opening == nil { visit += 1 }
    for (key, kept) in checks where opening == nil || kept.opening != opening {
      kept.check.leave()
      checks[key] = nil
    }
  }
}

/// The fit offer's numbers today, when they aren't the offer's, with the edits they're for: the
/// next tap applies those edits.
struct PlanSlotRepriced: Equatable {
  let edits: [PlanEdit]
  let preview: PlanChangePreview
}

@MainActor
@Observable
final class PlanSlotCheck {
  /// The change a tap worked out, asked before it applies.
  var asked: PlanSlotAskedChange?
  /// The fit offer's numbers today, when they aren't the offer's.
  var repriced: PlanSlotRepriced?
  var isWorking = false
  var failed = false
  var noDate = false
  @ObservationIgnored private let tasks = ScreenTasks()
  @ObservationIgnored private var isShown = true

  fileprivate init() {}

  func run(_ work: @escaping @MainActor () async -> Void) {
    tasks.run(work)
  }

  /// What an answer does outside its card (adding lessons, opening what a claim earned), only while
  /// the opening that asked is still the one shown.
  func land(_ effect: () -> Void) {
    if isShown {
      effect()
    }
  }

  fileprivate func leave() {
    isShown = false
    tasks.cancel()
    isWorking = false
  }
}
