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

  let goalId: String
  let view: MockOptions
  let onStarted: (String) -> Void

  private var isOpen: Bool { view.access == .open }
  private var severalDays: Bool { view.options.filter { $0.kind == .full }.count > 1 }
  /// Nothing is picked when the page opens, so one tap on Start never begins a five-hour exam.
  private var pickedOption: MockOption? {
    view.options.first { $0.id == picked }
  }

  /// Main's choice rows put the size under the words on a phone.
  private var sizeUnderWords: Bool { sizeClass == .compact || isStacked }

  var body: some View {
    PaneSplit {
      ZoonkList {
        intro
        choices
      }
    } secondary: {
      ZoonkList {
        pickedSections
        lastMockSection
      }
    } single: {
      ZoonkList {
        intro
        choices
        lastMockSection
      }
    }
    .bottomBar(note: barNote) {
      startAction
    }
    .onAppear { isOnScreen = true }
    .onDisappear { isOnScreen = false }
  }

  @ViewBuilder
  private var intro: some View {
    Section {
      PageHeader(
        Text("Take a mock exam", tableName: "Mock", comment: "Mock chooser title"),
        supporting: detail
      )

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
  private var choices: some View {
    let examOptions = view.options.filter { $0.kind != .area }
    let subjects = view.options.filter { $0.kind == .area }

    Section {
      ForEach(examOptions) { optionRow($0) }
    } header: {
      if !subjects.isEmpty {
        SectionTitle(
          Text("The exam", tableName: "Mock", comment: "Mock exams of a whole exam or exam day"))
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

  /// A free learner sees the same page, and Start shows the gate in its place (main's chooser).
  @ViewBuilder
  private var startAction: some View {
    if isGated {
      SubscribeButton()
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
    } else {
      BusyButton(isBusy: busy) {
        if isOpen {
          Task { await start() }
        } else {
          status = .plusRequired
        }
      } label: {
        startLabel
      }
      .buttonStyle(.mainAction)
      .disabled(pickedOption == nil)
      .keyboardShortcut(.defaultAction)
      .confirmationDialog(
        Text(
          "Start a shorter mock exam?", tableName: "Mock",
          comment: "Title of the shorter mock exam dialog"),
        isPresented: Binding(get: { shortNote != nil }, set: { if !$0 { status = .choosing } }),
        titleVisibility: .visible,
        presenting: shortNote
      ) { _ in
        Button {
          Task { await start(acceptingFewer: true) }
        } label: {
          Text("Start", tableName: "Mock", comment: "Starts the picked mock")
        }

        Button(role: .cancel) {
          status = .choosing
        } label: {
          Text("Pick another", tableName: "Mock", comment: "Closes the shorter mock exam dialog")
        }
      } message: { note in
        Text(note)
      }
    }
  }

  /// Start was pressed on a locked page, and it's still locked: a subscription bought meanwhile
  /// brings Start back.
  private var isGated: Bool { status == .plusRequired && !isOpen }

  private var barNote: BarNote? {
    if isGated {
      return BarNote(
        String(localized: "Mock exams need a subscription", table: "Mock"), tone: .status)
    }

    return failure.map { BarNote($0) }
  }

  private var detail: Text {
    Text(
      "Timed like the real exam. You see your result at the end.", tableName: "Mock",
      comment: "Under the mock exam chooser's title")
  }

  private var startLabel: Text {
    Text("Start", tableName: "Mock", comment: "Starts the picked mock")
  }

  /// What the dialog says before a mock exam with fewer questions than it should starts.
  private var shortNote: String? {
    guard case .short(_, let examQuestions, let limit, let minutes, let questions)? = shownStatus
    else { return nil }

    let time = MockLabels.duration(minutes: minutes)

    return switch limit {
    case .day:
      String(
        localized:
          "Today this one has \(questions) of its \(examQuestions) questions, about \(time). You can take the full one tomorrow.",
        table: "Mock", comment: "A mock exam shorter today, when today's writing is used up")
    case .month:
      String(
        localized:
          "Today this one has \(questions) of its \(examQuestions) questions, about \(time). You can take the full one next month.",
        table: "Mock", comment: "A mock exam shorter today, when this month's writing is used up")
    case .total, nil:
      String(
        localized:
          "Today this one has \(questions) of its \(examQuestions) questions, about \(time).",
        table: "Mock", comment: "A mock exam shorter today")
    }
  }

  /// A short bank's note is about the mock it was asked for: another pick starts another mock.
  private var shownStatus: ChooserStatus? {
    switch status {
    case .choosing, .plusRequired: nil
    case .short(let optionId, _, _, _, _) where optionId != pickedOption?.id: nil
    default: status
    }
  }

  /// A Start that failed, over the bar where Start was pressed; the bar's note reads it out.
  private var failure: String? {
    switch shownStatus {
    case .notEnoughQuestions?:
      String(
        localized: "Not enough questions for this one yet. Pick another.", table: "Mock",
        comment: "Too few questions for a mock exam")
    case .failed?:
      String(
        localized: "We couldn't start the mock exam. Try again.", table: "Mock",
        comment: "Start failed")
    default:
      nil
    }
  }

  private var writing: some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        Text(
          "Getting your mock exam ready…", tableName: "Mock", comment: "Questions being written"
        )
        .typeStyle(.body.weight(.semibold))
        Text(
          "It starts here when it's ready.", tableName: "Mock",
          comment: "While a mock's questions are written"
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
    case .refused(let limit):
      return [limit.helpWords().said]
    case .choosing, .writing, .plusRequired, .notEnoughQuestions, .failed, .short:
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
        estimatedMinutes: option.estimatedMinutes)
      pickedAsks(
        option.covers ?? option.areas,
        title: option.covers == nil
          ? Text("Subjects", tableName: "Mock", comment: "The subjects a picked mock asks")
          : Text("Parts", tableName: "Mock", comment: "The parts of the exam a picked mock asks"),
        written: option.written)
    }
  }

  private func pickedSize(
    title: String, questions: Int, minutes: Int, estimatedMinutes: Int
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

  private func optionRow(_ option: MockOption) -> some View {
    choiceRow(
      isPicked: option.id == pickedOption?.id,
      title: MockLabels.optionName(option, severalDays: severalDays),
      detail: optionDetail(option),
      trailing: String(
        localized:
          "\(option.questions) questions\u{00A0}· \(MockLabels.duration(minutes: option.estimatedMinutes))",
        table: "Mock", comment: "A mock exam's number of questions and how long it takes")
    ) {
      picked = option.id
    }
  }

  /// Main's `ChoiceRows`: the words, the mock's size under them on a phone or at the row's end,
  /// and a check on the pick.
  private func choiceRow(
    isPicked: Bool, title: String, detail: String?, trailing: String,
    action: @escaping () -> Void
  ) -> some View {
    let size = Text(trailing)
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)

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
    let subjects = severalDays && option.kind != .area ? option.areas : []
    let parts = option.covers ?? subjects + option.written

    if !parts.isEmpty {
      return parts.formatted(.list(type: .and))
    }

    return option.objectiveOnly
      ? String(
        localized: "No written part", table: "Mock",
        comment: "A mock exam with only the exam's objective questions, without its essay")
      : ""
  }

  /// `acceptingFewer` only after the learner pressed Start in the shorter mock exam's dialog.
  private func start(acceptingFewer acceptFewer: Bool = false) async {
    guard let pickedOption else { return }

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
      // The page read as open, so its access is out of date: read again, and the gate shows once
      // it's locked.
      await exam.mockOptions(goalId: goalId).refresh()
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
          [
            mock.finishedAt.formatted(.dateTime.month(.abbreviated).day()),
            mock.shape?.kind == .area ? mock.shape?.area : nil,
          ]
          .compactMap { $0 }.joinedFacts())
      ) {
        StatusMark(status: .done)
      } trailing: {
        Text(score)
      }
      .disclosureChevron()
    }
  }

  private var score: String {
    switch mock.scoring {
    case .net:
      String(
        localized: "\(MockLabels.number(mock.measure)) of \(mock.total)", table: "Mock",
        comment: "A net score: the score of the most it could be, like 34 of 120")
    // An IRT score is only an estimate, shown as a range on the Plan, so a past mock shows its
    // right answers.
    case .irt, .raw:
      String(
        localized: "\(MockLabels.number(mock.correct)) of \(mock.total) right", table: "Mock",
        comment: "Right answers")
    }
  }
}
