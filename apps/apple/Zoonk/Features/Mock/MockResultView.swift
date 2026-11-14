import SwiftUI

/// What the learner opened and chose on a result. Kept above its pages, so folding or unfolding
/// iPhone Duo keeps it.
private struct MockResultChoices {
  var showsDetails = false
  var opened: Set<String> = []
  var essayComments: [String: Set<String>] = [:]
  var plan = MockPlanAnswers()
  var speakingTask: MockSpeaking.Task?
  /// The question to review at the top of its list where the learner last left it, nil at the
  /// list's start: either layout opens the list there.
  var reviewPlace: String?
}

/// The questions to review, and the header over them, on one list's screen.
@Observable
private final class ReviewRows {
  var shown: Set<String> = []

  func update(_ id: String, isShown: Bool) {
    if isShown {
      shown.insert(id)
    } else {
      shown.remove(id)
    }
  }
}

extension EnvironmentValues {
  @Entry fileprivate var reviewRows: ReviewRows?
}

private let reviewHeader = "questions-to-review"

/// The list holding the questions to review, which folding makes again: it opens where the
/// learner left them. The place settles once its rows stop moving, since a `List` reports no
/// scroll phases; a list taken away by a fold settles nothing, as its task ends with it.
private struct ReviewList<Content: View>: View {
  let review: [MockReviewItem]
  @Binding var place: String?
  @ViewBuilder let content: Content

  @State private var rows = ReviewRows()

  var body: some View {
    let shown = rows.shown
    let top = shown.contains(reviewHeader) ? nil : review.first { shown.contains($0.id) }?.id

    ScrollViewReader { proxy in
      ZoonkList {
        content
      }
      .environment(\.reviewRows, rows)
      // At its first size, and again as unfolding resizes it, which scrolls it away.
      .onGeometryChange(for: CGSize.self) {
        $0.size
      } action: { _ in
        if let place {
          proxy.scrollTo(place, anchor: .top)
        }
      }
      .task(id: top) {
        try? await Task.sleep(for: .milliseconds(300))

        if !Task.isCancelled {
          place = top
        }
      }
    }
  }
}

struct MockResultView: View {
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss
  @State private var choices = MockResultChoices()
  let run: MockRun
  let view: MockView

  var body: some View {
    PaneSplit {
      ZoonkList {
        scoreSections
        diagnosisSections
        partSections
      }
    } secondary: {
      ReviewList(review: view.review, place: $choices.reviewPlace) {
        planSections
        reviewSections
      }
      .bottomBar { actions }
    } single: {
      ReviewList(review: view.review, place: $choices.reviewPlace) {
        scoreSections
        diagnosisSections
        partSections
        planSections
        reviewSections
      }
      .bottomBar { actions }
    }
    .announcesStatus(gradesEssays ? MockEssaySections.grading : nil)
    .navigationTitle(MockLabels.title(number: view.number))
    .completionMoments(view.day)
    .toolbar {
      if view.purpose != .placement {
        TutorAskToolbarItem(scope: .mock(blockId: view.blockId))
      }
    }
    .sheet(isPresented: $choices.showsDetails) { details }
    .sheet(item: $choices.speakingTask) { task in
      ConversationScreen(conversationId: task.conversationId)
        .zoonkStyles()
    }
  }

  private var gradesEssays: Bool {
    run.essayGrading == .grading && view.essays.contains { $0.status == .pending }
  }

  @ViewBuilder
  private var scoreSections: some View {
    if let result = view.result, result.total > 0 || (view.essays.isEmpty && view.speaking == nil) {
      MockScoreSections(view: view, result: result, part: .score)
    }
  }

