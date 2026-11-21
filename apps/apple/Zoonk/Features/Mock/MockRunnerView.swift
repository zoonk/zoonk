import SwiftUI

/// Like the exam room: one question at a time with no feedback.
struct MockRunnerView: View {
  @Environment(\.stacksContent) private var isStacked
  /// Kept through folding and unfolding iPhone Duo, and never turned into a sheet over the question
  /// when the screen narrows.
  @State private var showsAnswerSheet = false
  @State private var answerSheetInSheet = false
  @State private var fitsTwoPages = false
  @State private var confirmsHandIn = false
  @Bindable var run: MockRun
  let view: MockView
  let current: MockCurrent

  var body: some View {
    Group {
      if let question = run.question {
        pages(question)
          // Outside the pages, which folding or unfolding draws again: the question's time and its
          // own clock count once per question.
          .id(question.id)
          .onAppear { run.show(question.itemId) }
          .itemClock(run: run, question: question)
      }
    }
    .onGeometryChange(for: Bool.self) {
      [isStacked] proxy in
      PaneSpace(proxy).panes(primaryShare: 0.5, stacked: isStacked) != nil
    } action: {
      fitsTwoPages = $0
    }
    .navigationTitle(MockLabels.title(number: view.number))
    .toolbar {
      ToolbarItem(placement: .principal) { MockClock(deadline: current.deadline) }
      ToolbarItem(placement: .primaryAction) {
        Button {
          // One left open beside the question before iPhone Duo closed is hidden, so this opens it.
          if showsAnswerSheet, fitsTwoPages {
            showsAnswerSheet = false
          } else {
            showsAnswerSheet = true
            answerSheetInSheet = !fitsTwoPages
          }
        } label: {
          Text(
            "Sheet", tableName: "Mock",
            comment:
              "Short label of a small button that opens the mock exam's answer sheet. Screen readers and voice control call the button \"Answer sheet\", so the label must be a word copied letter for letter from your translation of \"Answer sheet\", such as its first word."
          )
        }
        .accessibilityLabel(Text("Answer sheet", tableName: "Mock"))
      }
    }
    .deadline(current.deadline, run: run)
    .sheet(
      isPresented: Binding(
        get: { showsAnswerSheet && answerSheetInSheet },
        set: { isShown in
          // SwiftUI also calls this when the sheet leaves for the pane, which keeps it open.
          if !isShown, answerSheetInSheet { showsAnswerSheet = false }
        })
    ) {
      answerSheet(isBeside: false).presentationDetents([.medium, .large])
        .zoonkSheet()
    }
    .onChange(of: fitsTwoPages) { _, fits in
      if fits { answerSheetInSheet = false }
    }
    .alert(handInTitle, isPresented: $confirmsHandIn) {
      Button(role: .cancel) {
      } label: {
        Text("Keep answering", tableName: "Mock", comment: "Cancels handing in")
      }
      Button {
        Task { await run.submitSection() }
      } label: {
        Text("Hand in", tableName: "Mock", comment: "Confirms handing in")
      }
    } message: {
      Text(
        verbatim: [
          MockSectionCounts(run: run).leftOpen,
          String(
            localized: "After this, your answers can't change.", table: "Mock",
            comment: "Handing in is final"),
        ].joinedSentences()
      )
    }
  }

  /// Side panels are panes, never inspectors: one presented while iPhone Duo is folded misplaces
  /// the screen beside it.
  @ViewBuilder
  private func pages(_ question: MockQuestion) -> some View {
    if showsAnswerSheet, fitsTwoPages {
      PaneSplit(primaryShare: 0.5) {
        QuestionColumn(readableWidth: 720, spacing: 16) {
          progress
        } content: {
          questionParts(question)
        } actions: {
          actionBar
        }
        .environment(\.isPaneSplit, false)
      } secondary: {
        answerSheet(isBeside: true)
      } single: {
        spread(question)
      }
    } else {
      spread(question)
    }
  }

  private func spread(_ question: MockQuestion) -> some View {
    QuestionSpread(readableWidth: 720, spacing: 16) {
      progress
    } stimulus: {
      MockQuestionMeta(run: run, view: view, question: question)
      MockQuestionCard(run: run, view: view, question: question, part: .stimulus)
    } response: {
      MockQuestionCard(run: run, view: view, question: question, part: .response)
      MovesNote(moves: run.moves)
    } actions: {
      actionBar
    }
  }

  @ViewBuilder
  private func questionParts(_ question: MockQuestion) -> some View {
    MockQuestionMeta(run: run, view: view, question: question)
    MockQuestionCard(run: run, view: view, question: question, part: .stimulus)
    MockQuestionCard(run: run, view: view, question: question, part: .response)
    MovesNote(moves: run.moves)
  }

