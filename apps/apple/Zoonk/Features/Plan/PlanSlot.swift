import SwiftUI

/// The most pressing first, in main's order.
enum PlanSlotItem: Hashable {
  case behind(String)
  case choice(GoalPlan.ExamChoice)
  case courseComplete
  case coverage(String)
  case finished
  case fitLessons
  case freeWeekOver
  case pastDate(String)
  case paused
  case tooTight

  /// `courseComplete` while a finished part's certificate isn't written yet.
  static func items(
    plan: GoalPlan, isPaused: Bool, isExam: Bool, courseComplete: Bool
  ) -> [PlanSlotItem] {
    let fix = planPaceFix(plan, isExam: isExam)
    let status = plan.status?.kind
    let finished = plan.end != nil
    let open = !plan.access.freeWeekOver && status != .pastDate
    let coverage = planCoverageText(plan)
    let timeItems: [PlanSlotItem] = [
      open && plan.fitOffer != nil ? .fitLessons : nil,
      open && !(plan.feasibility?.timeCovers ?? false) ? coverage.map { .coverage($0) } : nil,
    ].compactMap(\.self)

    var items: [PlanSlotItem] = !finished && courseComplete ? [.courseComplete] : []

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

/// One thing at a time, paged as main's slot is: "Not now" puts one off for as long as the app runs.
/// An answer that changes the plan says what it did, with Undo, for a moment. In the page's column
/// it's main's suggestion line, its summary with "View" opening the whole suggestion in a sheet,
/// which the screen presents (`sheetItem`); beside the page (`isInline`) it's the whole suggestion.
struct PlanSuggestionSection: View {
  private enum Focus: Hashable {
    case item
    case result
    case undo
  }

  private static let resultSeconds: TimeInterval = 8

  @Environment(AppRouter.self) private var router
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
    let state = store.suggestionState(goalId: context.goal.id)
    let isExam = context.goal.kind == .exam
    let unclaimed =
      isExam ? store.planEnd(goalId: context.goal.id).value?.certificates?.unclaimed ?? [] : []
    let items = PlanSlotItem.items(
      plan: context.plan, isPaused: context.isPaused, isExam: isExam,
      courseComplete: !unclaimed.isEmpty
    ).filter { !state.dismissed.contains($0) }
    let answer = currentAnswer
    let applied: (change: AppliedPlanChange, sentence: String)? =
      if case .applied(let change, let sentence) = answer?.editor.latest, answer?.isOver == false {
        (change, sentence)
      } else {
        nil
      }

    return (items, min(state.position, max(items.count - 1, 0)), applied)
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
        answerFailure(item)
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
      Section {
        // One row whichever shows, so a pointer resting on it stays on it.
        VStack(alignment: .leading, spacing: 8) {
          if let answer, let applied {
            if isInline {
              result(answer, change: applied.change, sentence: applied.sentence)
            } else {
              resultLine(answer, change: applied.change, sentence: applied.sentence)
            }
          } else if isInline {
            slot(item)
            answerFailure(item)
          } else {
            let summary = summary(item)

            SuggestionLine {
              SuggestionMark(kind: summary.mark)
            } summary: {
              summary.text
                .accessibilityFocused($focus, equals: .item)
            } action: {
              // Main's free-week line offers Plus itself; the others open in full.
              if item == .freeWeekOver {
                SeePlusButton()
                  .buttonStyle(.outline)
                  .controlSize(.small)
              } else {
                SuggestionViewButton {
                  context.show(.suggestion(item))
                }
              }
            }
          }
        }
        .padding(.vertical, isInline ? 4 : 0)
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
      header(
        choiceTitle(choice), icon: SuggestionMark(kind: .symbol("signpost.right")))
    } else {
      header(
        Text("Plan updated", tableName: "Plan", comment: "Title once a plan suggestion is applied"),
        icon: StatusMark(status: .done))
    }

    Text(sentence)
      .typeStyle(.body.weight(.medium))
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
      Text(sentence)
        .typeWeight(.medium)
        .foregroundStyle(Color(.foreground))
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

  @ViewBuilder
  private func answerFailure(_ item: PlanSlotItem) -> some View {
    if currentAnswer?.item == item, currentAnswer?.editor.latest == nil,
      currentAnswer?.editor.failed == true
    {
      SuggestionSaveError()
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

  /// Hidden in place while a result shows, as main's is, so the result doesn't move and nobody pages
  /// away from it.
  @ViewBuilder
  private func pager(index: Int, count: Int, isHidden: Bool) -> some View {
    if count > 1 {
      pages(index: index, count: count)
        .opacity(isHidden ? 0 : 1)
        .allowsHitTesting(!isHidden)
        .accessibilityHidden(isHidden)
    }
  }

  private func pages(index: Int, count: Int) -> some View {
    HStack(spacing: 0) {
      Spacer()

      pageButton(
        Text(
          "Previous", tableName: "Plan",
          comment: "Goes back to the previous of the Plan's suggestions"),
        systemImage: "chevron.left"
      ) {
        move(to: index - 1, count: count)
      }

      Text(
        "\(index + 1) of \(count)", tableName: "Plan",
        comment: "The suggestion shown of the Plan's suggestions"
      )
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)

      pageButton(
        Text("Next", tableName: "Plan", comment: "Goes on to the next of the Plan's suggestions"),
        systemImage: "chevron.right"
      ) {
        move(to: index + 1, count: count)
      }
    }
  }

  private func pageButton(
    _ title: Text, systemImage: String, action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      Label {
        title
      } icon: {
        Image(systemName: systemImage)
          .typeStyle(.body)
          .frame(minWidth: 44, minHeight: 44)
          .contentShape(.rect)
      }
      .labelStyle(.iconOnly)
    }
    .buttonStyle(.borderless)
  }

  private func move(to index: Int, count: Int) {
    store.setSuggestionState(store.suggestionKey(goalId: context.goal.id)) {
      $0.position = (index + count) % count
    }
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

  @ViewBuilder
  private func slot(_ item: PlanSlotItem) -> some View {
    switch item {
    case .paused:
      PlanPausedSlot(context: context)
    case .choice(let choice) where choice.take > 1:
      card(
        title: choiceTitle(choice), mark: .symbol("signpost.right"),
        description: Text(choice.leftOut.line),
        options: {
          Text.examPickLimit(choice.take)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)

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
        title: choiceTitle(choice), mark: .symbol("signpost.right"),
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
        mark: .symbol("calendar.badge.clock"), description: Text(text)
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
      card(title: Text(text), mark: .sparkle, description: nil) {
        Button {
          context.adjust(.time)
        } label: {
          Text(
            "Change time a day", tableName: "Plan",
            comment: "Opens the plan's study time a day to change it")
        }

        notNow(item)
      }
    case .courseComplete:
      VStack(alignment: .leading, spacing: 8) {
        Label {
          completeTitle
            .typeStyle(.body.weight(.semibold))
        } icon: {
          StatusMark(status: .done)
        }

        CertificateClaimButton(context: context)
      }
    case .finished:
      PlanFinishedSlot(context: context)
    case .tooTight:
      card(
        title: Text(
          "Your plan no longer fits", tableName: "Plan",
          comment: "Title of the Plan's notice when the plan no longer fits"),
        mark: .symbol("calendar.badge.clock"), description: nil
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
        mark: .symbol("calendar.badge.clock"), description: Text(text)
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
      FreeWeekOverNotice(isInset: true)
    }
  }

  /// What the line says for each suggestion, as main's `SuggestionSummary`: its title, or for a pace
  /// that's behind, how to catch up.
  private func summary(_ item: PlanSlotItem) -> (text: Text, mark: SuggestionMark.Kind) {
    switch item {
    case .paused:
      (
        Text(
          "\(context.goal.title) is paused", tableName: "Plan",
          comment: "Title of the Plan's notice for a paused goal"), .symbol("pause")
      )
    case .choice(let choice):
      (choiceTitle(choice), .symbol("signpost.right"))
    case .pastDate:
      (
        Text(
          "Your date came", tableName: "Plan",
          comment: "Title of the Plan's notice when the goal's date came"),
        .symbol("calendar.badge.clock")
      )
    case .fitLessons:
      (context.plan.fitOffer.map(fitTitle) ?? Text(verbatim: ""), .sparkle)
    case .coverage(let text):
      (Text(text), .sparkle)
    case .courseComplete:
      (completeTitle, .done)
    case .finished:
      (
        Text("You finished your plan", tableName: "Plan", comment: "Title once the plan is over"),
        .done
      )
    case .tooTight:
      (
        Text(
          "Your plan no longer fits", tableName: "Plan",
          comment: "Title of the Plan's notice when the plan no longer fits"),
        .symbol("calendar.badge.clock")
      )
    case .behind(let text):
      (Text(text), .symbol("calendar.badge.clock"))
    case .freeWeekOver:
      (Text(FreeWeekOverNotice.title), .symbol("sparkles"))
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
        title: title, mark: .sparkle,
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
    title: Text, mark: SuggestionMark.Kind, description: Text?, effect: PlanEffect? = nil,
    @ViewBuilder options: () -> some View = { EmptyView() },
    @ViewBuilder actions: () -> some View
  ) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      header(title, icon: SuggestionMark(kind: mark))

      if let description {
        description
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }

      PlanEffectDiff(effect: effect, today: context.plan.today)

      options()

      ButtonRow {
        actions()
      }
      .buttonStyle(.outline)
    }
  }

  private func header(_ title: Text, icon: some View) -> some View {
    Label {
      title.typeStyle(.body.weight(.semibold))
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
  @State private var failure: GoalStatusOutcome?

  let context: PlanContext

  var body: some View {
    let preview = store.resumeChangesPlan(goalId: context.goal.id)

    VStack(alignment: .leading, spacing: 8) {
      Label {
        Text(
          "\(context.goal.title) is paused", tableName: "Plan",
          comment: "Title of the Plan's notice for a paused goal"
        )
        .typeStyle(.body.weight(.semibold))
      } icon: {
        SuggestionMark(kind: .symbol("pause"))
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
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)

      Button {
        Task { await resume() }
      } label: {
        Text("Resume", tableName: "Plan", comment: "Resumes the paused goal")
      }
      .buttonStyle(.outline)
      .disabled(isResuming)

      switch failure {
      case .limitReached:
        FailureLine(
          message: LocalizedStringResource(
            "The free plan follows one goal at a time. Pause your other goal to resume this one, or get Plus for more.",
            table: "Plan", comment: "Explains why resuming a goal failed on the free plan")
        )
        .typeStyle(.note)
      case .failed:
        FailureLine(
          message: LocalizedStringResource(
            "That didn't save. Try again.", table: "Plan",
            comment: "Resuming the paused goal didn't save")
        )
        .typeStyle(.note)
      case .saved, nil:
        EmptyView()
      }
    }
    .loads(preview, refreshable: false)
  }

  private func resume() async {
    isResuming = true
    failure = nil

    switch await store.setStatus(.active, goalId: context.goal.id) {
    case .done(.saved), .obsolete:
      break
    case .done(let refused):
      failure = refused
    case .failed:
      failure = .failed
    }

    isResuming = false
  }
}

/// Writes the certificates of the plan's finished levels or plan; the Plan plays their moment.
private struct CertificateClaimButton: View {
  @State private var isClaiming = false
  @State private var failed = false

  let context: PlanContext

  var body: some View {
    let failure = String(
      localized: "That didn't save. Try again.", table: "Plan",
      comment: "The plan's certificate couldn't be written; Get your certificate tries again")

    Button {
      Task {
        isClaiming = true
        let claim = await context.claimCertificate()
        failed = claim == nil
        isClaiming = false

        if let claim {
          context.showClaim(claim)
        }

        if failed {
          AccessibilityNotification.Announcement(failure).post()
        }
      }
    } label: {
      Label {
        Text(
          "Get your certificate", tableName: "Plan",
          comment: "Writes the certificate of the plan's finished course or level and shows it")
      } icon: {
        Image(systemName: "rosette")
      }
    }
    .buttonStyle(.mainAction)
    .disabled(isClaiming)

    if failed {
      Text(failure)
        .typeStyle(.body)
        .foregroundStyle(.destructiveText)
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
        label(
          Text(
            "View certificate", tableName: "Plan",
            comment: "Opens the certificate of the finished plan's course or level"))
      }
      .buttonStyle(.outline)
    } else if !earned.isEmpty {
      Button {
        router.present(.account(.certificates))
      } label: {
        label(
          Text(
            "View certificates", tableName: "Plan",
            comment: "Opens the learner's certificates, from a plan that earned several"))
      }
      .buttonStyle(.outline)
    }
  }

  private func label(_ title: Text) -> some View {
    HStack {
      Label {
        title
      } icon: {
        Image(systemName: "rosette")
      }

      if earned.contains(where: \.locked) {
        PlusMark()
      }
    }
  }
}

private struct PlanFinishedSlot: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @State private var failed = false
  @State private var isStarting = false

  let context: PlanContext

  var body: some View {
    let end = store.planEnd(goalId: context.goal.id)

    VStack(alignment: .leading, spacing: 8) {
      Label {
        Text("You finished your plan", tableName: "Plan", comment: "Title once the plan is over")
          .typeStyle(.body.weight(.semibold))
      } icon: {
        StatusMark(status: .done)
      }

      if let certificates = end.value?.certificates {
        if certificates.unclaimed.isEmpty {
          PlanCertificatesButton(context: context, earned: certificates.earned)
        } else {
          CertificateClaimButton(context: context)
        }
      }

      if let value = end.value?.next, value.nextLevel != nil || !value.related.isEmpty {
        Text(
          "Here's what to study next.", tableName: "Plan", comment: "Leads to what to study next"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)

        if let level = value.nextLevel {
          Button {
            Task { await continueAtNextLevel() }
          } label: {
            Text(
              "Continue at \(planLevelName(level.level))", tableName: "Plan",
              comment: "Starts the next level of the plan's course")
          }
          .buttonStyle(.outline)
          .disabled(isStarting)
        }

        ForEach(value.related) { course in
          Button {
            router.open(.course(courseId: course.courseId, title: course.title))
          } label: {
            Label(course.title, systemImage: "books.vertical")
              .typeStyle(.body)
          }
          .buttonStyle(.borderless)
        }
      }

      if failed {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't work. Try again in a moment.", table: "Plan",
            comment: "Says the next level didn't start")
        )
        .typeStyle(.body)
      }
    }
    .loads(end, refreshable: false)
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