  /// The areas and what the mock showed.
  @ViewBuilder
  private var diagnosisSections: some View {
    if let result = view.result {
      if result.areas.count > 1 {
        MockAreaSection(result: result, opened: $choices.opened)
      } else if result.topics.count > 1 {
        Section {
          MockTopicRows(topics: result.topics, opened: $choices.opened.contains("topics"))
        } header: {
          SectionTitle(Text("By topic", tableName: "Mock", comment: "Each topic's result"))
        }
      }

      Section {
        Button {
          choices.showsDetails = true
        } label: {
          Text(
            "Details", tableName: "Mock",
            comment: "Opens everything else about a mock exam's result")
        }
        .buttonStyle(.outline)
        .controlSize(.small)
        .listRowSeparator(.hidden)
      }
    }
  }

  /// Main's `Details` drawer: the answers, each test, what it takes to pass, what stood out and
  /// every caveat, said once.
  private var details: some View {
    NavigationStack {
      ZoonkList {
        if let result = view.result {
          MockScoreSections(view: view, result: result, part: .details)
          MockInsightsSection(result: result)
        }

        MockNotesSection(view: view)
      }
      .navigationTitle(
        Text("Details", tableName: "Mock", comment: "Title of a mock exam's details")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            choices.showsDetails = false
          }
        }
      }
    }
    .zoonkStyles()
  }

  @ViewBuilder
  private var partSections: some View {
    DayMomentSections(result: view.day)

    ForEach(Array(view.essays.enumerated()), id: \.element.id) { index, essay in
      MockEssaySections(
        run: run, essay: essay, number: index + 1, total: view.essays.count,
        rubric: view.essayRubric ?? .custom,
        openCriteria: Binding {
          choices.essayComments[essay.id] ?? []
        } set: {
          choices.essayComments[essay.id] = $0
        })
    }

    if let speaking = view.speaking {
      MockSpeakingSection(paper: speaking) { choices.speakingTask = $0 }
    }
  }

  @ViewBuilder
  private var planSections: some View {
    if let adapt = view.adapt, adapt.skip != nil || adapt.focus != nil {
      MockPlanSection(
        run: run, adapt: adapt, preparation: view.result?.preparation,
        answers: $choices.plan)
    } else if let preparation = view.result?.preparation, preparation.after != preparation.before {
      MockPreparationSection(preparation: preparation)
    }
  }

  @ViewBuilder
  private var reviewSections: some View {
    if !view.review.isEmpty {
      MockReviewSection(
        items: view.review, labels: view.trueFalseLabels, opened: $choices.opened)
    }

  }

  @ViewBuilder
  private var actions: some View {
    secondaryAction
    mainAction
  }

  /// The questions answered wrong: the ones to fix. Blanks are reviewed but aren't mistakes.
  private var mistakes: Int {
    view.review.filter { $0.outcome != .blank }.count
  }

  @ViewBuilder
  private var mainAction: some View {
    Group {
      // Onboarding is under a placement mock: its plan starts from these answers.
      if view.purpose == .placement || mistakes == 0 {
        Button {
          dismiss()
        } label: {
          Text("Continue", tableName: "Mock", comment: "Leaves a mock's result")
        }
      } else {
        Button {
          router.open(.mistakes)
        } label: {
          Text("Review mistakes", tableName: "Mock", comment: "Opens the notebook")
        }
      }
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
  }

  @ViewBuilder
  private var secondaryAction: some View {
    if mistakes > 0, view.purpose != .placement {
      Button {
        dismiss()
      } label: {
        Text("Not now", tableName: "Mock", comment: "Leaves without reviewing")
      }
      .buttonStyle(.outline)
    }
  }
}

private struct MockScoreSections: View {
  enum Part {
    /// The number and what it means, first on the page.
    case score
    /// Everything else, in Details.
    case details
  }

  let view: MockView
  let result: MockResult
  let part: Part

  var body: some View {
    switch part {
    case .score: scoreSection
    case .details: detailSections
    }
  }

  private var scoreSection: some View {
    Section {
      VStack(alignment: .leading, spacing: 6) {
        Chip(Text(MockLabels.title(number: view.number)))
          .padding(.bottom, 6)
        Text(score.value)
          .typeStyle(.momentReadout)
        Text(detail)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        if let delta {
          Label {
            Text(delta.text)
          } icon: {
            Image(
              systemName: delta.up ? "chart.line.uptrend.xyaxis" : "chart.line.downtrend.xyaxis")
          }
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
        }

        if let verdict {
          Text(verdict)
            .typeStyle(.body.weight(.medium))
            .foregroundStyle(Color(.foreground))
            .padding(.top, 4)
        }
      }
      .padding(.vertical, 4)
      .accessibilityElement(children: .combine)
    }
  }

