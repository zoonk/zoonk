import SwiftUI

struct MockResultView: View {
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss
  let run: MockRun
  let view: MockView

  var body: some View {
    List {
      if let result = view.result {
        if result.total > 0 || view.essays.isEmpty {
          MockScoreSections(view: view, result: result)
        }

        if result.areas.count > 1 {
          MockAreaSection(result: result)
        }

        MockInsightsSection(result: result)
      }

      ForEach(Array(view.essays.enumerated()), id: \.element.id) { index, essay in
        MockEssaySections(
          run: run, essay: essay, number: index + 1, total: view.essays.count,
          rubric: view.essayRubric ?? .custom)
      }

      if let adapt = view.adapt, adapt.skip != nil || adapt.focus != nil {
        MockPlanSection(run: run, adapt: adapt, preparation: view.result?.preparation)
      } else if let preparation = view.result?.preparation, preparation.after != preparation.before
      {
        MockPreparationSection(preparation: preparation)
      }

      if !view.review.isEmpty {
        MockReviewSection(items: view.review)
      }

      MockNotesSection(view: view)
    }
    .navigationTitle(MockLabels.title(number: view.number))
    .toolbar {
      if view.purpose != .placement {
        ToolbarItem(placement: .primaryAction) {
          TutorAskButton(scope: .mock(blockId: view.blockId))
        }
      }
    }
    .safeAreaBar(edge: .bottom) {
      VStack(spacing: 8) {
        mainAction
        secondaryAction
      }
      .scenePadding(.horizontal)
      .padding(.vertical, 10)
      .keepsOffFold()
    }
  }

  /// The questions answered wrong: the ones to fix. Blanks are reviewed but aren't mistakes.
  private var mistakes: Int {
    view.review.filter { $0.outcome != .blank }.count
  }

  @ViewBuilder
  private var mainAction: some View {
    Group {
      if view.purpose == .placement {
        Button {
          // Onboarding is under the mock: its plan starts from these answers.
          dismiss()
        } label: {
          Text("See my plan", tableName: "Mock", comment: "After a placement mock")
        }
      } else if mistakes == 0 {
        Button {
          dismiss()
        } label: {
          Text("Continue", tableName: "Mock", comment: "Leaves a mock's result")
        }
      } else {
        Button {
          router.open(.mistakes)
        } label: {
          Text("Review the \(mistakes) mistakes", tableName: "Mock", comment: "Opens the notebook")
        }
      }
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
    .keyboardShortcut(.defaultAction)
  }

  @ViewBuilder
  private var secondaryAction: some View {
    if mistakes > 0, view.purpose != .placement {
      Button {
        dismiss()
      } label: {
        if view.purpose == .planned {
          Text("Continue today's session", tableName: "Mock", comment: "Back to the session")
        } else {
          Text("Not now", tableName: "Mock", comment: "Leaves without reviewing")
        }
      }
      .buttonStyle(.borderless)
    }
  }
}

private struct MockScoreSections: View {
  let view: MockView
  let result: MockResult

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 6) {
        Text(
          "\(MockLabels.title(number: view.number)) done", tableName: "Mock",
          comment: "Over a mock's score"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
        Text(score.value)
          .font(.largeTitle.weight(.semibold).monospacedDigit())
        Text(detail)
          .font(.subheadline)
          .foregroundStyle(.secondary)
        if let delta {
          Label {
            Text(delta.text)
          } icon: {
            Image(
              systemName: delta.up ? "chart.line.uptrend.xyaxis" : "chart.line.downtrend.xyaxis")
          }
          .font(.caption.monospacedDigit())
          .foregroundStyle(.secondary)
        }
      }
      .padding(.vertical, 4)
      .accessibilityElement(children: .combine)
    }

