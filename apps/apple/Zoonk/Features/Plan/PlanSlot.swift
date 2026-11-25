import SwiftUI

/// The most pressing first, in main's order. Being behind is the Schedule tile's, not a
/// suggestion: there's nothing to answer.
enum PlanSlotItem: Hashable {
  case choice(GoalPlan.ExamChoice)
  case courseComplete
  case coverage
  /// The exam's optional study, such as its strategy, which fits beside everything it tests.
  case extraLessons
  case finished
  case fitLessons
  case pastDate
  case tooTight

  /// `courseComplete` while a finished part's certificate isn't written yet.
  static func items(
    plan: GoalPlan, courseComplete: Bool
  ) -> [PlanSlotItem] {
    let status = plan.status?.kind
    let finished = plan.end != nil
    let open = status != .pastDate
    let timeItems: [PlanSlotItem] = [
      open && plan.fitOffer != nil ? .fitLessons : nil,
      open && plan.extraOffer != nil ? .extraLessons : nil,
      open && plan.suggestedTime != nil ? .coverage : nil,
    ].compactMap(\.self)

    var items: [PlanSlotItem] = !finished && courseComplete ? [.courseComplete] : []

    // A passed date is what the page asks about first (the bar answers it on an exam). A paused goal's
    // Schedule says so, and its bar resumes it.
    if status == .pastDate {
      items.append(.pastDate)
    }

    items += plan.examChoices.filter(\.subjects.isEmpty).map { .choice($0) }

    if finished {
      items += timeItems
      items.append(.finished)
    }

    if status == .needsAdjusting {
      items.append(.tooTight)
    }

    if !finished {
      items += timeItems
    }

    return items
  }
}