  @ViewBuilder
  private var detailSections: some View {
    if let counts {
      Section {
        IconLabeledContent {
          Text(counts.right, format: .number)
        } title: {
          Text("Right", tableName: "Mock", comment: "Right answers")
        } icon: {
          Image(systemName: "checkmark").foregroundStyle(.success)
        }
        IconLabeledContent {
          Text(counts.wrong, format: .number)
        } title: {
          Text("Wrong", tableName: "Mock", comment: "Wrong answers")
        } icon: {
          Image(systemName: "xmark").foregroundStyle(.destructive)
        }
        if counts.partial > 0 {
          IconLabeledContent {
            Text(counts.partial, format: .number)
          } title: {
            Text("Partly right", tableName: "Mock", comment: "Partly right answers")
          } icon: {
            Image(systemName: "circle.dashed")
          }
        }
        IconLabeledContent {
          Text(counts.blank, format: .number)
        } title: {
          Text("Blank", tableName: "Mock", comment: "Blank answers")
        } icon: {
          Image(systemName: "minus")
        }
      } footer: {
        SectionFooter {
          if result.net == nil, result.blank > 0 {
            blankNote
          }
        }
      }
      .monospacedDigit()
    }

    if counts == nil, result.net == nil, result.blank > 0 {
      Section {
      } footer: {
        SectionFooter {
          blankNote
        }
      }
    }

    if let points = result.points, points.hasTests {
      MockPointsSection(points: points)
    }

    if let passMarks = view.passMarks {
      Section {
        ForEach(passMarks.texts, id: \.self) { text in
          Text(text)
            .environment(\.locale, Locale(identifier: passMarks.language))
        }
      } header: {
        SectionTitle(Text("To pass", tableName: "Mock", comment: "Pass marks header"))
      }
    }

    if let note = scoreNote {
      Section {
        Text(note)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      } header: {
        SectionTitle(
          Text("About this mock exam", tableName: "Mock", comment: "Every caveat about a mock exam")
        )
      }
    }
  }

  private var blankNote: Text {
    Text("Blank answers count as wrong.", tableName: "Mock", comment: "Blank answers in a score")
  }

  /// Main's one sentence under the number: every minimum reached, or the best and worst subjects.
  private var verdict: String? {
    let shares = result.areas.filter { $0.total > 0 }.map {
      (name: $0.name, share: $0.correct / Double($0.total))
    }
    .sorted { $0.share > $1.share }

    guard shares.count > 1, let best = shares.first, let worst = shares.last,
      shares[1].share < best.share, shares[shares.count - 2].share > worst.share
    else { return nil }

    return String(
      localized: "Strongest: \(best.name). Work on: \(worst.name).", table: "Mock",
      comment: "Under a mock exam's score: its best and worst subjects")
  }

  private var score: (label: String, value: String) {
    if let points = result.points {
      return (
        String(localized: "Points", table: "Mock", comment: "Label of a mock's score in points"),
        MockLabels.points(points.earned, of: points.asked)
      )
    }

    if let irt = result.irt {
      return (
        view.examName.map {
          String(
            localized: "Estimated \($0) score", table: "Mock",
            comment: "An estimated score's label; the argument is the exam's name")
        } ?? String(localized: "Estimated score", table: "Mock", comment: "An IRT score's label"),
        MockLabels.range(low: irt.low, high: irt.high)
      )
    }

    if let net = result.net {
      return (
        String(
          localized: "Score out of \(net.max)", table: "Mock", comment: "A net score's label"),
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

  /// One line that names the number.
  private var detail: String { score.label }

  private var delta: (text: String, up: Bool)? {
    // The change measures right answers, never points, so a points headline can't take it.
    guard let change = result.change, result.points == nil else {
      return nil
    }

    return change > 0
      ? (
        String(
          localized: "+\(change) since the last one", table: "Mock",
          comment: "Score went up since the learner's previous mock exam"),
        true
      )
      : (
        String(
          localized: "\(MockLabels.number(Double(change))) since the last one", table: "Mock",
          comment: "Score went down since the learner's previous mock exam"),
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
          localized: "The real exam ranks you against the other candidates.",
          table: "Mock", comment: "A relative exam score"))
      lines.append(
        String(
          localized: "This mock exam shows how many you got right.", table: "Mock",
          comment: "What a mock of a relative exam shows"))
    }

    return lines.isEmpty ? nil : lines.joinedSentences()
  }
}

private struct MockAreaSection: View {
  let result: MockResult
  @Binding var opened: Set<String>