  /// Main's `TaskHeaderProgress` under the bar: the share of this section answered.
  private var progress: some View {
    let counts = MockSectionCounts(run: run)

    return Meter(
      value: Double(counts.answered),
      total: Double(max(counts.total, 1)), height: 4
    )
    .accessibilityLabel(
      Text(
        "Questions answered in this section", tableName: "Mock",
        comment: "VoiceOver label of the bar under a mock's clock")
    )
    .frame(maxWidth: 720)
    .scenePadding(.horizontal)
    .padding(.bottom, 4)
    .frame(maxWidth: .infinity)
  }

  private var actionBar: some View {
    MockActionBar(run: run) {
      FlagButton(run: run)
      nextButton
    }
  }

  private func answerSheet(isBeside: Bool) -> some View {
    MockAnswerSheet(run: run, view: view, isBeside: isBeside) {
      showsAnswerSheet = false
      confirmsHandIn = true
    } onPick: { position in
      run.go(to: position)
      // Over the question it opens, the sheet closes; beside it, it stays.
      if !isBeside { showsAnswerSheet = false }
    }
  }

  private var isLastQuestion: Bool {
    run.position >= run.questions.count - 1
  }

  private var nextButton: some View {
    BusyButton(isBusy: run.busy == .submit) {
      if isLastQuestion {
        confirmsHandIn = true
      } else {
        run.go(to: run.position + 1)
      }
    } label: {
      if !isLastQuestion {
        Text("Next", tableName: "Mock", comment: "The next question")
      } else if view.isLastSectionCurrent {
        Text("Hand in", tableName: "Mock", comment: "Hands in the last section")
      } else {
        Text("Hand in section", tableName: "Mock", comment: "Hands in a section")
      }
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
    .disabled(run.busy != .submit && (run.pending || !run.moves.canAdvance))
    .keyboardShortcut(isLastQuestion ? nil : .defaultAction)
  }

  private var handInTitle: Text {
    view.isLastSectionCurrent
      ? Text("Hand in the mock exam?", tableName: "Mock", comment: "Confirms handing in a mock")
      : Text("Hand in this section?", tableName: "Mock", comment: "Confirms handing in a section")
  }
}

private struct MockQuestionMeta: View {
  let run: MockRun
  let view: MockView
  let question: MockQuestion

  var body: some View {
    AccessibilityStack {
      if let area = question.area {
        Chip(Text(area))
      }
      Spacer(minLength: 0)
      if let place = writtenTestPlace {
        // A written test counts its questions; the chip already names the test.
        Text("Question \(String(place.number)) of \(String(place.total))", tableName: "Mock")
      } else if question.format == .essay {
        Text("Written part", tableName: "Mock", comment: "A full mock's essay part")
      } else if let place = sectionPlace {
        Text("\(place.number) of \(place.total)", tableName: "Mock", comment: "Question place")
          .monospacedDigit()
      }
    }
    .typeStyle(.data)
    .foregroundStyle(.mutedForeground)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(accessibilityPlace)
  }

  private var sectionPlace: (number: Int, total: Int)? {
    let questions = run.questions.filter { $0.format != .essay }
    guard let index = questions.firstIndex(of: question) else { return nil }
    return (index + 1, questions.count)
  }

  private var writtenTestPlace: (number: Int, total: Int)? {
    run.questions.writtenTestPlace(of: question)
  }

  private var accessibilityPlace: Text {
    if let place = writtenTestPlace {
      return Text("Question \(String(place.number)) of \(String(place.total))", tableName: "Mock")
    }

    if question.format == .essay {
      return question.area.map {
        Text("Written part\u{00A0}· \($0)", tableName: "Mock", comment: "An essay's place")
      } ?? Text("Written part", tableName: "Mock", comment: "A full mock's essay part")
    }

    if let area = question.area {
      return Text(
        "Question \(question.number) of \(view.questions)\u{00A0}· \(area)", tableName: "Mock",
        comment: "A question's place in the mock, with its subject")
    }

    return Text(
      "Question \(question.number) of \(view.questions)", tableName: "Mock",
      comment: "A question's place in the mock")
  }
}

private struct MockQuestionCard: View {
  enum Part {
    case stimulus
    case response
  }

  @Environment(\.isPaneSplit) private var isPaneSplit
  let run: MockRun
  let view: MockView
  let question: MockQuestion
  let part: Part

