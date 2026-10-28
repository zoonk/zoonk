import SwiftUI

/// The running section, like the exam room: the clock in the toolbar, one question at a time with
/// no feedback, Flag and Next at the thumb, and the answer sheet (an inspector beside the question
/// on a wide screen, a sheet on a phone) to jump around and hand in. When the clock runs out,
/// answers close and handing in waits for the learner.
struct MockRunnerView: View {
  @Environment(\.horizontalSizeClass) private var sizeClass
  @State private var showsSheet = false
  @State private var confirmsHandIn = false
  @Bindable var run: MockRun
  let view: MockView
  let current: MockCurrent

  var body: some View {
    Group {
      if let question = run.question {
        ScrollView {
          VStack(alignment: .leading, spacing: 16) {
            MockQuestionMeta(run: run, view: view, question: question)
            MockQuestionCard(run: run, view: view, question: question)
            MovesNote(moves: run.moves)
          }
          .frame(maxWidth: 720, alignment: .leading)
          .frame(maxWidth: .infinity)
          .scenePadding()
        }
        .id(question.id)
        .onAppear { run.show(question.itemId) }
        .itemClock(run: run, question: question)
      }
    }
    .navigationTitle(MockLabels.title(number: view.number))
    .toolbar {
      ToolbarItem(placement: .principal) { MockClock(deadline: current.deadline) }
      ToolbarItem(placement: .primaryAction) {
        Button {
          showsSheet.toggle()
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
    .inspector(isPresented: $showsSheet) {
      MockAnswerSheet(run: run, view: view) {
        showsSheet = false
        confirmsHandIn = true
      } onPick: { position in
        run.go(to: position)
        // On a phone the sheet covers the question it opens; beside it, it stays.
        if sizeClass == .compact {
          showsSheet = false
        }
      }
      .presentationDetents([.medium, .large])
    }
    .safeAreaBar(edge: .bottom) {
      MockActionBar(run: run) {
        FlagButton(run: run)
        nextButton
      }
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

/// The question's subject and its place in the section, in one quiet line (two at the largest
/// text sizes, so the subject isn't cut).
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

  /// The question's place among the section's questions, essays left out.
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

/// One question of the running section: its set's text or recording, the question and how it's
/// answered (picks, a number, a word), or an essay's prompt and the box to write it in.
private struct MockQuestionCard: View {
  let run: MockRun
  let view: MockView
  let question: MockQuestion

  var body: some View {
    let isLocked = run.timeUp || run.pending || !run.moves.canChange(run.position)

    if let practice = question.practice {
      PracticeQuestionView(
        question: practice, labels: view.trueFalseLabels,
        allowsBlank: view.scoring == .net && question.format == .trueFalse, result: nil,
        isLocked: isLocked, continuesSet: previous?.set?.id == question.set?.id,
        askedIn: view.blockId, recordingQuestions: recordingQuestions, served: served,
        draft: run.answerBinding(for: question))
    } else {
      MockEssayBox(run: run, view: view, question: question, isLocked: isLocked)
    }
  }

  private var previous: MockQuestion? {
    run.position > 0 ? run.questions[run.position - 1] : nil
  }

  /// The exam plays each recording a set number of times and gives none back: the mock counts
  /// them, so another device opens it with the same plays left.
  private var served: ServedPlays? {
    guard let set = question.set, set.listening != nil else { return nil }
    let played = run.current?.plays.first { $0.setId == set.id }?.played ?? 0
    return ServedPlays(played: played) { [run] in await run.play(setId: set.id) }
  }

  /// A recording's questions, to read before it plays.
  private var recordingQuestions: (prompts: [String], current: Int)? {
    guard let set = question.set, set.listening != nil else { return nil }
    let onRecording = run.questions.filter { $0.set?.id == set.id }
    return (onRecording.map(\.question), onRecording.firstIndex(of: question) ?? 0)
  }
}

/// An essay of a full mock's written part, written on the section's clock: kept as the learner
/// types, saved once they pause, with its word count.
private struct MockEssayBox: View {
  let run: MockRun
  let view: MockView
  let question: MockQuestion
  let isLocked: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if let set = question.set {
        ItemSetStimulusView(set: set)
      }

      ItemSupportView(context: question.context, image: nil, visual: nil)
      QuestionTitle(text: question.question)

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

/// Flag the question to come back to it: orange while it's flagged. At the largest text sizes it
/// keeps its mark only, so Next keeps its room.
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

/// How the section lets the learner move, when the notice limits it.
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
  /// Where the exam times each question: its clock beside the question, moving on when it ends.
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

/// What's still open in the section, for the hand-in's confirmation.
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

  /// Blank and flagged questions (an essay left blank said apart), or that every one is answered.
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

/// The answer sheet: every question of the section by number, answered, blank or flagged, to jump
/// to any one the notice lets the learner open, and handing the section in.
private struct MockAnswerSheet: View {
  let run: MockRun
  let view: MockView
  let onHandIn: () -> Void
  let onPick: (Int) -> Void

  var body: some View {
    NavigationStack {
      List {
        Section {
          ForEach(Array(run.questions.enumerated()), id: \.element.id) { index, question in
            row(question, at: index)
          }
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
      .navigationTitle(Text("Answer sheet", tableName: "Mock", comment: "The answer sheet"))
      .navigationBarTitleDisplayMode(.inline)
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

/// Words in a text, counted from the first one.
enum EssayWords {
  static func count(_ text: String) -> Int {
    text.split(whereSeparator: \.isWhitespace).count
  }
}

/// A label style chosen at runtime.
private struct AnyLabelStyle: LabelStyle {
  private let make: (Configuration) -> AnyView

  init(_ style: some LabelStyle) {
    make = { AnyView(style.makeBody(configuration: $0)) }
  }

  func makeBody(configuration: Configuration) -> some View {
    make(configuration)
  }
}