  var body: some View {
    Section {
      ForEach(result.areas, id: \.name) { area in
        let topics = result.topics.filter { $0.area == area.name }

        if topics.isEmpty {
          row(area)
        } else {
          DisclosureGroup(isExpanded: $opened.contains("area:\(area.name)")) {
            MockTopicRows(topics: topics, opened: $opened.contains("topics:\(area.name)"))
          } label: {
            row(area)
          }
        }
      }
    } header: {
      SectionTitle(Text("By subject", tableName: "Mock", comment: "Each subject's result"))
    }
  }

  private func row(_ area: MockResult.Area) -> some View {
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

      Meter(value: area.correct, total: Double(max(area.total, 1)), fill: .success)
        .accessibilityHidden(true)
    }
  }
}

/// The weakest topics first; past the first five, the rest open on a tap.
private struct MockTopicRows: View {
  private static let shown = 5

  let topics: [MockResult.Topic]
  @Binding var opened: Bool

  var body: some View {
    let sorted = topics.sorted { first, second in
      let firstShare = Double(first.correct) / Double(max(first.total, 1))
      let secondShare = Double(second.correct) / Double(max(second.total, 1))
      return firstShare == secondShare ? first.total > second.total : firstShare < secondShare
    }
    let rest = sorted.dropFirst(Self.shown)

    ForEach(sorted.prefix(Self.shown)) { topic in
      row(topic)
    }

    if !rest.isEmpty {
      DisclosureGroup(isExpanded: $opened) {
        ForEach(rest) { topic in
          row(topic)
        }
      } label: {
        Text("\(rest.count) more topics", tableName: "Mock", comment: "More topics")
          .foregroundStyle(.mutedForeground)
      }
    }
  }

  private func row(_ topic: MockResult.Topic) -> some View {
    LabeledContent {
      Text(
        "\(topic.correct) of \(topic.total)", tableName: "Mock",
        comment: "A topic's right answers"
      )
      .monospacedDigit()
    } label: {
      Text(topic.name)
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
            Text("Easy questions", tableName: "Mock", comment: "Insight about IRT coherence"),
            systemImage: "scalemass"
          ) {
            Text(
              "You missed \(coherence.easyWrong) easy questions. Review those first.",
              tableName: "Mock", comment: "IRT coherence: easy questions answered wrong")
          }
        }

        if let calibration = unsure {
          insight(
            Text("Flagged answers", tableName: "Mock", comment: "Insight about unsure"),
            systemImage: "scalemass"
          ) {
            Text(
              "Not flagged: \(calibration.sure.right) of \(calibration.sure.answered) right. Flagged: \(calibration.unsure.right) of \(calibration.unsure.answered) right.",
              tableName: "Mock",
              comment:
                "How many of the answers the learner was sure of were right, against those flagged as unsure"
            )
            if calibration.advice == .blankUnsure {
              Text(
                "Leaving the flagged ones blank would have added \(Int(calibration.blankingGain.rounded())) points.",
                tableName: "Mock", comment: "What blanking unsure answers would have gained")
            } else if calibration.advice == .keepAnswering {
              Text(
                "Your flagged answers still earned points, so keep answering them.",
                tableName: "Mock", comment: "Keep answering unsure ones")
            }
          }
        }
      } header: {
        SectionTitle(
          Text("What stood out", tableName: "Mock", comment: "The mock's insights"))
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
        title.typeStyle(.body.weight(.semibold))
        content().foregroundStyle(.mutedForeground)
      }
    } icon: {
      Image(systemName: systemImage)
    }
  }
}

