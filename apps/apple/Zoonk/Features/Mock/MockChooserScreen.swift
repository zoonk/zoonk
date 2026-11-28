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
      MockChooser(goalId: goalId, view: view, readAgain: options.refresh) { id in
        router.open(.mock(blockId: id))
      }
    }
  }
}

private enum ChooserStatus: Equatable {
  case choosing
  case failed
  case plusRequired
  case refused(HelpLimit)
  case writingLimitReached(returnsOn: String)
  case needsChoice(choiceGroups: [String])
}

private struct MockChooser: View {
  @Environment(ExamStore.self) private var exam
  @Environment(AppRouter.self) private var router
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
  let readAgain: () async -> Void
  let onStarted: (String) -> Void

  private var isOpen: Bool { view.access == .open }
  private var isWaitingForChoice: Bool { pickedOption.flatMap(pendingChoice) != nil }
  private var severalDays: Bool { view.options.filter { $0.kind == .full }.count > 1 }
  /// Nothing is picked when the page opens, so one tap on Start never begins a five-hour exam.
  private var pickedOption: MockOption? {
    view.options.first { $0.id == picked }
  }

  private var isPreparing: Bool {
    if case .refused = status { return false }
    guard let requested = view.requested, let pickedOption, rowLimit(pickedOption) == nil
    else { return false }
    return requested.status == .preparing && requested.shape == pickedOption.shape
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
    .task(id: isPreparing) {
      await readAgainWhilePreparing()
    }
    .clearsRefusal {
      if case .refused = status { status = .choosing }
    }
    .onDisappear {
      starting.leave()
    }
  }

  private func readAgainWhilePreparing() async {
    while isPreparing {
      do {
        try await Task.sleep(for: .seconds(15))
      } catch {
        return
      }

      await readAgain()
    }
  }

