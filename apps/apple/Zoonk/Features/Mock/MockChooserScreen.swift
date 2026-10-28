import SwiftUI

/// "Take a mock exam" for the active exam goal, whenever the learner wants: the full exam, half of
/// it or one subject, each with its honest size and time, and Start. A bank short of the picked
/// mock's questions has them written first while the page says so. Without Plus, the options show
/// with what it takes. A mock left running is where the learner goes on.
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
        .buttonStyle(.bordered)
      }
    case .loaded(let view):
      MockChooser(goalId: goalId, view: view, placement: false) { id in
        router.open(.mock(blockId: id))
      }
    }
  }
}

/// A diagnostic mock in onboarding, instead of the quick questions: the lengths it comes in with
/// their real size and time, why it helps, and Start (or, without Plus, what it takes). Its answers
/// set where the plan starts; stopping midway keeps them. Once started it runs right here.
struct PlacementMockScreen: View {
  @Environment(ExamStore.self) private var exam
  @Environment(\.dismiss) private var dismiss
  @State private var startedId: String?

  let goalId: String

  var body: some View {
    let options = exam.mockOptions(goalId: goalId)

    Group {
      if let id = startedId
        ?? options.value?.placement?.mock.flatMap({ $0.status == .running ? $0.id : nil })
      {
        MockScreen(blockId: id)
      } else {
        NavigationStack {
          placement(options)
            .navigationTitle(
              Text(
                "A mock exam to find your level", tableName: "Mock",
                comment: "Placement mock title")
            )
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
              ToolbarItem(placement: .cancellationAction) {
                Button(role: .close) { dismiss() }
              }
            }
        }
        .loads(options, refreshable: false)
      }
    }
  }

  @ViewBuilder
  private func placement(_ options: Resource<MockOptions>) -> some View {
    switch options.state {
    case .idle, .loading:
      ProgressView()
    case .failed(let error) where error != .notFound:
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
        .buttonStyle(.bordered)
      }
    case .loaded(let view) where view.placement != nil && view.placement?.mock == nil:
      MockChooser(goalId: goalId, view: view, placement: true) { id in
        startedId = id
      }
    default:
      // A goal that isn't an exam, or one already past it: back to onboarding's quick placement.
      ProgressView()
        .task { dismiss() }
    }
  }
}

/// Why Start didn't open a mock, or what it's doing.
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

/// The options to pick from (the exam's days and halves, then each subject) or a placement mock's
/// lengths, the picked one's size, and Start.
private struct MockChooser: View {
  @Environment(ExamStore.self) private var exam
  @State private var picked: String?
  @State private var length: PlacementMockOption.Length?
  @State private var status: ChooserStatus = .choosing
  @State private var busy = false

  let goalId: String
  let view: MockOptions
  let placement: Bool
  let onStarted: (String) -> Void

