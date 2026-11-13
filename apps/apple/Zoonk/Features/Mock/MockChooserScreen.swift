import SwiftUI

struct MockChooserScreen: View {
  @Environment(ExamStore.self) private var exam
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    Group {
      if let goalId = learner.summary.value?.activeGoalID {
        MockChooserContent(goalId: goalId, options: exam.mockOptions(goalId: goalId))
      }
    }
    .navigationTitle(Text("Take a mock exam", tableName: "Mock", comment: "Mock chooser title"))
    .barTitleAfterHero(
      String(localized: "Take a mock exam", table: "Mock", comment: "Mock chooser title"))
  }
}

private struct MockChooserContent: View {
  @Environment(AppRouter.self) private var router
  let goalId: String
  let options: Resource<MockOptions>

  var body: some View {
    content
      .loads(options)
  }

  @ViewBuilder
  private var content: some View {
    switch options.state {
    case .idle, .loading:
      ProgressView()
    case .empty, .failed(.notFound):
      ContentUnavailableView {
        Label {
          Text("No mock exams for this goal", tableName: "Mock", comment: "Not an exam goal")
        } icon: {
          Image(systemName: "timer")
        }
      } description: {
        Text("Mock exam, timed like the real one", tableName: "Mock", comment: "What mocks are")
      }
      .lonePage()
    case .failed:
      ContentUnavailableView {
        Label {
          Text("Mock exams didn't load", tableName: "Mock", comment: "Loading failed")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await options.refresh() }
        } label: {
          Text("Try again", tableName: "Mock", comment: "Button to retry loading")
        }
        .buttonStyle(.outline)
      }
      .lonePage()
    case .loaded(let view):
      MockChooser(goalId: goalId, view: view) { id in
        router.open(.mock(blockId: id))
      }
    }
  }
}

private enum ChooserStatus: Equatable {
  case choosing
  case writing
  case short(
    optionId: String, examQuestions: Int, limit: MockStartOutcome.Limit?, minutes: Int,
    questions: Int)
  case notEnoughQuestions
  case failed
  case refused(HelpLimit)
  case plusRequired
}

private struct MockChooser: View {
  @Environment(ExamStore.self) private var exam
  @Environment(\.stacksContent) private var isStacked
  @Environment(\.horizontalSizeClass) private var sizeClass
  @State private var picked: String?
  @State private var status: ChooserStatus = .choosing
  @State private var busy = false
  @State private var isOnScreen = false
  @AccessibilityFocusState private var isPlusNoticeFocused: Bool

  let goalId: String
  let view: MockOptions
  let onStarted: (String) -> Void

  private var isOpen: Bool { view.access == .open }
  private var severalDays: Bool { view.options.filter { $0.kind == .full }.count > 1 }
  private var pickedOption: MockOption? {
    view.options.first { $0.id == (picked ?? view.options.first?.id) }
  }

  /// Main's choice rows put the size under the words on a phone.
  private var sizeUnderWords: Bool { sizeClass == .compact || isStacked }

  var body: some View {
    PaneSplit {
      ZoonkList {
        intro
        choices(notesUnder: false)
        plusSection
      }
    } secondary: {
      ZoonkList {
        pickedSections
        lastMockSection
      }
    } single: {
      ZoonkList {
        intro
        choices(notesUnder: true)
        plusSection
        lastMockSection
      }
    }
    .onAppear { isOnScreen = true }
    .onDisappear { isOnScreen = false }
    // See Plus took the place of the Start the learner pressed.
    .onChange(of: isOpen) {
      if !isOpen, status == .plusRequired {
        isPlusNoticeFocused = true
      }
    }
  }

  /// Main's `ChooserHeader`: what the last Start found takes the line under the title, and Start
  /// sits under it, above the choices.
  @ViewBuilder
  private var intro: some View {
    Section {
      PageHeader(
        Text("Take a mock exam", tableName: "Mock", comment: "Mock chooser title"),
        supporting: line
      )
      .announcesAlert(failure)

      startAction

      if shownStatus == .writing {
        writing
      }
    }

    if case .refused(let limit)? = shownStatus {
      Section {
        LimitNotice(limit: limit)
      }
    }

    if let running = view.running {
      Section {
        Button {
          onStarted(running.id)
        } label: {
          Label {
            VStack(alignment: .leading, spacing: 2) {
              Text("Continue your mock exam", tableName: "Mock", comment: "A running mock")
              Text("It's where you left it", tableName: "Mock", comment: "Under a running mock")
                .typeStyle(.note)
                .foregroundStyle(.mutedForeground)
            }
          } icon: {
            KindDot(kind: .mock)
          }
        }
        .foregroundStyle(.primary)
      }
    }
  }