  @ViewBuilder
  private var intro: some View {
    Section {
      PageHeader(
        Text("Take a mock exam", tableName: "Mock", comment: "Mock chooser title"),
        supporting: detail
      )
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

  /// An exam of several tests (an objective one in the morning, a written one in the afternoon).
  private var tests: Int { severalDays ? 0 : MockLabels.examTests(view.options) }

  /// An exam of several tests lists each test and all of them first, then the shorter, objective-only
  /// options; any other exam lists the exam, then one subject.
  private func leads(_ option: MockOption) -> Bool {
    tests > 1 ? option.kind != .half && option.kind != .area : option.kind != .area
  }

  @ViewBuilder
  private var choices: some View {
    let examOptions = view.options.filter(leads)
    let rest = view.options.filter { !leads($0) }

    Section {
      ForEach(examOptions) { optionRow($0) }
    } header: {
      if tests > 1 {
        SectionTitle(
          Text(
            "Your exam has \(tests) tests", tableName: "Mock",
            comment: "Over the mock exams of an exam held as several tests"))
      } else if !rest.isEmpty {
        SectionTitle(
          Text("The exam", tableName: "Mock", comment: "Mock exams of a whole exam or exam day"))
      }
    }

    if !rest.isEmpty {
      Section {
        ForEach(rest) { optionRow($0, objectiveTitled: tests > 1) }
      } header: {
        if tests > 1 {
          SectionTitle(
            Text(
              "Shorter, objective questions only", tableName: "Mock"))
        } else {
          SectionTitle(Text("One subject", tableName: "Mock", comment: "Mocks of one subject"))
        }
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
    } else if case .refused(let limit) = status {
      LimitWayOn(limit: limit)
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
    } else if isWaitingForChoice {
      Button {
        router.showRoot(of: .today)
      } label: {
        Text("Choose on Today", tableName: "Mock")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    } else if isPreparing {
      Button {
        router.showRoot(of: .today)
      } label: {
        Text(MockPreparing.keepStudying)
      }
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
      .disabled(pickedOption.map { rowLimit($0) != nil } ?? true)
      .keyboardShortcut(.defaultAction)
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

    if case .refused(let limit) = status {
      return BarNote(limit.sentence(), tone: .status)
    }

    if isWaitingForChoice { return nil }

    if isPreparing {
      return BarNote {
        MockPreparingNote(
          title: MockPreparing.chooserTitle, goalID: goalId, surface: "mockChooser",
          read: { [exam, goalId] in await exam.mockWriting(goalId: goalId) },
          written: { [readAgain] in
            await readAgain()
            return true
          }
        )
        .id(picked)
      }
    }

    return failure.map { BarNote($0) }
  }

  /// The exam choices an option's written test waits for, from the options or a refused start.
  private func pendingChoice(_ option: MockOption) -> [String]? {
    if let groups = option.pendingChoice { return groups }
    if case .needsChoice(let groups) = status, option.hasWrittenTest { return groups }
    return nil
  }

  /// Why an option can't start now, said on its own row the way Today says it.
  private func rowLimit(_ option: MockOption) -> String? {
    if let groups = pendingChoice(option) {
      return WritingLabels.choiceLine(groups)
    }

    if case .writingLimitReached(let returnsOn) = status, option.hasWrittenTest {
      return WritingLabels.gradingReturns(returnsOn)
    }

    return nil
  }

  private var detail: Text {
    Text(
      "Timed like the real exam. You see your result at the end.", tableName: "Mock",
      comment: "Under the mock exam chooser's title")
  }

  private var startLabel: Text {
    Text("Start", tableName: "Mock", comment: "Starts the picked mock")
  }

  /// A Start that failed, over the bar where Start was pressed; the bar's note reads it out.
  private var failure: String? {
    status == .failed
      ? String(
        localized: "We couldn't start the mock exam. Try again.", table: "Mock",
        comment: "Start failed")
      : nil
  }

  /// An exam taken as one test reads its options as it always did; its sections say nothing new.
  private func optionRow(_ option: MockOption, objectiveTitled: Bool = false) -> some View {
    var shown = option
    if tests < 2 { shown.sections = nil }

    return choiceRow(
      isPicked: option.id == pickedOption?.id,
      title: MockLabels.optionName(shown, severalDays: severalDays, tests: tests),
      detail: objectiveTitled ? nil : optionDetail(shown),
      note: rowLimit(option),
      trailing: optionSize(shown)
    ) {
      picked = option.id
    }
  }

  /// The size, then how long learners usually take when that's under the limit (main's
  /// `useMockOptionSizeAndPace`).
  private func optionSize(_ option: MockOption) -> [String] {
    let size = String(
      localized:
        "\(MockLabels.questions(option)) questions\u{00A0}· \(MockLabels.duration(minutes: option.minutes))",
      table: "Mock", locale: .appLanguage,
      comment: "A mock exam's size: its number of questions, then its time limit.")

    guard let usual = MockLabels.usualMinutes(option) else {
      return [size]
    }

    let pace = String(
      localized: "usually \(MockLabels.duration(minutes: usual))", table: "Mock",
      comment: "After a mock exam's size and time limit: about how long learners usually take.")

    return [size, pace]
  }

  /// Main's `ChoiceRows`: the words, the mock's size under them on a phone or before the row's
  /// mark, and the mark at the end, empty until the row is picked, so the rows read as choices.
  private func choiceRow(
    isPicked: Bool, title: String, detail: String?, note: String? = nil, trailing: [String],
    action: @escaping () -> Void
  ) -> some View {
    let size = FactSegments(trailing)
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)

    return ChoiceRow(isPicked: isPicked, action: action) {
      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          ChoiceWords(
            title: Text(title), detail: detail.flatMap { $0.isEmpty ? nil : Text($0) },
            note: note.map { Text($0) })

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
    let sessions = (option.sections ?? []).compactMap(\.session)

    // A test of an exam of several says when it happens, if the notice says; its name says the rest.
    if !(option.sections ?? []).isEmpty, option.kind != .half {
      return sessions.joinedFacts()
    }

    let subjects = severalDays && option.kind != .area ? option.areas : []
    var seen = Set<String>()
    let parts = option.covers ?? (subjects + option.written).filter { seen.insert($0).inserted }

    if !parts.isEmpty {
      return parts.formatted(.list(type: .and))
    }

    return option.objectiveOnly
      ? String(
        localized: "No written part", table: "Mock",
        comment: "A mock exam with only the exam's objective questions, without its essay")
      : ""
  }

  private func start() {
    guard let pickedOption, !busy else { return }

    starting.run {
      let result = await exam.startMock(goalId: goalId, shape: pickedOption.shape)
      guard !Task.isCancelled else { return nil }

      switch result {
      case .done(.started(let id)):
        onStarted(id)
        return nil
      case .done(.preparing):
        exam.mockOptions(goalId: goalId).update { options in
          var asked = options
          asked.requested = .init(shape: pickedOption.shape, status: .preparing)
          return asked
        }
        return nil
      case .done(.refused(let limit)):
        return .refused(limit)
      case .done(.writingLimitReached(let returnsOn)):
        announcePolitely(WritingLabels.gradingReturns(returnsOn))
        return .writingLimitReached(returnsOn: returnsOn)
      case .done(.needsChoice(let groups)):
        return .needsChoice(choiceGroups: groups)
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
      case .failed: return .failed
      case .obsolete: return nil
      }
    }
  }
}

enum MockPreparing {
  static let title = LocalizedStringResource("Getting your mock exam ready", table: "Mock")
  static let chooserTitle = LocalizedStringResource(
    "Getting this mock exam ready", table: "Mock",
    comment:
      "Over the mock exam chooser's main button, after the learner picked a mock exam that isn't ready to start yet: we're writing its questions now. Other picks may start right away."
  )
  static let line = LocalizedStringResource(
    "Come back to this page to start it.", table: "Mock",
    comment:
      "Shown right under a line saying the mock exam is being prepared; 'it' is the mock exam, so don't repeat the noun."
  )
  static let keepStudying = LocalizedStringResource("Keep studying", table: "Mock")
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
          // A written test has no objective questions to score.
          if mock.total > 0 {
            Text(score)
          }
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
        locale: .appLanguage, comment: "A net score")
    // An IRT score is only an estimate, shown as a range on the Plan, so a past mock shows its
    // right answers.
    case .irt, .raw:
      String(
        localized: "\(MockLabels.number(mock.correct)) of \(mock.total) right", table: "Mock",
        locale: .appLanguage, comment: "Right answers")
    }
  }
}