  private var isOpen: Bool { view.access == .open }
  /// An exam of several days names each day's mocks by their day.
  private var severalDays: Bool { view.options.filter { $0.kind == .full }.count > 1 }
  private var pickedOption: MockOption? {
    view.options.first { $0.id == (picked ?? view.options.first?.id) }
  }
  private var pickedLength: PlacementMockOption.Length? {
    length ?? view.placement?.recommended
  }

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text(view.examName)
            .font(.caption.monospaced())
            .foregroundStyle(.tertiary)
          detail
            .foregroundStyle(.secondary)
        }
      }

      if let running = view.running, !placement {
        Section {
          Button {
            onStarted(running.id)
          } label: {
            Label {
              VStack(alignment: .leading, spacing: 2) {
                Text("Continue your mock exam", tableName: "Mock", comment: "A running mock")
                Text("It's where you left it", tableName: "Mock", comment: "Under a running mock")
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
              }
            } icon: {
              KindDot(kind: .mock)
            }
          }
          .foregroundStyle(.primary)
        }
      }

      statusSection

      if placement, let lengths = view.placement {
        Section {
          ForEach(lengths.options) { option in
            choiceRow(
              id: option.length.rawValue, isPicked: option.length == pickedLength,
              title: option.length == lengths.recommended
                ? String(
                  localized:
                    "About \(MockLabels.duration(minutes: option.estimatedMinutes)) (recommended)",
                  table: "Mock", comment: "The recommended placement length")
                : String(
                  localized: "About \(MockLabels.duration(minutes: option.estimatedMinutes))",
                  table: "Mock", comment: "A placement length"),
              detail: precision(option),
              trailing: String(
                localized: "\(option.questions) q", table: "Mock", comment: "Questions, short")
            ) {
              length = option.length
            }
          }
        } header: {
          Text("How long", tableName: "Mock", comment: "Placement mock lengths")
        } footer: {
          Text(
            "Stop whenever you want: your plan uses the questions you answered. Your result shows at the end.",
            tableName: "Mock", comment: "Under the placement lengths")
        }
      } else {
        let examOptions = view.options.filter { $0.kind != .area }
        let subjects = view.options.filter { $0.kind == .area }

        Section {
          ForEach(examOptions) { optionRow($0) }
        } header: {
          Text("The exam", tableName: "Mock", comment: "Mocks of the whole exam or half of it")
        } footer: {
          if let pickedOption {
            MockSizeNote(
              document: view.examDocument, minutes: pickedOption.minutes,
              questions: pickedOption.questions, source: view.sizeSource)
          }
        }

        if !subjects.isEmpty {
          Section {
            ForEach(subjects) { optionRow($0) }
          } header: {
            Text("One subject", tableName: "Mock", comment: "Mocks of one subject")
          }
        }
      }

      if !isOpen {
        Section {
          PlusNotice(
            description: placement
              ? Text(
                "Mock exams come with Plus. Without it, the quick questions find your starting point.",
                tableName: "Mock", comment: "Placement mock without Plus")
              : Text(
                "Mock exams come with Plus: whenever you want, and every week in your plan.",
                tableName: "Mock", comment: "Mocks without Plus"),
            showsSeePlus: false, isInset: true)
        }
      }

      if let last = view.lastMock, !placement, let blockId = last.blockId {
        Section {
          MockSummaryRow(mock: last, blockId: blockId)
        } header: {
          Text("Your last mock exam", tableName: "Mock", comment: "The latest mock taken")
        }
      }
    }
    .safeAreaBar(edge: .bottom) {
      Group {
        if isOpen {
          Button {
            Task { await start() }
          } label: {
            startLabel.frame(maxWidth: .infinity)
          }
          .buttonStyle(.mainAction)
          .disabled(busy || (!placement && pickedOption == nil))
          .keyboardShortcut(.defaultAction)
        } else {
          SeePlusButton().buttonStyle(.mainAction).frame(maxWidth: .infinity)
        }
      }
      .controlSize(.large)
      .scenePadding(.horizontal)
      .padding(.vertical, 10)
    }
  }

  private var detail: Text {
    if placement {
      return Text(
        "In the exam's format. Your plan starts from your answers.", tableName: "Mock",
        comment: "What the placement mock is")
    }

    return isOpen
      ? Text(
        "Your result only shows at the end, like on exam day.", tableName: "Mock",
        comment: "The mock's one rule")
      : Text("Pick how much of the exam to take now.", tableName: "Mock", comment: "Without Plus")
  }

  private var startLabel: Text {
    if busy {
      return Text("Getting it ready…", tableName: "Mock", comment: "Starting a mock")
    }

    if case .short(let optionId, _, _, _, let questions) = status, optionId == pickedOption?.id {
      return Text(
        "Start with \(questions) questions", tableName: "Mock",
        comment: "Starts a mock with fewer questions")
    }

    return placement
      ? Text("Start the mock exam", tableName: "Mock", comment: "Starts the placement mock")
      : Text("Start", tableName: "Mock", comment: "Starts the picked mock")
  }

  @ViewBuilder
  private var statusSection: some View {
    switch status {
    case .choosing, .plusRequired:
      EmptyView()
    case .writing:
      Section {
        Label {
          VStack(alignment: .leading, spacing: 2) {
            Text("Preparing your mock exam", tableName: "Mock", comment: "Questions being written")
              .font(.headline)
            Text(
              "We're writing questions like the exam's for you. It starts here as soon as they're ready.",
              tableName: "Mock", comment: "While a mock's questions are written"
            )
            .foregroundStyle(.secondary)
          }
        } icon: {
          ProgressView()
        }
      }
    case .short(_, let examQuestions, let limit, let minutes, let questions):
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text(
            "\(questions) of the \(examQuestions) questions are ready now, so this mock takes about \(MockLabels.duration(minutes: minutes)).",
            tableName: "Mock", comment: "A mock that can ask only part of its questions")
          switch limit {
          case .day:
            Text(
              "More can be written for your mocks tomorrow.", tableName: "Mock",
              comment: "Daily question limit")
          case .month:
            Text(
              "More can be written for your mocks next month.", tableName: "Mock",
              comment: "Monthly question limit")
          case .total, nil:
            Text(
              "The question bank doesn't have more new ones for it yet.", tableName: "Mock",
              comment: "No more questions")
          }
        }
        .foregroundStyle(.secondary)
      }
    case .notEnoughQuestions:
      Section {
        Text(
          "There aren't enough questions for this mock yet. Try the full exam or another subject.",
          tableName: "Mock", comment: "Too few questions for a mock"
        )
        .foregroundStyle(.destructive)
      }
    case .failed:
      Section {
        Text("We couldn't start the mock. Try again.", tableName: "Mock", comment: "Start failed")
          .foregroundStyle(.destructive)
      }
    case .refused(let limit):
      Section {
        HelpLimitNotice(limit: limit)
      }
    }
  }

  private func optionRow(_ option: MockOption) -> some View {
    choiceRow(
      id: option.id, isPicked: option.id == pickedOption?.id, title: name(option),
      detail: optionDetail(option),
      trailing: String(
        localized:
          "\(option.questions) q · ~\(MockLabels.duration(minutes: option.estimatedMinutes))",
        table: "Mock", comment: "A mock's questions and time")
    ) {
      picked = option.id
    }
  }

  private func choiceRow(
    id: String, isPicked: Bool, title: String, detail: String?, trailing: String,
    action: @escaping () -> Void
  ) -> some View {
    Button(action: action) {
      HStack(alignment: .firstTextBaseline) {
        VStack(alignment: .leading, spacing: 2) {
          Text(title)
          if let detail, !detail.isEmpty {
            Text(detail)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
        }
        Spacer()
        Text(trailing)
          .font(.subheadline.monospacedDigit())
          .foregroundStyle(.secondary)
        Image(systemName: "checkmark")
          .fontWeight(.semibold)
          .opacity(isPicked ? 1 : 0)
          .accessibilityHidden(true)
      }
      .contentShape(.rect)
    }
    .foregroundStyle(.primary)
    .disabled(busy)
    .accessibilityAddTraits(isPicked ? .isSelected : [])
  }

  /// A mock's name as the learner picks it: a full exam day, half of it, or the subject.
  private func name(_ option: MockOption) -> String {
    if option.kind == .area {
      return option.areas.first ?? option.area
        ?? String(localized: "One subject", table: "Mock", comment: "A one-subject mock")
    }

    return MockLabels.daySize(
      fullLength: option.kind == .full, day: severalDays ? (option.day ?? 1) : nil)
  }

  /// What a mock covers, honestly: the papers it covers when it leaves one out, a full mock's
  /// written part, the day's subjects for an exam of several days, and an objective part only.
  private func optionDetail(_ option: MockOption) -> String {
    let covers = option.covers.map { $0.formatted(.list(type: .and)) }
    let subjects =
      severalDays && option.kind != .area && !option.areas.isEmpty
      ? option.areas.formatted(.list(type: .and)) : nil
    let written = option.written.isEmpty ? nil : "+ \(option.written.formatted(.list(type: .and)))"
    let objective =
      option.objectiveOnly && covers == nil
      ? String(localized: "objective part only", table: "Mock", comment: "No written part") : nil

    return [covers, subjects, written, objective].compactMap { $0 }.joined(separator: " · ")
  }

  /// How fine a starting point a diagnostic mock's length sets.
  private func precision(_ option: PlacementMockOption) -> String {
    if !option.coversAllAreas {
      return String(
        localized:
          "The \(option.areas.count) subjects worth most. Your first days ask about the rest.",
        table: "Mock", comment: "A short placement mock")
    }

    switch option.length {
    case .short:
      return String(
        localized: "A quick check. Your first days fine-tune it.", table: "Mock",
        comment: "The short placement mock")
    case .medium:
      return String(
        localized: "Every subject. A good starting point.", table: "Mock",
        comment: "The medium placement mock")
    case .long:
      return String(
        localized: "The most precise starting point.", table: "Mock",
        comment: "The long placement mock")
    }
  }

  private func start() async {
    let choice: MockChoice

    if placement {
      guard let pickedLength else { return }
      choice = .placement(pickedLength)
    } else {
      guard let pickedOption else { return }
      choice = .practice(pickedOption.shape)
    }

    // Start again on a mock the screen said is short takes it as it is.
    var acceptFewer = false
    if case .short(let optionId, _, _, _, _) = status, optionId == pickedOption?.id {
      acceptFewer = true
    }

    busy = true
    status = .choosing
    defer { busy = false }

    switch await exam.startMock(
      goalId: goalId, choice: choice, acceptFewer: acceptFewer, onWriting: { status = .writing })
    {
    case .done(.started(let id)):
      status = .choosing
      onStarted(id)
    case .done(.short(let examQuestions, let limit, let minutes, let questions)):
      status = .short(
        optionId: pickedOption?.id ?? "", examQuestions: examQuestions, limit: limit,
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
  }
}

/// A finished mock as a row: its number and what it sat, its score, opening its result.
struct MockSummaryRow: View {
  @Environment(AppRouter.self) private var router
  let mock: ExamMockSummary
  let blockId: String

  var body: some View {
    Button {
      router.open(.mock(blockId: blockId))
    } label: {
      LabeledContent {
        Text(score).monospacedDigit()
      } label: {
        Text(MockLabels.title(number: mock.number))
        Text(
          [shape, mock.finishedAt.formatted(.dateTime.month(.abbreviated).day())]
            .compactMap { $0 }.joined(separator: " · "))
      }
    }
    .foregroundStyle(.primary)
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

  /// Its score as the exam scores it: an estimated score, a net score, or right answers.
  private var score: String {
    switch mock.scoring {
    case .irt:
      MockLabels.number(mock.measure.rounded())
    case .net:
      String(
        localized: "Net \(MockLabels.number(mock.measure)) of \(mock.total)", table: "Mock",
        comment: "A net score")
    case .raw:
      String(
        localized: "\(MockLabels.number(mock.correct)) of \(mock.total) right", table: "Mock",
        comment: "Right answers")
    }
  }
}

/// Onboarding's placement offers the whole exam as a diagnostic mock beside the quick questions:
/// how long it can take, from its quick check to its longest, marked Plus without it. A mock left
/// running is where the learner goes on.
struct PlacementMockOffer: View {
  @Environment(ExamStore.self) private var exam
  @Environment(AppRouter.self) private var router
  let goalId: String

  var body: some View {
    let options = exam.mockOptions(goalId: goalId)

    Group {
      if let view = options.value, let placement = view.placement,
        let shortest = placement.options.first, let longest = placement.options.last
      {
        Section {
          Button {
            router.open(.placementMock(goalId: goalId))
          } label: {
            HStack {
              Label {
                VStack(alignment: .leading, spacing: 2) {
                  if placement.mock?.status == .running {
                    Text(
                      "Continue the mock exam", tableName: "Mock",
                      comment: "A running placement mock")
                  } else {
                    Text("Or take a mock exam", tableName: "Mock", comment: "Placement mock offer")
                  }
                  Group {
                    if shortest.estimatedMinutes == longest.estimatedMinutes {
                      Text(
                        "In the exam's format, about \(MockLabels.duration(minutes: longest.estimatedMinutes)).",
                        tableName: "Mock", comment: "The placement mock's length")
                    } else {
                      Text(
                        "In the exam's format, from \(MockLabels.duration(minutes: shortest.estimatedMinutes)) to \(MockLabels.duration(minutes: longest.estimatedMinutes)). You pick how long.",
                        tableName: "Mock", comment: "The placement mock's lengths")
                    }
                  }
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
                }
              } icon: {
                KindDot(kind: .mock)
              }
              Spacer()
              if view.access == .plusRequired {
                PlusMark()
              }
            }
          }
          .foregroundStyle(.primary)
        }
      }
    }
  }
}

/// Reads an exam goal's mocks on the placement step, for its offer; other goals have none.
struct PlacementMockLoading: ViewModifier {
  @Environment(ExamStore.self) private var exam
  let goalId: String
  let isExam: Bool

  func body(content: Content) -> some View {
    if isExam {
      content.loads(exam.mockOptions(goalId: goalId), refreshable: false)
    } else {
      content
    }
  }
}