  var body: some View {
    let isLocked = run.timeUp || run.pending || !run.moves.canChange(run.position)

    if let practice = question.practice {
      let asked = PracticeQuestionView(
        question: practice, labels: view.trueFalseLabels,
        allowsBlank: view.scoring == .net && question.format == .trueFalse, result: nil,
        isLocked: isLocked, continuesSet: previous?.set?.id == question.set?.id,
        askedIn: view.blockId, recordingQuestions: recordingQuestions, served: served,
        draft: run.answerBinding(for: question))

      switch part {
      case .stimulus: asked.stimulus
      case .response: asked.response
      }
    } else {
      switch (part, isPaneSplit) {
      case (.stimulus, true):
        MockEssayPrompt(question: question)
      case (.stimulus, false):
        VStack(alignment: .leading, spacing: 12) {
          MockEssayPrompt(question: question)
          MockEssayBox(run: run, view: view, question: question, isLocked: isLocked)
        }
      case (.response, true):
        MockEssayBox(run: run, view: view, question: question, isLocked: isLocked)
      case (.response, false):
        EmptyView()
      }
    }
  }

  private var previous: MockQuestion? {
    run.position > 0 ? run.questions[run.position - 1] : nil
  }

  /// The exam plays each recording a set number of times and gives none back, so the mock counts
  /// plays across devices.
  private var served: ServedPlays? {
    guard let set = question.set, set.listening != nil else { return nil }
    let played = run.current?.plays.first { $0.setId == set.id }?.played ?? 0
    return ServedPlays(played: played) { [run] in await run.play(setId: set.id) }
  }

  private var recordingQuestions: (prompts: [String], current: Int)? {
    guard let set = question.set, set.listening != nil else { return nil }
    let onRecording = run.questions.filter { $0.set?.id == set.id }
    return (onRecording.map(\.question), onRecording.firstIndex(of: question) ?? 0)
  }
}

private struct MockEssayPrompt: View {
  let question: MockQuestion

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if let set = question.set {
        ItemSetStimulusView(set: set)
      }

      ItemSupportView(context: question.context, image: nil, visual: nil)
      QuestionTitle(text: question.question)
    }
  }
}

private struct MockEssayBox: View {
  let run: MockRun
  let view: MockView
  let question: MockQuestion
  let isLocked: Bool
  @FocusState private var isFocused: Bool

  private var label: Text {
    Text("Your answer", tableName: "Essay", comment: "The box for a written answer")
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      label
        .typeStyle(.body.weight(.medium))
        .accessibilityHidden(true)

      let count = question.writing.map { WritingLabels.lineCount(text.wrappedValue, writing: $0) }
      let words = WordCount.count(text.wrappedValue)

      TextEditor(text: text)
        .typeStyle(.writing)
        .frame(minHeight: 280)
        .scrollContentBackground(.hidden)
        .focused($isFocused)
        .fieldBorder(isFocused: isFocused, holdsFocus: true)
        .disabled(isLocked)
        .accessibilityLabel(label)
        .accessibilityHint(Text(count?.words ?? ""))

      if let count {
        Text(count.words)
          .typeStyle(.data)
          .foregroundStyle(count.isOver ? .warningText : .mutedForeground)
          .accessibilityHidden(true)
      } else if words > 0 {
        Text("\(words) words", tableName: "Essay", comment: "An answer's word count")
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      }
    }
  }

  private var text: Binding<String> {
    let answer = run.answerBinding(for: question)

    return Binding(
      get: {
        if case .text(let text) = answer.wrappedValue { return text }
        return ""
      },
      set: { answer.wrappedValue = .text($0) })
  }
}

private struct FlagButton: View {
  @Environment(\.dynamicTypeSize) private var typeSize
  let run: MockRun

  var body: some View {
    let flagged = run.question.map { run.drafts[$0.itemId]?.flagged ?? false } ?? false

    Button {
      run.toggleFlag()
    } label: {
      Label {
        SwapLabel(
          labels: [
            Text("Flag", tableName: "Mock", comment: "Flags a question to come back to"),
            Text(
              "Remove flag", tableName: "Mock", comment: "Takes the flag off a flagged question"),
          ],
          shown: flagged ? 1 : 0, alignment: .leading)
      } icon: {
        Image(systemName: flagged ? "flag.fill" : "flag")
      }
    }
    .labelStyle(
      typeSize.isAccessibilitySize ? AnyLabelStyle(.iconOnly) : AnyLabelStyle(.titleAndIcon)
    )
    .buttonStyle(.outline)
    .controlSize(.large)
    .buttonTone(flagged ? .warning : .neutral)
    .disabled(run.timeUp || run.pending)
  }
}

private struct MovesNote: View {
  let moves: MockSectionMoves