  @ViewBuilder
  private func choices(notesUnder: Bool) -> some View {
    let examOptions = view.options.filter { $0.kind != .area }
    let subjects = view.options.filter { $0.kind == .area }

    Section {
      ForEach(examOptions) { optionRow($0) }
    } footer: {
      SectionFooter {
        if notesUnder {
          pickedNotes
        }
      }
    }

    if !subjects.isEmpty {
      Section {
        ForEach(subjects) { optionRow($0) }
      } header: {
        SectionTitle(Text("One subject", tableName: "Mock", comment: "Mocks of one subject"))
      }
    }
  }

  @ViewBuilder
  private var plusSection: some View {
    if !isOpen {
      Section {
        PlusNotice(
          description: Text(
            "Mock exams come with Plus: whenever you want, and every week in your plan.",
            tableName: "Mock", comment: "Mocks without Plus"),
          showsSeePlus: false
        )
        .accessibilityElement(children: .combine)
        .accessibilityFocused($isPlusNoticeFocused)
      }
    }
  }

  @ViewBuilder
  private var lastMockSection: some View {
    if let last = view.lastMock, let blockId = last.blockId {
      Section {
        MockSummaryRow(mock: last, blockId: blockId)
      } header: {
        SectionTitle(
          Text("Your last mock exam", tableName: "Mock", comment: "The latest mock taken"))
      }
    }
  }

  @ViewBuilder
  private var startAction: some View {
    Group {
      if isOpen {
        BusyButton(isBusy: busy, icon: .play) {
          Task { await start() }
        } label: {
          startLabel
        }
        .buttonStyle(.mainAction)
        .buttonSizing(.flexible)
        .disabled(pickedOption == nil)
        .keyboardShortcut(.defaultAction)
      } else {
        SeePlusButton().buttonStyle(.mainAction).frame(maxWidth: .infinity)
      }
    }
    .controlSize(.large)
    .listRowSeparator(.hidden)
  }

  private var detail: Text {
    isOpen
      ? Text(
        "Your result only shows at the end, like on exam day.", tableName: "Mock",
        comment: "The mock's one rule")
      : Text("Pick how much of the exam to take now.", tableName: "Mock", comment: "Without Plus")
  }

  private var startLabel: Text {
    if case .short(let optionId, _, _, _, let questions) = status, optionId == pickedOption?.id {
      return Text(
        "Start with \(questions) questions", tableName: "Mock",
        comment: "Starts a mock with fewer questions")
    }

    return Text("Start", tableName: "Mock", comment: "Starts the picked mock")
  }

  /// A short bank's note is about the mock it was asked for: another pick starts another mock.
  private var shownStatus: ChooserStatus? {
    switch status {
    case .choosing, .plusRequired: nil
    case .short(let optionId, _, _, _, _) where optionId != pickedOption?.id: nil
    default: status
    }
  }

  /// Main's `ChooserLine`: the page's one line, or what the last Start found in its place.
  private var line: Text {
    if let failure {
      return Text(failure).foregroundStyle(.destructiveText)
    }

    if case .short? = shownStatus {
      return Text(verbatim: outcome.joinedSentences())
    }

    return detail
  }

  /// A Start that failed, read out as main's `role="alert"` is, since VoiceOver stays on Start.
  private var failure: String? {
    switch shownStatus {
    case .notEnoughQuestions?:
      String(
        localized:
          "There aren't enough questions for this mock yet. Try the full exam or another subject.",
        table: "Mock", comment: "Too few questions for a mock")
    case .failed?:
      String(
        localized: "We couldn't start the mock. Try again.", table: "Mock", comment: "Start failed")
    default:
      nil
    }
  }