    if let counts {
      Section {
        LabeledContent {
          Text(counts.right, format: .number)
        } label: {
          Label {
            Text("Right", tableName: "Mock", comment: "Right answers")
          } icon: {
            Image(systemName: "checkmark").foregroundStyle(.success)
          }
        }
        LabeledContent {
          Text(counts.wrong, format: .number)
        } label: {
          Label {
            Text("Wrong", tableName: "Mock", comment: "Wrong answers")
          } icon: {
            Image(systemName: "xmark").foregroundStyle(.destructive)
          }
        }
        if counts.partial > 0 {
          LabeledContent {
            Text(counts.partial, format: .number)
          } label: {
            Label {
              Text("Partly right", tableName: "Mock", comment: "Partly right answers")
            } icon: {
              Image(systemName: "circle.dashed")
            }
          }
        }
        LabeledContent {
          Text(counts.blank, format: .number)
        } label: {
          Label {
            Text("Blank", tableName: "Mock", comment: "Blank answers")
          } icon: {
            Image(systemName: "minus")
          }
        }
      } footer: {
        if result.net == nil, result.blank > 0 {
          if result.irt != nil {
            Text(
              "Blank answers count as wrong, as on exam day.", tableName: "Mock",
              comment: "Blank answers in an estimated score")
          } else {
            Text(
              "Blank answers count as wrong in this score.", tableName: "Mock",
              comment: "Blank answers in right answers")
          }
        }
      }
      .monospacedDigit()
    }

    if counts == nil, result.net == nil, result.blank > 0 {
      Section {
      } footer: {
        Text(
          "Blank answers count as wrong in this score.", tableName: "Mock",
          comment: "Blank answers in right answers")
      }
    }

    if let passMarks = view.passMarks {
      Section {
        ForEach(passMarks.texts, id: \.self) { text in
          Text(text)
            .environment(\.locale, Locale(identifier: passMarks.language))
        }
      } header: {
        if view.examDocument == .notice {
          Text("To pass, the notice says", tableName: "Mock", comment: "Pass marks header")
        } else {
          Text("To pass, the official guide says", tableName: "Mock", comment: "Pass marks header")
        }
      }
    }

    if let note = scoreNote {
      Section {
        Text(note)
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
  }

  private var score: (label: String, value: String) {
    if let irt = result.irt {
      return (
        String(localized: "Estimated score", table: "Mock", comment: "An IRT score's label"),
        MockLabels.range(low: irt.low, high: irt.high)
      )
    }

    if let net = result.net {
      return (
        String(
          localized: "Net score out of \(net.max)", table: "Mock", comment: "A net score's label"),
        MockLabels.number(net.net)
      )
    }

    return (
      String(localized: "Right answers", table: "Mock", comment: "A raw score's label"),
      String(
        localized: "\(MockLabels.number(result.correct)) of \(result.total)", table: "Mock",
        comment: "Right answers of the questions")
    )
  }

  private var detail: String {
    let areas =
      result.areas.count > 3
      ? String(
        localized: "\(result.areas.count) subjects", table: "Mock", comment: "A mock's subjects")
      : result.areas.map(\.name).formatted(.list(type: .and))

    return [score.label, view.examName, areas].compactMap { $0 }.filter { !$0.isEmpty }
      .joined(separator: " · ")
  }

  private var delta: (text: String, up: Bool)? {
    guard let current = result.irt?.score ?? result.net?.net, let previous = result.previous,
      current != previous
    else {
      return nil
    }

    let change = Int((current - previous).rounded())

    return change > 0
      ? (
        String(
          localized: "+\(change) since the last one", table: "Mock", comment: "Score went up"),
        true
      )
      : (
        String(
          localized: "\(change) since the last one", table: "Mock", comment: "Score went down"),
        false
      )
  }

  private var counts: (right: Double, wrong: Double, partial: Int, blank: Int)? {
    if let net = result.net {
      return (Double(net.right), Double(net.wrong), net.partial, net.blank)
    }

    guard result.irt != nil else { return nil }
    return (
      result.correct, Double(result.total) - result.correct - Double(result.blank), 0, result.blank
    )
  }

  private var scoreNote: String? {
    let notes = view.scoreNotes
    var lines: [String] = []

    if let scale = notes.scale {
      let min = MockLabels.number(scale.min)
      let max = MockLabels.number(scale.max)

      if let score = scale.score {
        lines.append(
          scale.name.map {
            String(
              localized:
                "About \(MockLabels.number(score)) on the \($0) scale, from \(min) to \(max).",
              table: "Mock", comment: "The mock's score on the exam's named scale")
          }
            ?? String(
              localized:
                "About \(MockLabels.number(score)) on the exam's scale, from \(min) to \(max).",
              table: "Mock", comment: "The mock's score on the exam's scale"))
      } else {
        lines.append(
          scale.name.map {
            String(
              localized: "The real exam scores on the \($0) scale, from \(min) to \(max).",
              table: "Mock", comment: "The exam's named scale")
          }
            ?? String(
              localized: "The real exam scores from \(min) to \(max).", table: "Mock",
              comment: "The exam's scale"))
      }

      if let pass = scale.passScore {
        lines.append(
          String(
            localized: "To pass: \(MockLabels.number(pass)) or more.", table: "Mock",
            comment: "The pass score on the exam's scale"))
      }
    }

    if let rule = notes.noticeScoring {
      lines.append(
        String(
          localized: "How the real exam scores it: \(rule)", table: "Mock",
          comment: "The notice's scoring rule"))
    }

    if notes.relative {
      lines.append(
        String(
          localized: "Your real result depends on how everyone in your sitting does.",
          table: "Mock", comment: "A relative exam score"))
      lines.append(
        String(
          localized: "This mock shows how many you got right.", table: "Mock",
          comment: "What a mock of a relative exam shows"))
    }

    return lines.isEmpty ? nil : lines.joined(separator: " ")
  }
}

private struct MockAreaSection: View {
  let result: MockResult