private struct MockEssaySections: View {
  static var grading: String {
    String(
      localized: "Grading it with the exam's rubric. It can take up to 30 seconds.", table: "Mock",
      comment: "An essay is being graded")
  }

  let run: MockRun
  let essay: MockEssay
  let number: Int
  let total: Int
  let rubric: EssayRubric
  @Binding var openCriteria: Set<String>

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 6) {
        LessonTextBlocks(essay.question)
          .typeStyle(.body.weight(.semibold))
        status
      }
    } header: {
      if total > 1 {
        SectionTitle(
          Text(
            "Written part\u{00A0}· \(number) of \(total)", tableName: "Mock",
            comment: "Essay of essays"))
      } else {
        SectionTitle(Text("Written part", tableName: "Mock", comment: "A full mock's essay part"))
      }
    }

    if let grade = essay.grade {
      EssayGradeSections(grade: grade)
      EssayCommentsSection(grade: grade, openCriteria: $openCriteria)
    }
  }

  @ViewBuilder
  private var status: some View {
    switch essay.status {
    case .blank:
      Text("You left it blank.", tableName: "Mock", comment: "A blank essay")
        .foregroundStyle(.mutedForeground)
    case .graded:
      EmptyView()
    case .pending:
      switch run.essayGrading {
      case .grading:
        Label {
          Text(Self.grading)
        } icon: {
          ProgressView()
        }
        .foregroundStyle(.mutedForeground)
      case .limitReached:
        Text(
          "You've used today's essay grades. Try again tomorrow.", tableName: "Mock",
          comment: "No essay grades left today"
        )
        .foregroundStyle(.mutedForeground)
      case .failed, .idle:
        if run.essayGrading == .failed {
          FailureLine(
            message: LocalizedStringResource(
              "That didn't go through. Try again in a moment.", table: "Mock",
              comment: "Grading failed"))
        } else {
          Text("It hasn't been graded yet.", tableName: "Mock", comment: "An ungraded essay")
            .foregroundStyle(.mutedForeground)
        }
        Button {
          Task { await run.gradeEssays() }
        } label: {
          Text("Grade it", tableName: "Mock", comment: "Grades a mock's essays")
        }
        .buttonStyle(.outline)
      }
    }
  }
}

