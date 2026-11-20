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
        planSections(answersInBar: false)
        reviewSections
      }
      .bottomBar { actions }
    } single: {
      ReviewList(review: view.review, place: $choices.reviewPlace) {
        scoreSections
        diagnosisSections
        partSections
        planSections(answersInBar: true)
        reviewSections
      }
      .bottomBar {
        if let offer = choices.plan.asking(view.adapt) {
          MockPlanAnswerButtons(run: run, offer: offer, inBar: true, answers: $choices.plan)
        } else {
          actions
        }
      }
    }
    .announcesStatus(gradesEssays ? MockEssaySections.grading : nil)
    .navigationTitle(MockLabels.title(number: view.number))
    .completionMoments(view.day)
    .toolbar {
      if hasDetails {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            choices.showsDetails = true
          } label: {
            Text("Details", tableName: "Mock")
          }
        }
      }

      if view.purpose != .placement {
        TutorAskToolbarItem(scope: .mock(blockId: view.blockId))
      }
    }
    .sheet(isPresented: $choices.showsDetails) { details }
    .sheet(item: $choices.speakingTask) { task in
      ConversationScreen(conversationId: task.conversationId)
        .zoonkSheet()
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

  /// How the answers went, then the areas.
  @ViewBuilder
  private var diagnosisSections: some View {
    if let result = view.result {
      MockAnswersSection(result: result)

      if result.areas.count > 1 {
        MockAreaSection(result: result, opened: $choices.opened)
      } else if result.topics.count > 1 {
        Section {
          MockTopicRows(topics: result.topics, opened: $choices.opened.contains("topics"))
        } header: {
          SectionTitle(Text("By topic", tableName: "Mock", comment: "Each topic's result"))
        }
      }
    }
  }

  /// Main's `Details` holds something only then; a mock with nothing behind its number has no way in.
  private var hasDetails: Bool {
    guard let result = view.result else { return false }

    return result.points?.hasTests == true || view.passMarks != nil
      || MockInsightsSection(result: result).hasInsights
      || MockScoreSections(view: view, result: result, part: .details).hasScoreNote
      || MockNotesSection(view: view).hasNotes
  }

  /// Main's `Details` drawer: each test, what it takes to pass, what stood out and every caveat,
  /// said once.
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
      .sheetClose { choices.showsDetails = false }
    }
    .zoonkSheet()
  }

  @ViewBuilder
  private var partSections: some View {
    // A missed minimum's headline isn't followed by a celebration; the day's summary still shows it.
    if view.result?.points?.missedMinimum == nil {
      DayMomentSections(result: view.day)
    }

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
  private func planSections(answersInBar: Bool) -> some View {
    if let adapt = view.adapt, adapt.skip != nil || adapt.focus != nil {
      MockPlanSection(
        run: run, adapt: adapt, preparation: view.result?.preparation,
        answersInBar: answersInBar, answers: $choices.plan)
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

  /// The questions answered wrong: the ones to fix. Blanks and right answers the learner wasn't
  /// sure of are reviewed but aren't mistakes.
  private var mistakes: Int {
    view.review.filter { $0.outcome == .wrong || $0.outcome == .partial }.count
  }

  /// With mistakes to fix, reviewing them is the way on and leaving the other one, as on main.
  private var reviewsMistakes: Bool { mistakes > 0 && view.purpose != .placement }

  @ViewBuilder
  private var mainAction: some View {
    if reviewsMistakes {
      Button {
        router.open(.mistakes)
      } label: {
        Text(
          LocalizedStringResource(
            "practiceMistakesAction", defaultValue: "Practice mistakes", table: "Practice",
            comment: "Opens practice on the mistakes that are ready to fix."))
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    } else {
      Button {
        dismiss()
      } label: {
        Text("Continue", tableName: "Mock", comment: "Leaves a mock's result")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    }
  }

  @ViewBuilder
  private var secondaryAction: some View {
    if reviewsMistakes {
      Button {
        dismiss()
      } label: {
        Text("Continue", tableName: "Mock", comment: "Leaves a mock's result")
      }
      .buttonStyle(.outline)
    }
  }
}

/// Main's `MockResultAnswers`: how the answers went as one meter, each part named with its count
/// under it.
private struct MockAnswersSection: View {
  let result: MockResult

  private struct Part: Identifiable {
    let id: Int
    let label: Text
    let count: Double
    /// Nil for a blank answer: its part is the meter's track and its dot a ring.
    let color: Color?
  }

  private var parts: [Part] {
    guard let counts = result.answerCounts else { return [] }

    return [
      Part(
        id: 0, label: Text("Right", tableName: "Mock", comment: "Right answers"),
        count: counts.right, color: Color.success),
      Part(
        id: 1, label: Text("Wrong", tableName: "Mock", comment: "Wrong answers"),
        count: counts.wrong, color: Color.destructive),
      Part(
        id: 2, label: Text("Partly right", tableName: "Mock", comment: "Partly right answers"),
        count: Double(counts.partial), color: Color.mutedForeground),
      Part(
        id: 3, label: Text("Blank", tableName: "Mock", comment: "Blank answers"),
        count: Double(counts.blank), color: nil),
    ]
    .filter { $0.id != 2 || $0.count > 0 }
  }

  private var blankCountsAsWrong: Bool { result.net == nil && result.blank > 0 }

  var body: some View {
    let parts = parts

    if !parts.isEmpty || blankCountsAsWrong {
      Section {
        if !parts.isEmpty {
          VStack(alignment: .leading, spacing: 8) {
            MeterParts(
              parts: parts.filter { $0.count > 0 }.map {
                MeterParts.Part(
                  weight: $0.count, fill: $0.color.map { MeterParts.Part.Fill.color($0) } ?? .track)
              }
            )
            .accessibilityHidden(true)

            FlowLayout(spacing: 12) {
              ForEach(parts) { part in
                HStack(spacing: 6) {
                  Circle()
                    .fill(part.color ?? Color.clear)
                    .strokeBorder(
                      part.color == nil ? Color.mutedForeground : Color.clear, lineWidth: 1
                    )
                    .frame(width: 6, height: 6)
                    .accessibilityHidden(true)
                  part.label.foregroundStyle(.mutedForeground)
                  Text(part.count, format: .number).monospacedDigit()
                }
                .typeStyle(.note)
                .accessibilityElement(children: .combine)
              }
            }
          }
          .padding(.vertical, 4)
        }
      } header: {
        SectionTitle(Text("Answers", tableName: "Mock"))
      } footer: {
        if blankCountsAsWrong {
          SectionFooter {
            Text(
              "Blank answers count as wrong.", tableName: "Mock",
              comment: "Blank answers in a score")
          }
        }
      }
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
        if let missed = result.points?.missedMinimum {
          Text(missed.title)
            .typeStyle(.pageTitle)
            .foregroundStyle(.destructiveText)
          Text(missed.line)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        } else {
          Text(score.value)
            .typeStyle(.momentReadout)
          Text(detail)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
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

  var hasScoreNote: Bool { scoreNote != nil }

  /// Main's one sentence under the number: every minimum reached, or the subjects core names.
  /// A missed minimum's headline stands alone.
  private var verdict: String? {
    if let points = result.points {
      if points.missedMinimum != nil { return nil }

      if points.reachedEveryMinimum {
        return String(localized: "You reached every minimum in this mock exam.", table: "Mock")
      }
    }

    switch (view.verdict?.strongest, view.verdict?.weakest) {
    case (let best?, let worst?):
      return String(
        localized: "Strongest: \(best). Work on: \(worst).", table: "Mock",
        comment: "Under a mock exam's score: its best and worst subjects")
    case (let best?, nil):
      return String(
        localized: "Strongest: \(best).", table: "Mock",
        comment:
          "Under a mock exam's score when only its best subject is named: the words of the first half of “Strongest: {best}. Work on: {worst}.”"
      )
    case (nil, let worst?):
      return String(
        localized: "Work on: \(worst).", table: "Mock",
        comment:
          "Under a mock exam's score when only the subject to work on is named: the words of the second half of “Strongest: {best}. Work on: {worst}.”"
      )
    case (nil, nil):
      return nil
    }
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
            localized: "Estimated score · \($0)", table: "Mock",
            comment:
              "Over a score range on a mock exam's result. The exam's name goes last, after the separator, with no article before it."
          )
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

    if hasInsights {
      Section {
        if slowest != nil || result.unansweredAtTimeout > 0 {
          insight(
            Text("Timing", tableName: "Mock", comment: "Insight about pace"), systemImage: "timer"
          ) {
            if let slowest, let target = slowest.targetSecondsPerQuestion {
              Text(
                "\(Int(slowest.secondsPerQuestion.rounded())) seconds per \(slowest.name) question. Aim for \(Int(target.rounded())) or less.",
                tableName: "Mock",
                comment:
                  "A mock exam's result: the time spent on each question of its slowest subject.")
            }
            if result.unansweredAtTimeout > 0 {
              Text(
                "\(result.unansweredAtTimeout) questions were left when time ran out.",
                tableName: "Mock",
                comment: "A mock exam's result: its questions left unanswered when time ran out.")
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
            Text("Answers you weren't sure of", tableName: "Mock"),
            systemImage: "bookmark"
          ) {
            Text(
              "Sure: \(calibration.sure.right) of \(calibration.sure.answered) right. Not sure: \(calibration.unsure.right) of \(calibration.unsure.answered) right.",
              tableName: "Mock")
            if calibration.advice == .blankUnsure {
              Text(
                "Leaving the ones you weren't sure of blank would have added \(Int(calibration.blankingGain.rounded())) points.",
                tableName: "Mock")
            } else if calibration.advice == .keepAnswering {
              Text(
                "The answers you weren't sure of still earned points, so keep answering them.",
                tableName: "Mock")
            }
          }
        }
      } header: {
        SectionTitle(
          Text("What stood out", tableName: "Mock", comment: "The mock's insights"))
      }
    }
  }

  var hasInsights: Bool {
    slowestArea != nil || result.unansweredAtTimeout > 0 || incoherent != nil || unsure != nil
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
          run.start { await run.gradeEssays() }
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
        if let range = estimateRange {
          Text(range)
            .typeStyle(.momentReadout)
        } else {
          Text("No estimate", tableName: "Mock", comment: "A speaking paper's estimate")
            .typeStyle(.pageTitle)
        }
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

  private var estimateRange: String? {
    guard let points = paper.estimate.points else { return nil }

    if points.low == points.high {
      return number(points.low)
    }

    return String(
      localized: "\(number(points.low))–\(number(points.high))", table: "Mock",
      comment: "An estimated score range, low to high")
  }

  private func number(_ value: Double) -> String {
    value.formatted(.number.precision(.fractionLength(0...1)))
  }

  private var estimateDetail: String {
    if paper.estimate.points != nil {
      return String(
        localized: "Estimated score, from 0 to \(number(paper.estimate.total))", table: "Mock",
        comment: "Under a speaking paper's estimated score")
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

  static func offers(_ adapt: MockAdapt?) -> [MockPlanOffer] {
    [adapt?.skip != nil ? .skip : nil, adapt?.focus != nil ? .focus : nil].compactMap { $0 }
  }

  /// The first question nobody answered; the second appears once the first is answered.
  func asking(_ adapt: MockAdapt?) -> MockPlanOffer? {
    Self.offers(adapt).first { offer in
      switch byOffer[offer] {
      case nil, .failed: true
      default: false
      }
    }
  }
}

/// A plan question's two answers: in the step on a wide screen, the bottom bar's on a phone (the no
/// outlined, the yes the main action), so the bar never offers a way on while a question is open.
private struct MockPlanAnswerButtons: View {
  @Environment(ExamStore.self) private var exam
  let run: MockRun
  let offer: MockPlanOffer
  let inBar: Bool
  @Binding var answers: MockPlanAnswers

  var body: some View {
    Button {
      answers.byOffer[offer] = .declined
    } label: {
      offer == .skip
        ? Text("Keep them", tableName: "Mock", comment: "Keeps the known lessons")
        : Text("Not now", tableName: "Mock", comment: "Declines giving a subject more time")
    }
    .buttonStyle(.outline)
    .disabled(answers.applying)

    BusyButton(isBusy: answers.applying) {
      run.start { await apply() }
    } label: {
      offer == .skip
        ? Text("Skip them", tableName: "Mock", comment: "Takes the known lessons off the plan")
        : Text("Change my plan", tableName: "Mock", comment: "Gives a subject more time")
    }
    .modifier(MockPlanYesStyle(inBar: inBar))
  }

  private func apply() async {
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
}

private struct MockPlanYesStyle: ViewModifier {
  let inBar: Bool

  func body(content: Content) -> some View {
    if inBar {
      content.buttonStyle(.mainAction).keyboardShortcut(.defaultAction)
    } else {
      content.buttonStyle(.outline)
    }
  }
}

private struct MockPlanSection: View {
  @Environment(ExamStore.self) private var exam
  let run: MockRun
  let adapt: MockAdapt
  let preparation: MockResult.Preparation?
  let answersInBar: Bool
  @Binding var answers: MockPlanAnswers

  private var offers: [MockPlanOffer] { MockPlanAnswers.offers(adapt) }

  private var asking: MockPlanOffer? { answers.asking(adapt) }

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

        if !answersInBar {
          ButtonRow {
            MockPlanAnswerButtons(run: run, offer: offer, inBar: false, answers: $answers)
          }
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

  /// After a yes, what changed; after one no, nothing, but a no to every question says so, since
  /// a no saves nothing and the step would still read as an open question.
  private var statusLines: [String] {
    if offers.allSatisfy({ answers.byOffer[$0] == .declined }) {
      return [
        String(localized: "Your plan stays as it is.", table: "Mock")
      ]
    }

    return offers.compactMap { offer -> String? in
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
            if item.outcome != .blank, item.outcome != .right,
              let answer = TrueFalseWords.savedAnswer(
                item.learnerAnswer, format: item.format, labels: labels)
            {
              MistakeAnswerRow(text: answer, isRight: false, isLiteral: item.format == "typed")
            }
            if let correct = TrueFalseWords.savedAnswer(
              item.correctAnswer, format: item.format, labels: labels)
            {
              MistakeAnswerRow(text: correct, isRight: true, isLiteral: item.format == "typed")
            }
            if let explanation = item.explanation {
              LessonTextBlocks(explanation).typeStyle(.reading)
            }
            if let citation = item.citation {
              CitationNote(citation: citation)
            }
          }
        } label: {
          // What it asked, then which question it was and how it went: a wrong answer needs no
          // word, the list is of them.
          VStack(alignment: .leading, spacing: 2) {
            LessonRichText(item.question)
              .typeStyle(.body.weight(.medium))
            FactSegments(facts: facts(item))
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        }
        .id(item.id)
        .onScrollVisibilityChange(threshold: 0.5) { rows?.update(item.id, isShown: $0) }
      }
    } header: {
      SectionTitle(
        Text("Questions to review", tableName: "Mock", comment: "The mock's questions to review")
      ) {
        Text(items.count, format: .number)
      }
      .onScrollVisibilityChange(threshold: 0.5) { rows?.update(reviewHeader, isShown: $0) }
    }
  }

  private func facts(_ item: MockReviewItem) -> [FactSegments.Fact] {
    let outcome: String? =
      switch item.outcome {
      case .blank: String(localized: "Blank", table: "Mock", comment: "A blank question")
      case .partial:
        String(localized: "Partly right", table: "Mock", comment: "Partly right answers")
      case .right:
        String(localized: "Right", table: "Mock", comment: "Right answers")
      case .wrong: nil
      }

    let unsure = FactSegments.Fact(
      text: String(
        localized: "Not sure", table: "Mock",
        comment:
          "A toggle button in a mock exam: marks the current answer as one the learner isn't sure of, to check before handing in. Its label stays the same when pressed."
      ),
      color: .warningText, symbol: "bookmark.fill", symbolColor: .warning)

    return [
      String(localized: "Question \(item.number)", table: "Mock", comment: "A question by number"),
      item.area, outcome,
    ]
    .compactMap { $0.map { FactSegments.Fact(text: $0) } }
      + (item.unsure ? [unsure] : [])
  }
}

private struct MockNotesSection: View {
  let view: MockView

  var body: some View {
    let lines = view.leftOut.compactMap(MockLabels.leftOut)

    if hasNotes {
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

  var hasNotes: Bool {
    !view.leftOut.compactMap(MockLabels.leftOut).isEmpty || short != nil
      || view.sizeSource.pastEdition != nil
      || view.sizeSource.questions != .notice || view.sizeSource.time != .notice
      || view.sizeSource.subjects == .even || view.sizeSource.formats == .even
  }

  private var short: String? {
    guard let examQuestions = view.examQuestions, examQuestions > view.questions else { return nil }
    return String(
      localized:
        "This mock exam had \(view.questions) of the exam's \(examQuestions) questions.",
      table: "Mock", comment: "A mock that asked fewer questions than the exam")
  }
}
