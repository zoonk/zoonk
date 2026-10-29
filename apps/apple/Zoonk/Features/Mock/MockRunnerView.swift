import SwiftUI

/// Like the exam room: one question at a time with no feedback.
struct MockRunnerView: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
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
      [isAccessibilitySize = dynamicTypeSize.isAccessibilitySize] proxy in
      !isAccessibilitySize && PaneSpace(proxy).panes(primaryShare: 0.5) != nil
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
          Label {
            Text("Answer sheet", tableName: "Mock", comment: "Opens the mock's answer sheet")
          } icon: {
            Image(systemName: "list.number")
          }
        }
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
        verbatim:
          "\(MockSectionCounts(run: run).leftOpen) \(String(localized: "After this, your answers can't change.", table: "Mock", comment: "Handing in is final"))"
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
          EmptyView()
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
      EmptyView()
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
    Button {
      if isLastQuestion {
        confirmsHandIn = true
      } else {
        run.go(to: run.position + 1)
      }
    } label: {
      if run.busy == .submit {
        Text("Handing in…", tableName: "Mock", comment: "A section is being handed in")
      } else if !isLastQuestion {
        Text("Next", tableName: "Mock", comment: "The next question")
      } else if view.isLastSectionCurrent {
        Text("Hand in the mock exam", tableName: "Mock", comment: "Hands in the last section")
      } else {
        Text("Hand in this section", tableName: "Mock", comment: "Hands in a section")
      }
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
    .disabled(run.pending || !run.moves.canAdvance)
    .keyboardShortcut(isLastQuestion ? nil : .defaultAction)
  }

  private var handInTitle: Text {
    view.isLastSectionCurrent
      ? Text("Hand in the mock exam?", tableName: "Mock", comment: "Confirms handing in a mock")
      : Text("Hand in this section?", tableName: "Mock", comment: "Confirms handing in a section")
  }
}

private struct MockQuestionMeta: View {
  @Environment(\.dynamicTypeSize) private var typeSize
  let run: MockRun
  let view: MockView
  let question: MockQuestion

  var body: some View {
    let layout =
      typeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(alignment: .leading)) : AnyLayout(HStackLayout())