  private var writing: some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        Text("Preparing your mock exam", tableName: "Mock", comment: "Questions being written")
          .typeStyle(.body.weight(.semibold))
        Text(
          "We're writing questions like the exam's for you. It starts here as soon as they're ready.",
          tableName: "Mock", comment: "While a mock's questions are written"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
    } icon: {
      ProgressView()
    }
  }

  /// What the last Start led to, in words: VoiceOver stays on Start and hears it. A failure is
  /// read out as an alert (`failure`).
  private var outcome: [String] {
    switch status {
    case .short(_, let examQuestions, let limit, let minutes, let questions):
      let more =
        switch limit {
        case .day:
          String(
            localized: "More can be written for your mocks tomorrow.", table: "Mock",
            comment: "Daily question limit")
        case .month:
          String(
            localized: "More can be written for your mocks next month.", table: "Mock",
            comment: "Monthly question limit")
        case .total, nil:
          String(
            localized: "The question bank doesn't have more new ones for it yet.", table: "Mock",
            comment: "No more questions")
        }

      return [
        String(
          localized:
            "\(questions) of the \(examQuestions) questions are ready now, so this mock takes about \(MockLabels.duration(minutes: minutes)).",
          table: "Mock", comment: "A mock that can ask only part of its questions"),
        more,
      ]
    case .refused(let limit):
      return [limit.helpWords().said]
    case .choosing, .writing, .plusRequired, .notEnoughQuestions, .failed:
      return []
    }
  }

  /// Main's `PickedMock`: what Start starts.
  @ViewBuilder
  private var pickedSections: some View {
    if let option = pickedOption {
      pickedSize(
        title: MockLabels.optionName(option, severalDays: severalDays),
        questions: option.questions, minutes: option.minutes,
        estimatedMinutes: option.estimatedMinutes, notes: true)
      pickedAsks(
        option.covers ?? option.areas,
        title: option.covers == nil
          ? Text("Subjects", tableName: "Mock", comment: "The subjects a picked mock asks")
          : Text("Parts", tableName: "Mock", comment: "The parts of the exam a picked mock asks"),
        written: option.written)
    }
  }

  private func pickedSize(
    title: String, questions: Int, minutes: Int, estimatedMinutes: Int, notes: Bool = false
  ) -> some View {
    Section {
      LabeledContent {
        Text(questions, format: .number)
      } label: {
        Text("Questions", tableName: "Mock", comment: "How many questions a picked mock asks")
      }

      LabeledContent {
        Text(MockLabels.duration(minutes: minutes))
      } label: {
        Text("Time limit", tableName: "Mock", comment: "The time a picked mock allows")
      }

      LabeledContent {
        Text(
          "About \(MockLabels.duration(minutes: estimatedMinutes))", tableName: "Mock",
          comment: "How long a picked mock usually takes")
      } label: {
        Text("Usually takes", tableName: "Mock", comment: "How long a picked mock usually takes")
      }
    } header: {
      SectionTitle(Text(title))
    } footer: {
      SectionFooter {
        if notes {
          pickedNotes
        }
      }
    }
    .monospacedDigit()
  }

  @ViewBuilder
  private func pickedAsks(_ names: [String], title: Text, written: [String]) -> some View {
    if !names.isEmpty || !written.isEmpty {
      Section {
        ForEach(names, id: \.self) { Text($0) }

        ForEach(written, id: \.self) { name in
          VStack(alignment: .leading, spacing: 2) {
            Text(name)
            Text("Written part", tableName: "Mock", comment: "A full mock's essay part")
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        }
      } header: {
        SectionTitle(title)
      }
    }
  }

  @ViewBuilder
  private var pickedNotes: some View {
    if let pickedOption {
      VStack(alignment: .leading, spacing: 4) {
        MockSizeNote(
          document: view.examDocument, minutes: pickedOption.minutes,
          questions: pickedOption.questions, source: view.sizeSource)
        ForEach(
          pickedOption.leftOut.filter { $0.part != .writtenInFull }.map(MockLabels.leftOut),
          id: \.self
        ) { Text($0) }
      }
    }
  }

  private func optionRow(_ option: MockOption) -> some View {
    choiceRow(
      isPicked: option.id == pickedOption?.id,
      title: MockLabels.optionName(option, severalDays: severalDays),
      detail: optionDetail(option),
      trailing: String(
        localized:
          "\(option.questions) q\u{00A0}· ~\(MockLabels.duration(minutes: option.estimatedMinutes))",
        table: "Mock",
        comment:
          "A mock's number of questions (q is short for questions) and about how long it takes"),
      spokenTrailing: String(
        localized:
          "\(option.questions) questions, about \(MockLabels.duration(minutes: option.estimatedMinutes))",
        table: "Mock", comment: "Spoken: a mock's questions and time")
    ) {
      picked = option.id
    }
  }

  /// Main's `ChoiceRows`: the words, the mock's size under them on a phone or at the row's end,
  /// and a check on the pick.
  private func choiceRow(
    isPicked: Bool, title: String, detail: String?, trailing: String,
    spokenTrailing: String, action: @escaping () -> Void
  ) -> some View {
    let size = Text(trailing)
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)
      .accessibilityLabel(spokenTrailing)

    return Button(action: action) {
      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          Text(title)
            .typeStyle(.rowTitle)
            .foregroundStyle(Color(.foreground))
          if let detail, !detail.isEmpty {
            Text(detail)
              .typeStyle(.meta)
              .foregroundStyle(.mutedForeground)
          }
          if sizeUnderWords {
            size
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        if !sizeUnderWords {
          size
        }

        Image(systemName: "checkmark")
          .fontWeight(.semibold)
          .foregroundStyle(Color(.foreground))
          .opacity(isPicked ? 1 : 0)
          .accessibilityHidden(true)
      }
      .contentShape(.rect)
    }
    .disabled(busy)
    .accessibilityAddTraits(isPicked ? .isSelected : [])
    .pickedRow(isPicked)
  }

  private func optionDetail(_ option: MockOption) -> String {
    let covers = option.covers.map { $0.formatted(.list(type: .and)) }
    let subjects =
      severalDays && option.kind != .area && !option.areas.isEmpty
      ? option.areas.formatted(.list(type: .and)) : nil
    let written = option.written.isEmpty ? nil : "+ \(option.written.formatted(.list(type: .and)))"
    let objective =
      option.objectiveOnly && covers == nil
      ? String(
        localized: "objective part only", table: "Mock",
        comment:
          "A mock with only the exam's objective questions, without its written part like the essay"
      ) : nil

    return [covers, subjects, written, objective].compactMap { $0 }.joinedFacts()
  }

  private func start() async {
    guard let pickedOption else { return }

    // Start again on a mock the screen said is short takes it as it is.
    var acceptFewer = false
    if case .short(let optionId, _, _, _, _) = status, optionId == pickedOption.id {
      acceptFewer = true
    }

    busy = true
    status = .choosing
    defer { busy = false }

    switch await exam.startMock(
      goalId: goalId, shape: pickedOption.shape, acceptFewer: acceptFewer,
      onWriting: { status = .writing })
    {
    case .done(.started(let id)):
      status = .choosing
      onStarted(id)
    case .done(.short(let examQuestions, let limit, let minutes, let questions)):
      status = .short(
        optionId: pickedOption.id, examQuestions: examQuestions, limit: limit,
        minutes: minutes, questions: questions)
    case .done(.notEnoughQuestions):
      status = .notEnoughQuestions
    case .done(.refused(let limit)):
      status = .refused(limit)
    case .done(.plusRequired):
      status = .plusRequired
    case .done(.needsQuestions), .failed:
      status = .failed
    case .obsolete:
      status = .choosing
    }

    // A start that ends after the learner left for another tab isn't read out over it.
    if isOnScreen, !outcome.isEmpty {
      announcePolitely(outcome.joinedSentences())
    }
  }
}