private struct MockSpeakingSection: View {
  let paper: MockSpeaking
  let open: (MockSpeaking.Task) -> Void

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 6) {
        Text(estimateTitle)
          .typeStyle(.readout)
        Group {
          Text(estimateDetail)
          if paper.estimate.typed, paper.estimate.points != nil {
            Text(
              "You typed in at least one task, so the estimate leaves out how you sounded there.",
              tableName: "Mock", comment: "A speaking estimate with a typed task")
          }
          if let passRule {
            Text(passRule)
          }
        }
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
      .padding(.vertical, 4)

      ForEach(paper.tasks) { task in
        LabeledContent {
          if task.status == .completed {
            Button {
              open(task)
            } label: {
              Text("See feedback", tableName: "Mock", comment: "Opens a speaking task's result")
            }
            .buttonStyle(.outline)
          } else {
            Text("Not done", tableName: "Mock", comment: "A speaking task left undone")
          }
        } label: {
          Text(task.name)
        }
      }
    } header: {
      SectionTitle(Text(paper.paper))
    }
  }

  private var estimateTitle: String {
    guard let points = paper.estimate.points else {
      return String(localized: "No estimate", table: "Mock", comment: "A speaking paper's estimate")
    }

    let total = number(paper.estimate.total)

    if points.low == points.high {
      return String(
        localized: "About \(number(points.low)) of \(total)", table: "Mock",
        comment: "A speaking paper's estimated points")
    }

    return String(
      localized: "About \(number(points.low)) to \(number(points.high)) of \(total)",
      table: "Mock", comment: "A speaking paper's estimated points range")
  }

  private func number(_ value: Double) -> String {
    value.formatted(.number.precision(.fractionLength(0...1)))
  }

  private var estimateDetail: String {
    if paper.estimate.points != nil {
      return String(
        localized: "An estimate, not an official score.", table: "Mock",
        comment: "Under a speaking paper's estimate")
    }

    if paper.tasks.contains(where: { $0.status != .completed }) {
      return String(
        localized: "Not every task was done, so there's no estimate for this paper.",
        table: "Mock", comment: "A speaking paper with tasks left undone")
    }

    if paper.estimate.typed {
      return String(
        localized:
          "You typed in at least one task, and typing shows nothing of how you sound, so the speaking part has no estimate. Speak every task next time to get one.",
        table: "Mock", comment: "A speaking paper with a typed task")
    }

    return String(
      localized: "A task couldn't be graded, so the speaking part has no estimate.", table: "Mock",
      comment: "A speaking paper with a task that couldn't be graded")
  }

  private var passRule: String? {
    switch paper.pass {
    case .group(let min, let of):
      String(
        localized:
          "The exam asks for at least \(MockLabels.number(min)) of \(MockLabels.number(of)) on this paper and listening together.",
        table: "Mock", comment: "A speaking paper's pass mark shared with listening")
    case .paper(let min):
      String(
        localized: "The exam asks for at least \(MockLabels.number(min)) on this paper.",
        table: "Mock", comment: "A speaking paper's own pass mark")
    case .floor(let min):
      String(
        localized:
          "Below \(MockLabels.number(min)) on this paper, the whole exam isn't passed.",
        table: "Mock", comment: "A speaking paper's floor for the whole exam")
    case .none:
      nil
    }
  }
}

private struct MockPreparationSection: View {
  let preparation: MockResult.Preparation

  var body: some View {
    Section {
      MockPreparationRow(preparation: preparation)
    } header: {
      SectionTitle(Text("Your preparation", tableName: "Mock", comment: "How preparation moved"))
    }
  }
}

private struct MockPreparationRow: View {
  let preparation: MockResult.Preparation

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(verbatim: percent(preparation.after))
        .typeStyle(.readout)
      Meter(value: preparation.after, total: 1, fill: .success)
      Text(
        preparation.after > preparation.before
          ? String(
            localized: "Up from \(percent(preparation.before))", table: "Mock",
            comment: "Preparation went up from this percent")
          : String(
            localized: "Down from \(percent(preparation.before))", table: "Mock",
            comment: "Preparation went down from this percent")
      )
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)
    }
    .accessibilityElement(children: .combine)
  }

  private func percent(_ share: Double) -> String {
    share.formatted(.percent.precision(.fractionLength(0)))
  }
}

private struct MockPlanAnswers {
  enum Answer: Equatable {
    case declined
    case failed
    case outcome(MockPlanOfferOutcome)
  }

  var byOffer: [MockPlanOffer: Answer] = [:]
  var applying = false
}

private struct MockPlanSection: View {
  @Environment(ExamStore.self) private var exam
  let run: MockRun
  let adapt: MockAdapt
  let preparation: MockResult.Preparation?
  @Binding var answers: MockPlanAnswers

  private var offers: [MockPlanOffer] {
    [adapt.skip != nil ? .skip : nil, adapt.focus != nil ? .focus : nil].compactMap { $0 }
  }

  private var open: [MockPlanOffer] {
    offers.filter { offer in
      switch answers.byOffer[offer] {
      case nil, .failed: true
      default: false
      }
    }
  }

  /// The first question nobody answered; the second appears once the first is answered.
  private var asking: MockPlanOffer? { open.first }

