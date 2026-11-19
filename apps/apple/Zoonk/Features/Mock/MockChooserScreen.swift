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
      StateMessage {
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
      PageLoadFailure {
        Label {
          Text("Mock exams didn't load", tableName: "Mock", comment: "Loading failed")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } retry: {
        await options.refresh()
      }
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
    optionId: String, examQuestions: Int, limit: MockStartOutcome.Limit?, availableAt: Date?,
    minutes: Int, questions: Int)
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
  @State private var starting = VisitRequest<ChooserStatus>()

  private var status: ChooserStatus {
    get { starting.outcome ?? .choosing }
    nonmutating set { starting.outcome = newValue }
  }
  private var busy: Bool { starting.isRunning }

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
    Group {
      if view.lastMock?.blockId != nil {
        PaneSplit {
          ZoonkList {
            intro
            choices
          }
        } secondary: {
          ZoonkList {
            lastMockSection
          }
        } single: {
          ZoonkList {
            intro
            choices
            lastMockSection
          }
        }
      } else {
        ZoonkList {
          intro
          choices
        }
        .lonePage()
      }
    }
    .bottomBar(note: barNote) {
      startAction
    }
    .onDisappear {
      starting.leave()
    }
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
        LimitNotice(limit: limit, kind: .mockExams)
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
          start()
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
          start(acceptingFewer: true)
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
    guard
      case .short(_, let examQuestions, let limit, let availableAt, let minutes, let questions)? =
        shownStatus
    else { return nil }

    let time = MockLabels.duration(minutes: minutes)
    let fullOn: HelpLimit.OpeningDay? =
      switch limit {
      case .day: .tomorrow
      case .rolling30Days:
        availableAt.map { HelpLimit.openingDay($0, now: .now, calendar: .current) }
      case .total, nil: nil
      }

    return switch fullOn {
    case .tomorrow:
      String(
        localized:
          "Today this one has \(questions) of its \(examQuestions) questions, about \(time). You can take the full one tomorrow.",
        table: "Mock", comment: "A mock exam shorter today, when today's writing is used up")
    case .today:
      String(
        localized:
          "Today this one has \(questions) of its \(examQuestions) questions, about \(time). You can take the full one later today.",
        table: "Mock",
        comment:
          "In a dialog before a mock exam starts shorter than the one picked, because the learner used the questions they can have written for now."
      )
    case .on(let date):
      String(
        localized:
          "Today this one has \(questions) of its \(examQuestions) questions, about \(time). You can take the full one on \(date).",
        table: "Mock",
        comment:
          "In a dialog before a mock exam starts shorter than the one picked, because the learner used the questions they can have written for now. {date} is a day and its month, such as \"November 22\" in English."
      )
    case .open, nil:
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
    case .short(let optionId, _, _, _, _, _) where optionId != pickedOption?.id: nil
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
      return [limit.words(.mockExams).said]
    case .choosing, .writing, .plusRequired, .notEnoughQuestions, .failed, .short:
      return []
    }
  }

  private func optionRow(_ option: MockOption) -> some View {
    choiceRow(
      isPicked: option.id == pickedOption?.id,
      title: MockLabels.optionName(option, severalDays: severalDays),
      detail: optionDetail(option),
      trailing: optionSize(option)
    ) {
      picked = option.id
    }
  }

  /// The size, then how long learners usually take when that's under the limit (main's
  /// `useMockOptionSizeAndPace`).
  private func optionSize(_ option: MockOption) -> String {
    let size = String(
      localized:
        "\(option.questions) questions\u{00A0}· \(MockLabels.duration(minutes: option.minutes))",
      table: "Mock", comment: "A mock exam's size: its number of questions, then its time limit.")

    guard let usual = MockLabels.usualMinutes(option) else {
      return size
    }

    let pace = String(
      localized: "usually \(MockLabels.duration(minutes: usual))", table: "Mock",
      comment: "After a mock exam's size and time limit: about how long learners usually take.")

    return [size, pace].joinedFacts()
  }

  /// Main's `ChoiceRows`: the words, the mock's size under them on a phone or before the row's
  /// mark, and the mark at the end, empty until the row is picked, so the rows read as choices.
  private func choiceRow(
    isPicked: Bool, title: String, detail: String?, trailing: String,
    action: @escaping () -> Void
  ) -> some View {
    let size = Text(trailing)
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)

    return ChoiceRow(isPicked: isPicked, action: action) {
      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          ChoiceWords(
            title: Text(title), detail: detail.flatMap { $0.isEmpty ? nil : Text($0) })

          if sizeUnderWords {
            size
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        if !sizeUnderWords {
          size
        }
      }
    }
    .disabled(busy)
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
  private func start(acceptingFewer acceptFewer: Bool = false) {
    guard let pickedOption, !busy else { return }

    starting.run {
      let result = await exam.startMock(
        goalId: goalId, shape: pickedOption.shape, acceptFewer: acceptFewer,
        onWriting: { if !Task.isCancelled { status = .writing } })
      guard !Task.isCancelled else { return nil }

      switch result {
      case .done(.started(let id)):
        onStarted(id)
        return nil
      case .done(.short(let examQuestions, let limit, let availableAt, let minutes, let questions)):
        return .short(
          optionId: pickedOption.id, examQuestions: examQuestions, limit: limit,
          availableAt: availableAt, minutes: minutes, questions: questions)
      case .done(.notEnoughQuestions): return .notEnoughQuestions
      case .done(.refused(let limit)): return .refused(limit)
      case .done(.plusRequired):
        // The server's answer is the access now, even if the read after it fails; a later read
        // (a subscription bought) replaces it.
        let options = exam.mockOptions(goalId: goalId)
        options.update { options in
          var locked = options
          locked.access = .plusRequired
          return locked
        }
        await options.refresh()
        return .plusRequired
      case .done(.needsQuestions), .failed: return .failed
      case .obsolete: return nil
      }
    } then: { _ in
      if !outcome.isEmpty { announcePolitely(outcome.joinedSentences()) }
    }
  }

}

struct MockSummaryRow: View {
  @Environment(AppRouter.self) private var router
  @Environment(\.stacksContent) private var isStacked
  let mock: ExamMockSummary
  let blockId: String

  var body: some View {
    Button {
      router.open(.mock(blockId: blockId))
    } label: {
      ListRow(
        Text(MockLabels.title(number: mock.number)),
        description: mock.shape?.kind == .area ? (mock.shape?.area).map { Text($0) } : nil
      ) {
        StatusMark(status: .done)
      } trailing: {
        VStack(alignment: isStacked ? .leading : .trailing, spacing: 2) {
          Text(score)
          Text(PlanDate.moment(mock.finishedAt, .row, weekday: true))
        }
      }
      .disclosureChevron()
    }
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