  var body: some View {
    Group {
      if moves.reviewing {
        Text(
          "Review: you can go back to any question.", tableName: "Mock",
          comment: "A forward-only section's review")
      } else if moves.forwardOnly, moves.mustAnswer {
        Text(
          "Answer each question to move on. You can't go back to it.", tableName: "Mock",
          comment: "A forward-only section that asks for an answer")
      } else if moves.forwardOnly {
        Text(
          "You can't go back to a question once you move on.", tableName: "Mock",
          comment: "A forward-only section")
      } else if moves.mustAnswer {
        Text("Answer each question to move on.", tableName: "Mock", comment: "Answers required")
      }
    }
    .typeStyle(.note)
    .foregroundStyle(.mutedForeground)
  }
}

extension View {
  fileprivate func itemClock(run: MockRun, question: MockQuestion) -> some View {
    modifier(ItemClock(run: run, question: question))
  }
}

private struct ItemClock: ViewModifier {
  @State private var deadline: Date?
  let run: MockRun
  let question: MockQuestion

  func body(content: Content) -> some View {
    if let seconds = run.moves.itemSeconds {
      content
        .safeAreaInset(edge: .top) {
          if let deadline {
            HStack {
              Spacer()
              PlanDate.countdown(to: deadline)
                .typeStyle(.data)
                .foregroundStyle(.mutedForeground)
                .accessibilityLabel(
                  Text(
                    "Time left for this question", tableName: "Mock",
                    comment: "A question's own clock"))
            }
            .scenePadding(.horizontal)
          }
        }
        .task(id: question.id) {
          // The question's clock counts from what it already spent, set once as it appears.
          let spent = Double(run.drafts[question.itemId]?.durationMs ?? 0) / 1000
          let end = Date.now.addingTimeInterval(max(0, Double(seconds) - spent))
          deadline = end
          try? await Task.sleep(for: .seconds(end.timeIntervalSinceNow))
          guard !Task.isCancelled else { return }
          run.timeOutQuestion()
        }
    } else {
      content
    }
  }
}

@MainActor
struct MockSectionCounts {
  /// Main's: every question counted as answered, essays included.
  var answered = 0
  var blank = 0
  var blankEssays = 0
  var essays = 0
  var flagged = 0
  var total = 0

  init(run: MockRun) {
    for question in run.questions {
      let draft = run.drafts[question.itemId]
      total += 1

      if draft?.flagged == true { flagged += 1 }

      if question.format == .essay {
        essays += 1
        if run.isCountedAsAnswered(question.itemId) { answered += 1 } else { blankEssays += 1 }
        continue
      }

      if run.isCountedAsAnswered(question.itemId) { answered += 1 } else { blank += 1 }
    }
  }

  var leftOpen: String {
    var parts: [String] = []

    if blank > 0, flagged > 0 {
      parts.append(
        String(
          localized: "\(blank) questions are blank and \(flagged) are flagged.", table: "Mock",
          comment: "Before handing in a mock exam: how many of its questions are blank or flagged.")
      )
    } else if blank > 0 {
      parts.append(
        String(
          localized: "\(blank) questions are blank.", table: "Mock",
          comment: "Before handing in a mock exam: how many of its questions are blank or flagged.")
      )
    } else if flagged > 0 {
      parts.append(
        String(
          localized: "\(flagged) questions are flagged.", table: "Mock",
          comment: "Before handing in a mock exam: how many of its questions are blank or flagged.")
      )
    }

    if blank == 0, flagged == 0, total > essays {
      parts.append(
        String(
          localized: "Every question is answered.", table: "Mock",
          comment: "Nothing left open when handing in"))
    }

    if blankEssays > 0 {
      parts.append(
        String(
          localized: "\(blankEssays) essays are blank.", table: "Mock",
          comment: "Blank essays when handing in"))
    }

    return parts.joinedSentences()
  }
}

private struct MockAnswerSheet: View {
  let run: MockRun
  let view: MockView
  let isBeside: Bool
  let onHandIn: () -> Void
  let onPick: (Int) -> Void

  var body: some View {
    if isBeside {
      sheet
    } else {
      NavigationStack {
        sheet
          .navigationTitle(Text("Answer sheet", tableName: "Mock"))
          .navigationSubtitle(Text(MockLabels.answered(MockSectionCounts(run: run).answered)))
          .navigationBarTitleDisplayMode(.inline)
      }
    }
  }