struct MockSummaryRow: View {
  @Environment(AppRouter.self) private var router
  let mock: ExamMockSummary
  let blockId: String

  var body: some View {
    Button {
      router.open(.mock(blockId: blockId))
    } label: {
      ListRow(
        Text(MockLabels.title(number: mock.number)),
        description: Text(
          [shape, mock.finishedAt.formatted(.dateTime.month(.abbreviated).day())]
            .compactMap { $0 }.joinedFacts())
      ) {
        StatusMark(status: .done)
      } trailing: {
        Text(score)
      }
      .disclosureChevron()
    }
  }

  private var shape: String? {
    let label = MockLabels.shape(purpose: mock.purpose, shape: mock.shape)

    guard let examQuestions = mock.examQuestions, let label else {
      return label
    }

    return String(
      localized: "\(label), \(mock.total) of \(examQuestions) questions", table: "Mock",
      comment: "A mock that asked fewer questions than the exam")
  }

  private var score: String {
    switch mock.scoring {
    case .net:
      String(
        localized: "Net \(MockLabels.number(mock.measure)) of \(mock.total)", table: "Mock",
        comment: "A net score")
    // An IRT score is only an estimate, shown as a range on the Plan, so a past mock shows its
    // right answers.
    case .irt, .raw:
      String(
        localized: "\(MockLabels.number(mock.correct)) of \(mock.total) right", table: "Mock",
        comment: "Right answers")
    }
  }
}