  var body: some View {
    if let preparation, preparation.after != preparation.before {
      Section {
        MockPreparationRow(preparation: preparation)
      } header: {
        SectionTitle(Text("Your preparation", tableName: "Mock", comment: "How preparation moved"))
      }
    }

    Section {
      if let offer = asking {
        VStack(alignment: .leading, spacing: 4) {
          question(offer)
            .typeStyle(.body.weight(.semibold))
          line(offer)
            .foregroundStyle(.mutedForeground)
        }

        if answers.byOffer[offer] == .failed {
          FailureLine(
            message: LocalizedStringResource(
              "That didn't go through. Try again in a moment.", table: "Mock",
              comment: "Applying the plan change failed"))
        }

        ButtonRow {
          BusyButton(isBusy: answers.applying) {
            Task { await apply(offer) }
          } label: {
            offer == .skip
              ? Text(
                "Skip them", tableName: "Mock", comment: "Takes the known lessons off the plan")
              : Text("Change my plan", tableName: "Mock", comment: "Gives a subject more time")
          }
          .buttonStyle(.outline)

          Button {
            answers.byOffer[offer] = .declined
          } label: {
            offer == .skip
              ? Text("Keep them", tableName: "Mock", comment: "Keeps the known lessons")
              : Text("Not now", tableName: "Mock", comment: "Leaves without reviewing")
          }
          .buttonStyle(.borderless)
          .disabled(answers.applying)
        }
      }

      ForEach(statusLines, id: \.self) { line in
        Text(line).foregroundStyle(.mutedForeground)
      }
    }
    .announcesStatus(statusLines.isEmpty ? nil : statusLines.joinedSentences())
  }

  private func question(_ offer: MockPlanOffer) -> Text {
    switch offer {
    case .skip:
      Text(
        "Skip \(adapt.skip?.lessons ?? 0) lessons you already know?", tableName: "Mock",
        comment: "Offer to take lessons the mock exam showed the learner knows off the plan")
    case .focus:
      Text(
        "Focus more on \(adapt.focus?.area ?? "")?", tableName: "Mock",
        comment: "Offer to focus an area")
    }
  }

  private func line(_ offer: MockPlanOffer) -> Text {
    switch offer {
    case .skip:
      let topics = adapt.skip?.topics ?? []
      let names =
        topics.count > 3
        ? String(
          localized:
            "\(topics.prefix(3).formatted(.list(type: .and))) and \(topics.count - 3) more topics",
          table: "Mock", comment: "Three topics' names and how many more")
        : topics.formatted(.list(type: .and))
      return Text(
        "You got everything right in \(names).", tableName: "Mock",
        comment: "Why the mock exam offers to skip lessons; the argument names the topics")
    case .focus:
      return Text(
        "You got \(MockLabels.number(adapt.focus?.correct ?? 0)) of \(adapt.focus?.total ?? 0) right there.",
        tableName: "Mock", comment: "Why the mock exam offers more time for a subject")
    }
  }

  private func apply(_ offer: MockPlanOffer) async {
    answers.applying = true
    defer { answers.applying = false }

    let blockId = run.mock.value?.blockId ?? ""
    let result = await exam.write(invalidating: [.goals, .learnerModel]) { api, token in
      try await api.adaptPlan(token: token, blockId: blockId, offer: offer)
    }

    switch result {
    case .done(let outcome): answers.byOffer[offer] = .outcome(outcome)
    case .failed: answers.byOffer[offer] = .failed
    case .obsolete: return
    }
  }

  /// After a yes, what changed; after a no, nothing.
  private var statusLines: [String] {
    offers.compactMap { offer -> String? in
      switch answers.byOffer[offer] {
      case .outcome(.applied(let skipped)):
        offer == .skip
          ? String(
            localized: "\(skipped) lessons skipped.", table: "Mock", comment: "Lessons skipped")
          : String(
            localized: "Your plan gives \(adapt.focus?.area ?? "") more time.", table: "Mock",
            comment: "Focus applied")
      case .outcome(.unchanged):
        String(
          localized: "Your plan didn't need to change.", table: "Mock",
          comment: "A plan change the plan already had")
      case .declined, .failed, nil:
        nil
      }
    }
  }
}