  var body: some View {
    Section {
      ForEach(result.areas, id: \.name) { area in
        VStack(alignment: .leading, spacing: 6) {
          LabeledContent {
            if let score = area.score {
              Text(MockLabels.range(low: score.low, high: score.high))
            } else {
              Text(
                "\(MockLabels.number(area.correct)) of \(area.total)", tableName: "Mock",
                comment: "An area's right answers")
            }
          } label: {
            Text(area.name)
          }
          .monospacedDigit()

          ProgressView(value: area.correct, total: Double(max(area.total, 1)))
            .tint(.success)
            .accessibilityHidden(true)
        }
      }
    } header: {
      Text("By area", tableName: "Mock", comment: "Each area's result")
    }
  }
}

private struct MockInsightsSection: View {
  let result: MockResult

  var body: some View {
    let slowest = slowestArea

    if slowest != nil || result.unansweredAtTimeout > 0 || incoherent != nil || unsure != nil {
      Section {
        if slowest != nil || result.unansweredAtTimeout > 0 {
          insight(
            Text("Timing", tableName: "Mock", comment: "Insight about pace"), systemImage: "timer"
          ) {
            if let slowest, let target = slowest.targetSecondsPerQuestion {
              Text(
                "\(Int(slowest.secondsPerQuestion.rounded())) seconds per \(slowest.name) question. Aim for \(Int(target.rounded())) or less.",
                tableName: "Mock", comment: "The slowest area against the exam's pace")
            }
            if result.unansweredAtTimeout > 0 {
              Text(
                "\(result.unansweredAtTimeout) questions were left when time ran out.",
                tableName: "Mock", comment: "Questions left at the end")
            }
          }
        }

        if let coherence = incoherent {
          insight(
            Text("Consistency", tableName: "Mock", comment: "Insight about IRT coherence"),
            systemImage: "scalemass"
          ) {
            Text(
              "\(coherence.easyWrong) easy ones wrong, \(coherence.hardRight) hard ones right. The score counts that against you: review the easy ones first.",
              tableName: "Mock", comment: "IRT coherence")
          }
        }

        if let calibration = unsure {
          insight(
            Text("When to leave it blank", tableName: "Mock", comment: "Insight about unsure"),
            systemImage: "scalemass"
          ) {
            Text(
              "Sure: \(calibration.sure.right) of \(calibration.sure.answered) right. Flagged as unsure: \(calibration.unsure.right) of \(calibration.unsure.answered) right.",
              tableName: "Mock", comment: "Sure against unsure answers")
            if calibration.advice == .blankUnsure {
              Text(
                "Leaving the unsure ones blank would have added \(Int(calibration.blankingGain.rounded())) points.",
                tableName: "Mock", comment: "What blanking unsure answers would have gained")
            } else if calibration.advice == .keepAnswering {
              Text(
                "Your unsure answers still earned points, so keep answering them.",
                tableName: "Mock", comment: "Keep answering unsure ones")
            }
          }
        }
      } header: {
        Text("What the mock exam showed", tableName: "Mock", comment: "The mock's insights")
      }
    }
  }

  private var slowestArea: MockResult.Area? {
    result.areas
      .filter { $0.targetSecondsPerQuestion != nil }
      .max {
        ($0.secondsPerQuestion - ($0.targetSecondsPerQuestion ?? 0))
          < ($1.secondsPerQuestion - ($1.targetSecondsPerQuestion ?? 0))
      }
      .flatMap { $0.secondsPerQuestion > ($0.targetSecondsPerQuestion ?? 0) ? $0 : nil }
  }