  private var sheet: some View {
    ZoonkList {
      if isBeside {
        VStack(alignment: .leading, spacing: 4) {
          Text("Answer sheet", tableName: "Mock")
            .typeStyle(.body.weight(.semibold))
            .accessibilityAddTraits(.isHeader)
          Text(MockLabels.answered(MockSectionCounts(run: run).answered))
            .typeStyle(.note)
            .monospacedDigit()
            .foregroundStyle(.mutedForeground)
        }
        .listRowBackground(Color.clear)
      }

      Section {
        ForEach(Array(run.questions.enumerated()), id: \.element.id) { index, question in
          row(question, at: index)
        }
      } header: {
        SectionTitle(
          Text("Questions", tableName: "Mock", comment: "The answer sheet's questions"))
      } footer: {
        if let tools = view.currentSection?.tools {
          SectionFooter {
            Label(tools, systemImage: "pencil.and.ruler")
          }
        }
      }

      if view.sections.count > 1 {
        Section {
          ForEach(view.sections, id: \.index) { section in
            LabeledContent {
              switch section.status {
              case .done:
                Text("Handed in", tableName: "Mock", comment: "A section handed in")
              case .current, .upcoming:
                Text(MockLabels.duration(minutes: section.minutes)).monospacedDigit()
              }
            } label: {
              Text(
                section.name
                  ?? String(
                    localized: "Section \(section.index + 1)", table: "Mock",
                    comment: "A section without a name"))
            }
            .typeWeight(section.status == .current ? .semibold : .regular)
          }
        } header: {
          SectionTitle(Text("Sections", tableName: "Mock", comment: "The mock's sections"))
        }
      }
    }
    .safeAreaBar(edge: .bottom) {
      BusyButton(isBusy: run.busy == .submit, icon: .send, action: onHandIn) {
        Text("Hand in", tableName: "Mock", comment: "Hands in from the answer sheet")
      }
      .buttonStyle(.outline)
      .controlSize(.large)
      .buttonSizing(.flexible)
      .disabled(
        run.busy != .submit
          && (run.pending || !run.moves.canAdvance && run.position == run.questions.count - 1)
      )
      .scenePadding(.horizontal)
      .padding(.vertical, 10)
    }
  }

  private func row(_ question: MockQuestion, at index: Int) -> some View {
    let draft = run.drafts[question.itemId]

    let writtenNumber = run.questions.writtenTestPlace(of: question)?.number

    return MockSheetRow(
      name: question.format == .essay && writtenNumber == nil
        ? String(localized: "Written part", table: "Mock", comment: "A full mock's essay part")
        : String(
          localized: "Question \(writtenNumber ?? question.number)", table: "Mock",
          comment: "A question by number"),
      answered: run.isCountedAsAnswered(question.itemId),
      flagged: draft?.flagged ?? false,
      isCurrent: index == run.position,
      canOpen: run.moves.canOpen(index) && !run.timeUp
    ) {
      onPick(index)
    }
  }
}

extension [MockQuestion] {
  /// A written test (a section of essays only) numbers its questions, so two never look the same;
  /// nil for an essay beside objective questions, or the only one.
  func writtenTestPlace(of question: MockQuestion) -> (number: Int, total: Int)? {
    guard count > 1, allSatisfy({ $0.format == .essay }), let index = firstIndex(of: question)
    else { return nil }

    return (index + 1, count)
  }
}

/// A question on the answer sheet: its number, whether it's answered or marked, and the one the
/// learner is on.
struct MockSheetRow: View {
  let name: String
  let answered: Bool
  let flagged: Bool
  let isCurrent: Bool
  let canOpen: Bool
  let onPick: () -> Void

  var body: some View {
    Button(action: onPick) {
      HStack {
        Text(name)
          .typeWeight(isCurrent ? .semibold : .regular)
          .foregroundStyle(.primary)

        Spacer()

        if flagged {
          Image(systemName: "flag.fill")
            .foregroundStyle(.warning)
        }

        Image(systemName: answered ? "circle.fill" : "circle")
          .foregroundStyle(answered ? Color(.foreground) : .faint)
      }
    }
    .accessibilityLabel(
      flagged
        ? Text(
          "\(name), flagged", tableName: "Mock",
          comment:
            "A cell of the mock exam's answer sheet the learner flagged to look at again. %@ is \"Question 12\" or \"Written part\", so use a form that agrees with both."
        )
        : Text(name)
    )
    .accessibilityValue(answered ? MockAnswerMark.answered : MockAnswerMark.blank)
    .accessibilityAddTraits(isCurrent ? .isSelected : [])
    .disabled(!canOpen)
    .currentRow(isCurrent)
  }
}

private enum MockAnswerMark {
  static var answered: Text { Text("Answered", tableName: "Mock") }
  static var blank: Text { Text("Unanswered", tableName: "Mock") }
}