private struct MockReviewSection: View {
  @Environment(\.reviewRows) private var rows

  let items: [MockReviewItem]
  let labels: PracticeTrueFalseLabels
  @Binding var opened: Set<String>

  var body: some View {
    Section {
      ForEach(items) { item in
        DisclosureGroup(isExpanded: $opened.contains("review:\(item.id)")) {
          VStack(alignment: .leading, spacing: 8) {
            if let context = item.context {
              LessonTextBlocks(context).typeStyle(.reading).foregroundStyle(.mutedForeground)
            }
            LessonTextBlocks(item.question)
            if item.outcome == .blank {
              Text("You left it blank.", tableName: "Mock", comment: "A blank question")
                .foregroundStyle(.mutedForeground)
            } else if let answer = TrueFalseWords.savedAnswer(
              item.learnerAnswer, format: item.format, labels: labels)
            {
              Label {
                answerText(answer, of: item)
              } icon: {
                Image(systemName: "xmark").foregroundStyle(.destructive)
              }
            }
            if let correct = TrueFalseWords.savedAnswer(
              item.correctAnswer, format: item.format, labels: labels)
            {
              Label {
                answerText(correct, of: item)
              } icon: {
                Image(systemName: "checkmark").foregroundStyle(.success)
              }
            }
            if item.outcome == .partial {
              Text(
                "Partly right: it earned part of its points.", tableName: "Mock",
                comment: "A partly right answer"
              )
              .foregroundStyle(.mutedForeground)
            }
            if let explanation = item.explanation {
              LessonTextBlocks(explanation).typeStyle(.reading).foregroundStyle(.mutedForeground)
            }
            if let citation = item.citation {
              CitationNote(citation: citation)
            }
          }
        } label: {
          VStack(alignment: .leading, spacing: 2) {
            Group {
              if let area = item.area {
                Chip(
                  Text(
                    "Question \(item.number)\u{00A0}· \(area)", tableName: "Mock",
                    comment: "Review"))
              } else {
                Chip(
                  Text(
                    "Question \(item.number)", tableName: "Mock", comment: "A question by number")
                )
              }
            }
            .padding(.bottom, 4)
            LessonRichText(item.question)
              .lineLimit(2)
          }
        }
        .id(item.id)
        .onScrollVisibilityChange(threshold: 0.5) { rows?.update(item.id, isShown: $0) }
      }
    } header: {
      SectionTitle(
        Text("Questions to review", tableName: "Mock", comment: "The mock's questions to review")
      )
      .onScrollVisibilityChange(threshold: 0.5) { rows?.update(reviewHeader, isShown: $0) }
    }
  }

  /// A typed answer is plain text, so `__init__` keeps its underscores.
  @ViewBuilder
  private func answerText(_ text: String, of item: MockReviewItem) -> some View {
    if item.format == "typed" {
      Text(verbatim: text)
    } else {
      LessonRichText(text)
    }
  }
}

private struct MockNotesSection: View {
  let view: MockView

  var body: some View {
    let lines = view.leftOut.compactMap(MockLabels.leftOut)

    if !lines.isEmpty || short != nil || view.sizeSource.pastEdition != nil
      || view.sizeSource.questions != .notice || view.sizeSource.time != .notice
      || view.sizeSource.subjects == .even || view.sizeSource.formats == .even
    {
      Section {
      } footer: {
        SectionFooter {
          VStack(alignment: .leading, spacing: 4) {
            MockSizeNote(
              minutes: view.minutes, questions: view.questions,
              source: view.sizeSource)
            if let short { Text(short) }
            ForEach(lines, id: \.self) { Text($0) }
          }
        }
      }
    }
  }

  private var short: String? {
    guard let examQuestions = view.examQuestions, examQuestions > view.questions else { return nil }
    return String(
      localized:
        "This mock exam had \(view.questions) of the exam's \(examQuestions) questions.",
      table: "Mock", comment: "A mock that asked fewer questions than the exam")
  }
}