  private var incoherent: MockResult.Coherence? {
    result.coherence.flatMap { $0.isCoherent ? nil : $0 }
  }

  private var unsure: NetCalibration? {
    result.calibration.flatMap { $0.unsure.answered > 0 ? $0 : nil }
  }

  private func insight<Content: View>(
    _ title: Text, systemImage: String, @ViewBuilder content: () -> Content
  ) -> some View {
    Label {
      VStack(alignment: .leading, spacing: 4) {
        title.font(.headline)
        content().foregroundStyle(.secondary)
      }
    } icon: {
      Image(systemName: systemImage)
    }
  }
}

private struct MockEssaySections: View {
  let run: MockRun
  let essay: MockEssay
  let number: Int
  let total: Int
  let rubric: EssayRubric

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 6) {
        Text(essay.question)
          .font(.headline)
        status
      }
    } header: {
      if total > 1 {
        Text("Written part · \(number) of \(total)", tableName: "Mock", comment: "Essay of essays")
      } else {
        Text("Written part", tableName: "Mock", comment: "A full mock's essay part")
      }
    }

    if let grade = essay.grade {
      EssayGradeSections(grade: grade)
    }
  }

  @ViewBuilder
  private var status: some View {
    switch essay.status {
    case .blank:
      Text("You left it blank.", tableName: "Mock", comment: "A blank essay")
        .foregroundStyle(.secondary)
    case .graded:
      EmptyView()
    case .pending:
      switch run.essayGrading {
      case .grading:
        Label {
          Text(
            "Grading it with the exam's rubric. It can take up to 30 seconds.", tableName: "Mock",
            comment: "An essay is being graded")
        } icon: {
          ProgressView()
        }
        .foregroundStyle(.secondary)
      case .limitReached:
        Text(
          "You've used today's essay grades. Try again tomorrow.", tableName: "Mock",
          comment: "No essay grades left today"
        )
        .foregroundStyle(.secondary)
      case .failed, .idle:
        if run.essayGrading == .failed {
          Text(
            "That didn't go through. Try again in a moment.", tableName: "Mock",
            comment: "Grading failed"
          )
          .foregroundStyle(.destructive)
        } else {
          Text("It hasn't been graded yet.", tableName: "Mock", comment: "An ungraded essay")
            .foregroundStyle(.secondary)
        }
        Button {
          Task { await run.gradeEssays() }
        } label: {
          Text("Grade it", tableName: "Mock", comment: "Grades a mock's essays")
        }
        .buttonStyle(.bordered)
      }
    }
  }
}

private struct MockPreparationSection: View {
  let preparation: MockResult.Preparation

  var body: some View {
    Section {
      MockPreparationRow(preparation: preparation)
    } header: {
      Text("Your preparation", tableName: "Mock", comment: "How preparation moved")
    }
  }
}

private struct MockPreparationRow: View {
  let preparation: MockResult.Preparation

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(
        verbatim:
          "\(preparation.before.formatted(.percent.precision(.fractionLength(0)))) → \(preparation.after.formatted(.percent.precision(.fractionLength(0))))"
      )
      .font(.title2.weight(.semibold).monospacedDigit())
      ProgressView(value: preparation.after, total: 1)
        .tint(.success)
      Text(
        preparation.after > preparation.before
          ? String(
            localized: "What you showed in this mock exam counts toward it.", table: "Mock",
            comment: "Preparation went up")
          : String(
            localized: "The mock exam showed what's still missing.", table: "Mock",
            comment: "Preparation went down")
      )
      .font(.footnote)
      .foregroundStyle(.secondary)
    }
  }
}

private struct MockPlanSection: View {
  private enum Answer: Equatable {
    case declined
    case failed
    case outcome(MockPlanOfferOutcome)
  }

  @Environment(ExamStore.self) private var exam
  @State private var answers: [MockPlanOffer: Answer] = [:]
  @State private var applying = false
  let run: MockRun
  let adapt: MockAdapt
  let preparation: MockResult.Preparation?

  private var offers: [MockPlanOffer] {
    [adapt.skip != nil ? .skip : nil, adapt.focus != nil ? .focus : nil].compactMap { $0 }
  }