    layout {
      Text(question.area ?? "")
        .lineLimit(typeSize.isAccessibilitySize ? nil : 1)
      Spacer(minLength: 0)
      if question.format == .essay {
        Text("Written part", tableName: "Mock", comment: "A full mock's essay part")
      } else if let place = sectionPlace {
        Text("\(place.number) of \(place.total)", tableName: "Mock", comment: "Question place")
          .monospacedDigit()
      }
    }
    .font(.caption.monospaced())
    .foregroundStyle(.secondary)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(accessibilityPlace)
  }

  private var sectionPlace: (number: Int, total: Int)? {
    let questions = run.questions.filter { $0.format != .essay }
    guard let index = questions.firstIndex(of: question) else { return nil }
    return (index + 1, questions.count)
  }

  private var accessibilityPlace: Text {
    if question.format == .essay {
      return question.area.map {
        Text("Written part · \($0)", tableName: "Mock", comment: "An essay's place")
      } ?? Text("Written part", tableName: "Mock", comment: "A full mock's essay part")
    }

    if let area = question.area {
      return Text(
        "Question \(question.number) of \(view.questions) · \(area)", tableName: "Mock",
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

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text((view.essayRubric ?? .custom).writingName)
        .font(.subheadline.weight(.medium))

      TextEditor(text: text)
        .frame(minHeight: 280)
        .scrollContentBackground(.hidden)
        .padding(8)
        .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
        .disabled(isLocked)
        .accessibilityLabel(Text((view.essayRubric ?? .custom).writingName))

      let words = EssayWords.count(text.wrappedValue)
      if words > 0 {
        Text("\(words) words", tableName: "Mock", comment: "An essay's word count")
          .font(.caption.monospaced())
          .foregroundStyle(.secondary)
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
        Text("Flag", tableName: "Mock", comment: "Flags a question to come back to")
      } icon: {
        Image(systemName: flagged ? "flag.fill" : "flag")
      }
    }
    .labelStyle(
      typeSize.isAccessibilitySize ? AnyLabelStyle(.iconOnly) : AnyLabelStyle(.titleAndIcon)
    )
    .buttonStyle(.bordered)
    .controlSize(.large)
    .tint(flagged ? .warning : nil)
    .disabled(run.timeUp || run.pending)
    .accessibilityAddTraits(flagged ? .isSelected : [])
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
    .font(.footnote)
    .foregroundStyle(.secondary)
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
              Text(timerInterval: Date.now...max(deadline, .now), countsDown: true)
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
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

      if question.format == .essay {
        essays += 1
        if draft?.isAnswered != true { blankEssays += 1 }
        continue
      }

      if draft?.isAnswered == true { answered += 1 } else { blank += 1 }
      if draft?.flagged == true { flagged += 1 }
    }
  }

  var leftOpen: String {
    var parts: [String] = []

    if blank > 0 {
      parts.append(
        String(
          localized: "\(blank) questions are blank.", table: "Mock",
          comment: "Blank questions when handing in"))
    }

    if flagged > 0 {
      parts.append(
        String(
          localized: "\(flagged) questions are flagged.", table: "Mock",
          comment: "Flagged questions when handing in"))
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

    return parts.joined(separator: " ")
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
          .navigationTitle(Text("Answer sheet", tableName: "Mock", comment: "The answer sheet"))
          .navigationBarTitleDisplayMode(.inline)
      }
    }
  }

  private var sheet: some View {
    List {
      if isBeside {
        Text("Answer sheet", tableName: "Mock", comment: "The answer sheet")
          .font(.headline)
          .accessibilityAddTraits(.isHeader)
          .listRowBackground(Color.clear)
      }

      Section {
        ForEach(Array(run.questions.enumerated()), id: \.element.id) { index, question in
          row(question, at: index)
        }
      } header: {
        Text("Questions", tableName: "Mock", comment: "The answer sheet's questions")
      } footer: {
        Text(
          "No feedback until the end, like on exam day.", tableName: "Mock",
          comment: "Under the answer sheet")
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
            .fontWeight(section.status == .current ? .semibold : .regular)
          }
        } header: {
          Text("Sections", tableName: "Mock", comment: "The mock's sections")
        }
      }
    }
    .safeAreaBar(edge: .bottom) {
      Button(action: onHandIn) {
        Text("Hand in", tableName: "Mock", comment: "Hands in from the answer sheet")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.bordered)
      .controlSize(.large)
      .disabled(run.pending || !run.moves.canAdvance && run.position == run.questions.count - 1)
      .scenePadding(.horizontal)
      .padding(.vertical, 10)
    }
  }

  private func row(_ question: MockQuestion, at index: Int) -> some View {
    let draft = run.drafts[question.itemId]
    let answered = draft?.isAnswered ?? false
    let flagged = draft?.flagged ?? false
    let isCurrent = index == run.position

    return Button {
      onPick(index)
    } label: {
      HStack {
        Group {
          if question.format == .essay {
            Text("Written part", tableName: "Mock", comment: "A full mock's essay part")
          } else {
            Text("Question \(question.number)", tableName: "Mock", comment: "A question by number")
          }
        }
        .fontWeight(isCurrent ? .semibold : .regular)
        .foregroundStyle(.primary)

        Spacer()

        if flagged {
          Image(systemName: "flag.fill")
            .foregroundStyle(.warning)
            .accessibilityLabel(Text("Flagged", tableName: "Mock", comment: "A flagged question"))
        }

        Image(systemName: answered ? "circle.fill" : "circle")
          .foregroundStyle(answered ? .primary : .tertiary)
          .accessibilityLabel(
            answered
              ? Text("Answered", tableName: "Mock", comment: "An answered question")
              : Text("Blank", tableName: "Mock", comment: "A blank question"))
      }
    }
    .disabled(!run.moves.canOpen(index) || run.timeUp)
    .listRowBackground(isCurrent ? Color(.tertiarySystemFill) : nil)
  }
}

enum EssayWords {
  static func count(_ text: String) -> Int {
    text.split(whereSeparator: \.isWhitespace).count
  }
}

private struct AnyLabelStyle: LabelStyle {
  private let make: (Configuration) -> AnyView

  init(_ style: some LabelStyle) {
    make = { AnyView(style.makeBody(configuration: $0)) }
  }

  func makeBody(configuration: Configuration) -> some View {
    make(configuration)
  }
}