extension PlanContext {
  /// The suggestions the plan offers now, without those put off, and the one paged to.
  func suggestions(in store: PlanStore) -> (items: [PlanSlotItem], index: Int, shown: PlanSlotItem?)
  {
    let state = store.suggestionState(goalId: goal.id)
    let unclaimed =
      goal.kind == .exam ? store.planEnd(goalId: goal.id).value?.certificates?.unclaimed ?? [] : []
    let items = PlanSlotItem.items(plan: plan, courseComplete: !unclaimed.isEmpty)
      .filter { !state.dismissed.contains($0) }

    let index = min(state.position, max(items.count - 1, 0))
    return (items, index, items.indices.contains(index) ? items[index] : nil)
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

private struct PlanChangePanel: ViewModifier {
  let isShown: Bool

  func body(content: Content) -> some View {
    if isShown {
      content
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .panel()
    } else {
      content
    }
  }
}

/// One thing at a time, with "{count} more" bringing up the next, as main's slot does: "Not now"
/// puts one off for as long as the app runs.
/// An answer that changes the plan says what it did, with Undo, for a moment. A change to the plan
/// (its coverage, an offer, a date that passed) is the whole card at every width, as main's; any other in the
/// page's column is main's suggestion line, its summary with its own action or "View" opening the
/// whole suggestion in a sheet, which the screen presents (`sheetItem`); beside the page (`isInline`) it's the whole
/// suggestion.
struct PlanSuggestionSection: View {
  private enum Focus: Hashable {
    case item
    case result
    case undo
  }

  private static let resultSeconds: TimeInterval = 8

  @Environment(PlanStore.self) private var store
  @Environment(\.dismiss) private var dismiss
  @AccessibilityFocusState private var focus: Focus?
  @State private var isHovering = false

  let context: PlanContext
  @Binding var answer: PlanSlotAnswer?
  var isInline = false
  /// The suggestion the screen's sheet shows in full.
  var sheetItem: PlanSlotItem?

  var body: some View {
    if let sheetItem {
      sheet(sheetItem)
    } else {
      section
    }
  }

  /// What the slot shows: its suggestions, the one paged to, and what an answer just did.
  private var shown:
    (items: [PlanSlotItem], index: Int, applied: (change: AppliedPlanChange, sentence: String)?)
  {
    let (items, index, _) = context.suggestions(in: store)
    let answer = currentAnswer
    let applied: (change: AppliedPlanChange, sentence: String)? =
      if case .applied(let change, let sentence) = answer?.editor.latest, answer?.isOver == false {
        (change, sentence)
      } else {
        nil
      }

    return (items, index, applied)
  }

  /// The sheet closes once its suggestion stops showing: answered, put off or paged past.
  private func sheet(_ item: PlanSlotItem) -> some View {
    let shown = shown
    let isShowing =
      shown.applied == nil && shown.items.indices.contains(shown.index)
      && shown.items[shown.index] == item

    return Group {
      if isShowing {
        slot(item)
          .environment(
            \.suggestionSheetNote, failed(item) ? BarNote(SuggestionSaveError.message) : nil)
      }
    }
    .disabled(currentAnswer?.editor.isSaving == true)
    .onChange(of: isShowing, initial: true) { _, isShowing in
      if !isShowing {
        dismiss()
      }
    }
  }

  @ViewBuilder
  private var section: some View {
    let (items, index, applied) = shown
    let answer = currentAnswer
    let paged = items.indices.contains(index) ? items[index] : nil

    if let item = applied == nil ? paged : answer?.item {
      PageSection {
        // One row whichever shows, so a pointer resting on it stays on it.
        VStack(alignment: .leading, spacing: 8) {
          if let answer, let applied {
            if isInline || isPlanChange(answer.item) {
              result(answer, change: applied.change, sentence: applied.sentence)
            } else {
              resultLine(answer, change: applied.change, sentence: applied.sentence)
            }
          } else if isInline || isPlanChange(item) {
            slot(item)
            answerFailure(item)
          } else if isStatement(item) {
            slot(item)
              .accessibilityFocused($focus, equals: .item)
          } else {
            let summary = summary(item)

            SuggestionLine {
              SuggestionMark(kind: summary.mark)
            } summary: {
              Group {
                // A claim that didn't save says so in the line's words, as main's does.
                if claimFailed(item) {
                  SuggestionSaveError()
                } else {
                  summary.text
                }
              }
              .accessibilityFocused($focus, equals: .item)
            } action: {
              lineAction(item)
            }
          }
        }
        .padding(.vertical, isInline ? 4 : 0)
        // A change to the plan is main's card on its panel, in the page's column and beside it.
        .modifier(PlanChangePanel(isShown: isPlanChange(item)))
        // Beside the page a card's actions sit beside its words, so they're small, as main's
        // panel draws them; the sheet a line opens draws them large.
        .controlSize(isInline ? .small : .regular)
        .listRowSeparator(.hidden)
        .onHover { isHovering = $0 }
        .task(id: applied?.change.id) {
          if let answer, applied != nil {
            await settle(answer)
          }
        }
      } header: {
        // Beside the page it heads the card, so paging to a taller or shorter one never moves it
        // under the finger; under the line in the column, as main's is.
        if isInline {
          pager(index: index, count: items.count, isHidden: applied != nil)
        }
      } footer: {
        if !isInline {
          pager(index: index, count: items.count, isHidden: applied != nil)
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
      SuggestionHeader(Text.examChoiceQuestion(group: choice.group, take: choice.take))
        .accessibilityFocused($focus, equals: .item)
    } else {
      SuggestionHeader(
        Text("Plan updated", tableName: "Plan", comment: "Title once a plan suggestion is applied")
      )
      .accessibilityFocused($focus, equals: .item)
    }

    SuggestionResult(text: sentence)
      .accessibilityFocused($focus, equals: .result)

    if change.canUndo {
      ButtonRow {
        undoButton(answer)
      }
      .buttonStyle(.outline)
    }

    if answer.editor.failed {
      SuggestionSaveError()
    }
  }

  /// Main's answered line: the done mark, what the change did, and Undo.
  @ViewBuilder
  private func resultLine(
    _ answer: PlanSlotAnswer, change: AppliedPlanChange, sentence: String
  ) -> some View {
    SuggestionLine {
      StatusMark(status: .done)
    } summary: {
      SuggestionResult(text: sentence)
        .accessibilityFocused($focus, equals: .result)
    } action: {
      if change.canUndo {
        undoButton(answer)
          .buttonStyle(.outline)
          .controlSize(.small)
      }
    }

    if answer.editor.failed {
      SuggestionSaveError()
    }
  }

  private func undoButton(_ answer: PlanSlotAnswer) -> some View {
    BusyButton(isBusy: answer.editor.isSaving, icon: .undo) {
      answer.editor.run {
        await answer.editor.undo()
        // A failed Undo gets the whole moment again, so there's time to try once more.
        extend(answer)
      }
    } label: {
      Text("Undo", tableName: "Plan", comment: "Undoes the latest plan change")
    }
    .accessibilityFocused($focus, equals: .undo)
  }

  @ViewBuilder
  private func answerFailure(_ item: PlanSlotItem) -> some View {
    if failed(item) {
      SuggestionSaveError()
    }
  }

  private func failed(_ item: PlanSlotItem) -> Bool {
    (currentAnswer?.item == item && currentAnswer?.editor.latest == nil
      && currentAnswer?.editor.failed == true)
      || (item == .courseComplete && claimFailed(item))
  }

  /// The finished plan's own view says it beside its buttons.
  private func claimFailed(_ item: PlanSlotItem) -> Bool {
    (item == .courseComplete || item == .finished)
      && context.slotCheck(item, request: .claim).failed
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

  /// Hidden in place while a result shows, as main's is, so the result doesn't move and nobody pages
  /// away from it.
  @ViewBuilder
  private func pager(index: Int, count: Int, isHidden: Bool) -> some View {
    if count > 1 {
      HStack {
        Spacer()

        Button {
          move(to: index + 1, count: count)
        } label: {
          HStack(spacing: 4) {
            Text(
              "\(count - 1) more", tableName: "Plan",
              comment:
                "Brings up the next of the Plan's suggestions; the number is how many others there are"
            )

            Image(systemName: "chevron.forward")
              .imageScale(.small)
              .accessibilityHidden(true)
          }
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
          .frame(minHeight: 44)
          .contentShape(.rect)
        }
        .buttonStyle(.borderless)
      }
      .opacity(isHidden ? 0 : 1)
      .allowsHitTesting(!isHidden)
      .accessibilityHidden(isHidden)
    }
  }

  private func move(to index: Int, count: Int) {
    store.setSuggestionState(store.suggestionKey(goalId: context.goal.id)) {
      $0.position = (index + count) % count
    }
  }

  /// A claim that didn't save takes the done mark off its line.
  private func claimMark(_ item: PlanSlotItem) -> SuggestionMark.Kind {
    claimFailed(item) ? .alert : .done
  }

  /// "Beginner complete" when the claim certifies one level, else "Course complete".
  private var completeTitle: Text {
    let unclaimed = store.planEnd(goalId: context.goal.id).value?.certificates?.unclaimed ?? []

    if let level = unclaimed.first?.courseLevel, unclaimed.count == 1 {
      return Text(
        "\(String(localized: level.localizedTitle)) complete", tableName: "Plan",
        comment:
          "A Plan suggestion's title once every lesson and challenge of a course level is done, such as \"Beginner complete\", before the plan's end"
      )
    }

    return Text(
      "Course complete", tableName: "Plan",
      comment:
        "A Plan suggestion's title once every lesson and challenge of the course is done, while the exam's practice tests are still ahead"
    )
  }

  /// Main's `PlanChangeSuggestion`: a change to the plan, one card at every width.
  private func isPlanChange(_ item: PlanSlotItem) -> Bool {
    switch item {
    case .coverage, .fitLessons, .extraLessons: true
    case .pastDate: !isStatement(item)
    default: false
    }
  }

  /// The page's bottom bar answers it, so its line says everything and opens nothing.
  private func isStatement(_ item: PlanSlotItem) -> Bool {
    item == .pastDate && context.goal.kind == .exam
  }

  @ViewBuilder
  private func slot(_ item: PlanSlotItem) -> some View {
    let offers = PlanSlotActions(
      apply: { edits in apply(item) { await $0.change(edits) } },
      notNow: { notNow(item) })

    switch item {
    case .choice(let choice) where choice.take > 1:
      PlanSlotCard(
        title: Text.examChoiceQuestion(group: choice.group, take: choice.take),
        description: Text(choice.leftOut.line)
      ) {
        ExamPickLimit(take: choice.take)

        ExamOptionToggles(
          options: choice.options, take: choice.take,
          picked: Binding(
            get: { draft(choice) },
            set: { names in
              store.setSuggestionState(store.suggestionKey(goalId: context.goal.id)) {
                $0.choiceDrafts[choice.group] = names
              }
            }))
      } actions: {
        Button {
          choose(draft(choice), in: choice, item: item)
        } label: {
          Text(
            "Save", tableName: "Plan", comment: "Saves the options picked for an exam's choice")
        }
        .mainActionUnlessBarHoldsOne()
        .disabled(draft(choice).isEmpty)
      }
    case .choice(let choice):
      PlanSlotCard(
        title: Text.examChoiceQuestion(group: choice.group, take: choice.take),
        description: Text(choice.leftOut.line)
      ) {
        // Equal picks: one under the other in their order, none drawn as the main answer.
        VStack(spacing: 8) {
          ForEach(choice.options, id: \.self) { option in
            Button(option.name) {
              choose([option.name], in: choice, item: item)
            }
            .buttonStyle(.outline)
            .buttonSizing(.flexible)
          }
        }
      } actions: {
        EmptyView()
      }
    case .pastDate:
      if context.goal.kind == .exam {
        PlanExamOverSlot(context: context, isLine: !isInline)
      } else {
        PlanPastDateSlot(context: context, actions: offers)
      }
    case .fitLessons:
      if let offer = context.plan.fitOffer {
        PlanOfferSlot(
          context: context, item: item, offer: offer, title: { fitTitle(offer, today: $0) },
          actions: offers)
      }
    case .extraLessons:
      if let offer = context.plan.extraOffer {
        PlanOfferSlot(
          context: context, item: item, offer: offer, title: { _ in extraTitle },
          facts: { extraFacts(offer, today: $0) }, actions: offers)
      }
    case .coverage:
      if let suggested = context.plan.suggestedTime {
        PlanCoverageSlot(context: context, suggested: suggested, actions: offers)
      }
    case .courseComplete:
      PlanSlotCard(title: completeTitle, description: nil) {
        CertificateClaimButton(context: context, item: .courseComplete)
          .mainActionUnlessBarHoldsOne()
      }
    case .finished:
      PlanFinishedSlot(context: context)
    case .tooTight:
      PlanSlotCard(
        title: Text(tooTightTitle),
        description: Text(
          "Study longer each day or pick a later date.", tableName: "Plan",
          comment: "Under the Plan's notice when the plan has more lessons than days left")
      ) {
        Button {
          context.adjust(.top)
        } label: {
          Text(
            "Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
        }
        .mainActionUnlessBarHoldsOne()
      }
    }
  }

  /// Main's line action: one that acts on its own, or what opening the whole suggestion leads to.
  @ViewBuilder
  private func lineAction(_ item: PlanSlotItem) -> some View {
    switch item {
    case .tooTight:
      Button {
        context.adjust(.top)
      } label: {
        Text(
          "Adjust", tableName: "Plan",
          comment:
            "Opens the plan's settings, on the line saying the plan has more lessons than days left"
        )
      }
      .buttonStyle(.outline)
      .controlSize(.small)
    case .choice:
      SuggestionViewButton(
        label: Text("Choose", tableName: "Plan", comment: "Opens an exam choice's options")
      ) {
        context.show(.suggestion(item))
      }
    case .courseComplete:
      CertificateClaimButton(context: context, item: item)
        .buttonStyle(.outline)
        .controlSize(.small)
    case .finished:
      PlanFinishedLineActions(context: context) {
        context.show(.suggestion(item))
      }
    default:
      SuggestionViewButton {
        context.show(.suggestion(item))
      }
    }
  }

  private var tooTightTitle: String {
    String(
      localized: "Let's fit your plan to the time left", table: "Plan")
  }

  /// What the line says for each suggestion, as main's `SuggestionSummary`: its title.
  private func summary(_ item: PlanSlotItem) -> (text: Text, mark: SuggestionMark.Kind) {
    switch item {
    case .choice(let choice):
      (Text.examChoiceQuestion(group: choice.group, take: choice.take), .symbol("signpost.right"))
    case .pastDate:
      (Text(planPastDateTitle(isExam: context.goal.kind == .exam)), .symbol("calendar.badge.clock"))
    case .fitLessons:
      (
        context.plan.fitOffer.map {
          fitTitle($0, today: context.slotCheck(item).repriced?.preview.effect)
        } ?? Text(verbatim: ""), .sparkle
      )
    case .extraLessons:
      (extraTitle, .sparkle)
    case .coverage:
      (Text(context.plan.suggestedTime.map(PlanCoverageSlot.title) ?? ""), .sparkle)
    case .courseComplete:
      (completeTitle, claimMark(item))
    case .finished:
      (
        Text("You finished your plan", tableName: "Plan", comment: "Title once the plan is over"),
        claimMark(item)
      )
    case .tooTight:
      (Text(tooTightTitle), .symbol("calendar.badge.clock"))
    }
  }

  private func fitTitle(_ offer: GoalPlan.Offer, today: PlanEffect?) -> Text {
    Text(
      "You have time for \((today ?? offer.effect).lessonsAdded) more lessons", tableName: "Plan",
      comment: "Title of the offer that brings into the plan more lessons the learner's time fits")
  }

  private var extraTitle: Text {
    Text("Study exam strategy too?", tableName: "Plan")
  }

  /// "15 lessons · Not in the official guide".
  private func extraFacts(_ offer: GoalPlan.Offer, today: PlanEffect?) -> [String] {
    [
      String(
        localized: "\(today?.lessonsAdded ?? offer.lessons ?? offer.effect.lessonsAdded) lessons",
        table: "Plan", locale: .appLanguage),
      context.plan.extraLabel,
    ]
  }

  private func notNow(_ item: PlanSlotItem) {
    store.setSuggestionState(store.suggestionKey(goalId: context.goal.id)) {
      $0.dismissed.insert(item)
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

  /// A new editor for each answer, so the last answer's result never shows as this one's.
  private func apply(
    _ item: PlanSlotItem, _ write: @escaping (PlanEditor) async -> Bool,
    saved: @escaping (inout PlanStore.SuggestionState) -> Void = { _ in }
  ) {
    let key = store.suggestionKey(goalId: context.goal.id)
    let editor = PlanEditor(
      goalId: context.goal.id, store: store,
      dateKind: GoalDateKind(isExam: context.goal.kind == .exam))
    answer = PlanSlotAnswer(key: key, item: item, editor: editor)

    editor.run {
      if await write(editor) {
        store.setSuggestionState(key, saved)
      }
    }
  }
}

/// A suggestion whose answers are the page's bottom bar: it says what's so and opens nothing. In
/// the page's column it's a suggestion line with no "View"; beside the page, the card's words.
struct PlanStatement: View {
  let mark: SuggestionMark.Kind
  let title: Text
  let description: Text
  var isLine = false

  var body: some View {
    if isLine {
      SuggestionLine(alignment: .firstTextBaseline) {
        SuggestionMark(kind: mark)
      } summary: {
        VStack(alignment: .leading, spacing: 2) {
          title
          SuggestionDescription(description)
        }
        .accessibilityElement(children: .combine)
      } action: {
        EmptyView()
      }
    } else {
      VStack(alignment: .leading, spacing: 8) {
        SuggestionHeader(title)

        SuggestionDescription(description)
      }
    }
  }
}

/// Writes the certificates of the plan's finished levels or plan; the Plan plays their moment.
/// Where it sits says whether it's the main answer and where a claim that didn't save says so.
struct CertificateClaimButton: View {
  let context: PlanContext
  /// The suggestion it's in, whose opening the claim belongs to.
  let item: PlanSlotItem

  var body: some View {
    let claim = context.slotCheck(item, request: .claim)

    BusyButton(isBusy: claim.isWorking, icon: .certificate) {
      claim.claim(context)
    } label: {
      Text(
        "Get your certificate", tableName: "Plan",
        comment: "Writes the certificate of the plan's finished course or level and shows it")
    }
  }
}

extension PlanSlotCheck {
  /// The claim is the Plan's, not its button's: the button is drawn again as the Plan splits into
  /// panes or joins them, and what the claim earned still plays. Once its opening ends, what it
  /// earned opens nothing and plays with the learner's next result.
  func claim(_ context: PlanContext) {
    isWorking = true
    failed = false

    run {
      let claim = await context.claimCertificate()
      self.isWorking = false
      self.failed = claim == nil

      if let claim {
        self.land { context.showClaim(claim) }
      }
    }
  }
}

/// One certificate opens; several open Certificates.
private struct PlanCertificatesButton: View {
  @Environment(AppRouter.self) private var router

  let context: PlanContext
  let earned: [PlanEnd.Certificates.Earned]

  var body: some View {
    if let only = earned.first, earned.count == 1 {
      Button {
        context.show(.certificate(code: only.code))
      } label: {
        Text(
          "View certificate", tableName: "Plan",
          comment: "Opens the certificate of the finished plan's course or level")
      }
    } else if !earned.isEmpty {
      Button {
        router.present(.account(.certificates))
      } label: {
        Text(
          "View certificates", tableName: "Plan",
          comment: "Opens the learner's certificates, from a plan that earned several")
      }
    }
  }
}

/// Main's `CertificateAction`: get the certificates not written yet, else view the ones earned.
private struct PlanCertificateAction: View {
  let context: PlanContext
  let certificates: PlanEnd.Certificates

  var body: some View {
    if certificates.unclaimed.isEmpty {
      PlanCertificatesButton(context: context, earned: certificates.earned)
    } else {
      CertificateClaimButton(context: context, item: .finished)
    }
  }
}

/// The finished plan's line, as main's: its certificate, and "View" while there's more to show
/// (what to study next) or no certificate to offer.
private struct PlanFinishedLineActions: View {
  @Environment(PlanStore.self) private var store

  let context: PlanContext
  let open: () -> Void

  var body: some View {
    let end = store.planEnd(goalId: context.goal.id).value
    let certificates = end?.offeredCertificates

    HStack(spacing: 8) {
      if let certificates {
        PlanCertificateAction(context: context, certificates: certificates)
      }

      if certificates == nil || end?.hasMore == true {
        SuggestionViewButton(action: open)
      }
    }
    .buttonStyle(.outline)
    .controlSize(.small)
  }
}

extension PlanEnd {
  /// The certificates to get or view, once there's one of either.
  fileprivate var offeredCertificates: Certificates? {
    certificates.flatMap { $0.unclaimed.isEmpty && $0.earned.isEmpty ? nil : $0 }
  }

  /// A next level or related courses: what to study next.
  fileprivate var hasMore: Bool {
    next.map { $0.nextLevel != nil || !$0.related.isEmpty } ?? false
  }
}

private struct PlanFinishedSlot: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @Environment(\.isInSuggestionSheet) private var isInSheet

  let context: PlanContext

  var body: some View {
    let end = store.planEnd(goalId: context.goal.id)

    Group {
      if isInSheet {
        SuggestionSheetBody(note: failed ? BarNote(SuggestionSaveError.message) : nil) {
          words(end.value)
          related(end.value)
        } actions: {
          actions(end.value)
            .buttonStyle(.outline)
        }
      } else {
        VStack(alignment: .leading, spacing: 8) {
          words(end.value)

          ButtonRow(wraps: true) {
            actions(end.value)
          }
          .buttonStyle(.outline)

          if failed {
            SuggestionSaveError()
          }

          related(end.value)
        }
      }
    }
    .loads(end, refreshable: false)
  }

  @ViewBuilder
  private func words(_ end: PlanEnd?) -> some View {
    SuggestionHeader(
      Text("You finished your plan", tableName: "Plan", comment: "Title once the plan is over"))

    if end?.hasMore == true {
      SuggestionDescription(
        Text(
          "Here's what to study next.", tableName: "Plan", comment: "Leads to what to study next"))
    }
  }

  /// Main's: the next level is the main answer when there is one, else the certificate.
  @ViewBuilder
  private func actions(_ end: PlanEnd?) -> some View {
    let certificates = end?.offeredCertificates

    SuggestionActions {
      if let level = end?.next?.nextLevel {
        BusyButton(isBusy: start.isWorking, icon: .play) {
          continueAtNextLevel()
        } label: {
          Text(
            "Continue at \(planLevelName(level.level))", tableName: "Plan",
            comment: "Starts the next level of the plan's course")
        }
        .mainActionUnlessBarHoldsOne()
      } else if let certificates {
        PlanCertificateAction(context: context, certificates: certificates)
          .mainActionUnlessBarHoldsOne()
      }
    } other: {
      if end?.next?.nextLevel != nil, let certificates {
        PlanCertificateAction(context: context, certificates: certificates)
      }
    }
  }

  @ViewBuilder
  private func related(_ end: PlanEnd?) -> some View {
    // Main's related courses are list rows, each opening its course.
    ForEach(end?.next?.related ?? []) { course in
      Button {
        router.open(.course(courseId: course.courseId, title: course.title))
      } label: {
        ListRow(Text(course.title)) {
          Image(systemName: "books.vertical")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .disclosureChevron()
      }
      .buttonStyle(.plain)
    }
  }

  /// A claim or the next level's start that didn't save, said under the buttons, as main's is.
  private var failed: Bool {
    start.failed || context.slotCheck(.finished, request: .claim).failed
  }

  /// "Continue at" the next level, the finished plan's own.
  private var start: PlanSlotCheck {
    context.slotCheck(.finished, request: .nextLevel)
  }

  private func continueAtNextLevel() {
    let start = start
    start.isWorking = true
    start.failed = false

    start.run { [store, goalId = context.goal.id] in
      let result = await store.continueAtNextLevel(goalId: goalId)
      start.isWorking = false

      switch result {
      case .done(let started): start.failed = !started
      case .failed: start.failed = true
      case .obsolete: break
      }
    }
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