  private var open: [MockPlanOffer] {
    offers.filter { offer in
      switch answers[offer] {
      case nil, .failed: true
      default: false
      }
    }
  }

  var body: some View {
    Section {
      if let preparation, preparation.after != preparation.before {
        MockPreparationRow(preparation: preparation)
      }

      VStack(alignment: .leading, spacing: 6) {
        if let skip = adapt.skip {
          Text(
            "You got everything right in \(skip.topics.count) topics", tableName: "Mock",
            comment: "The mock showed topics the learner knows"
          )
          .font(.headline)
          Text(skip.topics.prefix(3).formatted(.list(type: .and)))
            .foregroundStyle(.secondary)
          if skip.topics.count > 3 {
            Text("\(skip.topics.count - 3) more topics", tableName: "Mock", comment: "More topics")
              .foregroundStyle(.secondary)
          }
          Label {
            Text("\(skip.lessons) lessons less", tableName: "Mock", comment: "Lessons off the plan")
          } icon: {
            Image(systemName: "minus.circle")
          }
          .foregroundStyle(.secondary)
        } else if let focus = adapt.focus {
          Text("Focus more on \(focus.area)?", tableName: "Mock", comment: "Offer to focus an area")
            .font(.headline)
        }

        if let focus = adapt.focus {
          Label {
            Text(
              "More time for \(focus.area) (\(MockLabels.number(focus.correct)) of \(focus.total) right)",
              tableName: "Mock", comment: "Offer to give an area more time")
          } icon: {
            Image(systemName: "plus.circle")
          }
          .foregroundStyle(.secondary)
        }
      }

      if open.isEmpty {
        ForEach(statusLines, id: \.self) { line in
          Text(line).foregroundStyle(.secondary)
        }
      } else {
        if answers.values.contains(.failed) {
          Text(
            "That didn't go through. Try again in a moment.", tableName: "Mock",
            comment: "Applying the plan change failed"
          )
          .foregroundStyle(.destructive)
        }

        HStack {
          Button {
            Task { await apply() }
          } label: {
            Text("Apply", tableName: "Mock", comment: "Applies the mock's plan change")
          }
          .buttonStyle(.bordered)
          .disabled(applying)

          Button {
            for offer in open { answers[offer] = .declined }
          } label: {
            Text("Keep my plan", tableName: "Mock", comment: "Declines the mock's plan change")
          }
          .buttonStyle(.borderless)
          .disabled(applying)
        }
      }
    } header: {
      Text("Your plan", tableName: "Mock", comment: "The plan after the mock")
    }
  }

  /// One after the other: both change the plan.
  private func apply() async {
    applying = true
    defer { applying = false }

    for offer in open {
      let blockId = run.mock.value?.blockId ?? ""
      let result = await exam.write(invalidating: [.goals, .learnerModel]) { api, token in
        try await api.adaptPlan(token: token, blockId: blockId, offer: offer)
      }

      switch result {
      case .done(let outcome): answers[offer] = .outcome(outcome)
      case .failed: answers[offer] = .failed
      case .obsolete: return
      }
    }
  }

  private var statusLines: [String] {
    let applied = answers.values.contains {
      if case .outcome(.applied) = $0 { return true }
      return false
    }

    var lines: [String] = []

    for offer in offers {
      switch answers[offer] {
      case .declined:
        if !applied {
          lines.append(
            String(localized: "Your plan stays as it is.", table: "Mock", comment: "Kept the plan"))
        }
      case .outcome(.applied(let skipped)):
        lines.append(
          offer == .skip
            ? String(
              localized: "Done: \(skipped) lessons off your plan.", table: "Mock",
              comment: "Lessons skipped")
            : String(
              localized: "Done: your plan gives it more time from now on.", table: "Mock",
              comment: "Focus applied"))
      case .outcome(.unchanged(let reason)):
        lines.append(
          offer == .skip
            ? String(
              localized: "Your plan already has every lesson of it, so nothing had to move.",
              table: "Mock", comment: "Nothing to skip")
            : reason == .cantMove
              ? String(
                localized: "It already starts as early as what it builds on allows.",
                table: "Mock", comment: "Focus can't move earlier")
              : String(
                localized: "Your plan already changed, so there's nothing left to do here.",
                table: "Mock", comment: "Focus already in"))
      case .failed, nil:
        break
      }
    }

    return Array(NSOrderedSet(array: lines)) as? [String] ?? lines
  }
}

private struct MockReviewSection: View {
  let items: [MockReviewItem]

  var body: some View {
    Section {
      ForEach(items) { item in
        DisclosureGroup {
          VStack(alignment: .leading, spacing: 8) {
            if let context = item.context {
              ItemText(context).font(.callout).foregroundStyle(.secondary)
            }
            ItemText(item.question)
            if item.outcome == .blank {
              Text("You left it blank.", tableName: "Mock", comment: "A blank question")
                .foregroundStyle(.secondary)
            } else if let answer = item.learnerAnswer {
              Label {
                Text(answer)
              } icon: {
                Image(systemName: "xmark").foregroundStyle(.destructive)
              }
            }
            if let correct = item.correctAnswer {
              Label {
                Text(correct)
              } icon: {
                Image(systemName: "checkmark").foregroundStyle(.success)
              }
            }
            if item.outcome == .partial {
              Text(
                "Partly right: it earned part of its points.", tableName: "Mock",
                comment: "A partly right answer"
              )
              .foregroundStyle(.secondary)
            }
            if let explanation = item.explanation {
              ItemText(explanation).font(.callout).foregroundStyle(.secondary)
            }
          }
        } label: {
          VStack(alignment: .leading, spacing: 2) {
            Group {
              if let area = item.area {
                Text("Question \(item.number) · \(area)", tableName: "Mock", comment: "Review")
              } else {
                Text("Question \(item.number)", tableName: "Mock", comment: "A question by number")
              }
            }
            .font(.caption.monospaced())
            .foregroundStyle(.secondary)
            Text(ItemTextBlock.plain(item.question))
              .lineLimit(2)
          }
        }
      }
    } header: {
      Text("Questions to review", tableName: "Mock", comment: "The mock's questions to review")
    }
  }
}

private struct MockNotesSection: View {
  let view: MockView

  var body: some View {
    let lines = leftOutLines

    if !lines.isEmpty || short != nil || view.sizeSource.pastEdition != nil
      || view.sizeSource.questions != .notice || view.sizeSource.time != .notice
      || view.sizeSource.subjects == .even || view.sizeSource.formats == .even
    {
      Section {
      } footer: {
        VStack(alignment: .leading, spacing: 4) {
          MockSizeNote(
            document: view.examDocument, minutes: view.minutes, questions: view.questions,
            source: view.sizeSource)
          if let short { Text(short) }
          ForEach(lines, id: \.self) { Text($0) }
        }
      }
    }
  }

  private var short: String? {
    guard let examQuestions = view.examQuestions, examQuestions > view.questions else { return nil }
    return String(
      localized:
        "This mock asks \(view.questions) of \(examQuestions) questions: there weren't enough new ones yet.",
      table: "Mock", comment: "A mock that asked fewer questions than the exam")
  }

  private var leftOutLines: [String] {
    view.leftOut.map { leftOut in
      switch (leftOut.part, leftOut.name) {
      case (.listening, let name?), (.speaking, let name?):
        String(localized: "\(name) isn't in mocks yet.", table: "Mock", comment: "A left-out part")
      case (.listening, nil):
        String(localized: "Listening isn't in mocks yet.", table: "Mock", comment: "Left out")
      case (.speaking, nil):
        String(
          localized: "The speaking part isn't in mocks yet.", table: "Mock", comment: "Left out")
      case (.practical, let name?):
        String(
          localized: "\(name) can't be part of a mock: it's a practical test.", table: "Mock",
          comment: "A practical part left out")
      case (.practical, nil):
        String(
          localized: "The exam's practical test can't be part of a mock.", table: "Mock",
          comment: "A practical test left out")
      case (.numeric, _):
        String(
          localized: "Questions answered with a number are asked as multiple choice.",
          table: "Mock", comment: "Numeric questions asked as choices")
      case (.shortAnswer, _):
        String(
          localized: "Questions answered in a few words are asked as multiple choice.",
          table: "Mock", comment: "Short answers asked as choices")
      case (.written, let name):
        String(
          localized:
            "There's no essay for \(name ?? "") yet, so you practice it in your essay sessions.",
          table: "Mock", comment: "A written part without an essay yet")
      case (.writtenInFull, let name):
        String(
          localized: "\(name ?? "") is only in full mocks.", table: "Mock",
          comment: "A written part only full mocks ask")
      }
    }
  }
}
