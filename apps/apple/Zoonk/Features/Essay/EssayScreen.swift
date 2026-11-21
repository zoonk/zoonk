import SwiftUI
import UIKit

/// A written question of an exam: read it, write it, read the grade, rewrite. Opening it was its
/// start (`start`), which admitted the grading, or is writing the question, or was refused.
struct EssayScreen: View {
  @Environment(ExamStore.self) private var store
  @Environment(\.dismiss) private var dismiss

  let blockId: String
  var start: WritingStart?

  @State private var started: WritingStart?

  private var shownStart: WritingStart? { started ?? start }

  var body: some View {
    NavigationStack {
      Group {
        switch shownStart {
        case .writing, .failed, .limitReached, .signUpRequired, .unavailable:
          WritingStartView(
            blockId: blockId, start: shownStart ?? .failed, onReady: { started = $0 })
        case .ready, nil:
          EssayLoader(
            blockId: blockId, admissionId: shownStart?.admissionId, onStart: { started = $0 })
        }
      }
      .navigationBarTitleDisplayMode(.inline)
    }
  }
}

extension WritingStart {
  fileprivate var admissionId: String? {
    if case .ready(let id) = self { id } else { nil }
  }
}

private struct EssayLoader: View {
  @Environment(ExamStore.self) private var store
  @Environment(\.dismiss) private var dismiss

  let blockId: String
  let admissionId: String?
  let onStart: (WritingStart) -> Void

  var body: some View {
    let essay = store.essay(blockId: blockId)

    Group {
      switch essay.state {
      case .idle, .loading:
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .lonePage()
      case .empty, .failed(.notFound):
        // No question admitted yet: a link or a screen opened again shows the task, unasked.
        UnstartedWriting(blockId: blockId) { start in
          if case .ready = start { essay.invalidate() }
          onStart(start)
        }
      case .failed:
        PageLoadFailure {
          Label {
            Text("The question didn't load", tableName: "Essay", comment: "Loading failed")
          } icon: {
            Image(systemName: "wifi.exclamationmark")
          }
        } retry: {
          await essay.refresh()
        }
      case .loaded(let view):
        EssayContent(store: store, essay: view, admissionId: admissionId)
          .id(view.blockId)
      }
    }
    .toolbar {
      if essay.value == nil, ![.empty, .failed(.notFound)].contains(essay.state) {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) { dismiss() }
        }
      }
    }
    .loads(essay, refreshable: false)
  }
}

/// A writing block before its question is admitted, as the learner's own day lists it: the task's
/// name and time with "Write", the day's grading used up, or a block the day no longer lists, which
/// a re-read of the exam's notice removed. Nothing starts until the learner taps.
private struct UnstartedWriting: View {
  @Environment(TodayStore.self) private var today
  @Environment(\.dismiss) private var dismiss

  let blockId: String
  let onReady: (WritingStart) -> Void

  var body: some View {
    Group {
      switch today.today.state {
      case .idle, .loading:
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .lonePage()
          .toolbar { close }
      case .loaded(.day(let view)):
        if let block = view.session.blocks.first(where: { $0.id == blockId }) {
          if let unit = block.writingUnit {
            WritingStartView(
              blockId: blockId, start: Self.start(of: block),
              task: .init(
                title: WritingLabels.taskTitle(
                  unit: unit, task: block.writingTask, fallback: block.title)
                  ?? WritingLabels.header(unit),
                minutes: block.estimatedMinutes),
              unasked: unit, onReady: onReady)
          } else {
            NotFoundView()
              .toolbar { close }
          }
        } else {
          WritingStartView(blockId: blockId, start: .unavailable, onReady: onReady)
        }
      default:
        NotFoundView()
          .toolbar { close }
      }
    }
    .loads(today.today)
  }

  private var close: some ToolbarContent {
    ToolbarItem(placement: .cancellationAction) {
      Button(role: .close) { dismiss() }
    }
  }

  /// The day's grading used up refuses before a question is asked for; anything else waits for
  /// "Write".
  static func start(of block: StudyBlock) -> WritingStart? {
    guard let returnsOn = block.writingAvailability?.returnsOn else { return nil }

    return .limitReached(
      returnsOn: returnsOn,
      task: .init(
        description: block.title ?? "", distinctLines: block.writingTask?.distinctLines,
        lines: block.writingTask?.lines, minutes: block.estimatedMinutes,
        number: block.writingTask?.number, points: block.writingTask?.points,
        total: block.writingTask?.total, unit: block.writingUnit))
  }
}

private struct EssayContent: View {
  @Environment(PracticeStore.self) private var practice
  @Environment(ExamStore.self) private var store
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss
  @State private var writer: EssayWriter
  @State private var finishing = VisitRequest<Bool>()
  @State private var finishFailures = 0
  @State private var sheet: Sheet?
  @State private var showsSaveReport = false
  /// A close whose save didn't get through asks first: the text is kept on this device.
  @State private var asksToLeave = false

  enum Sheet: String, Identifiable {
    case question
    case criteria

    var id: String { rawValue }
  }

  let essay: EssayView

  init(store: ExamStore, essay: EssayView, admissionId: String?) {
    _writer = State(initialValue: EssayWriter(store: store, view: essay, admissionId: admissionId))
    self.essay = essay
  }

  var body: some View {
    content
      .navigationTitle(WritingLabels.header(essay.writing.unit))
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            Task {
              let saved = await writer.flush()

              if saved || !writer.saveFailed || writer.mode != .write {
                dismiss()
              } else {
                asksToLeave = true
              }
            }
          }
        }

        if writer.mode == .write {
          ToolbarItem(placement: .primaryAction) {
            Button {
              sheet = .question
            } label: {
              Text("Question", tableName: "Essay")
            }
          }
        }
      }
      .sheet(item: $sheet) { sheet in
        NavigationStack {
          ZoonkList {
            switch sheet {
            case .question:
              WritingQuestionBody(essay: essay)
              WritingCriteriaList(writing: essay.writing)
            case .criteria:
              WritingCriteriaList(writing: essay.writing, detail: true)
            }
          }
          .navigationTitle(
            sheet == .question
              ? essay.writing.title
              : String(localized: "Grading criteria", table: "Essay")
          )
          .navigationBarTitleDisplayMode(.inline)
          .toolbar {
            ToolbarItem(placement: .cancellationAction) {
              Button(role: .close) { self.sheet = nil }
            }
          }
        }
        .presentationDetents(sheet == .question ? [.large] : [.medium, .large])
      }
      .feedbackSheet(
        isPresented: $showsSaveReport,
        context: FeedbackContext(screen: "essay", reportType: .saveFailure), isReport: true
      )
      .alert(
        Text("This answer changed on another device", tableName: "Essay"),
        isPresented: Binding(get: { writer.conflict != nil }, set: { _ in })
      ) {
        Button {
          Task { await writer.keepThisOne() }
        } label: {
          Text(
            "Keep this one", tableName: "Essay",
            comment:
              "A choice between two versions of one written answer: keep what's typed on this device and save it over the other."
          )
        }
        Button {
          writer.useTheOther()
        } label: {
          Text(
            "Use the other", tableName: "Essay",
            comment:
              "A choice between two versions of one written answer: replace what's typed here with the version saved on another device."
          )
        }
      } message: {
        Text(
          "Keep the version you're writing here, or switch to the other one.", tableName: "Essay")
      }
      .alert(
        Text("Your answer isn't saved yet", tableName: "Essay"),
        isPresented: $asksToLeave
      ) {
        Button(role: .cancel) {
        } label: {
          Text("Keep writing", tableName: "Essay")
        }
        Button {
          dismiss()
        } label: {
          Text("Leave", tableName: "Essay")
        }
      } message: {
        Text("It's kept on this device and saves when you're back online.", tableName: "Essay")
      }
      .task { writer.resumeSaving() }
      .onDisappear { finishing.leave() }
  }

  @ViewBuilder
  private var content: some View {
    switch writer.mode {
    case .question:
      questionPage
    case .write:
      WritingEditorPage(writer: writer, essay: essay, onSend: { Task { await writer.send() } })
    case .result:
      if let latest = writer.latest {
        resultPage(latest)
      } else {
        questionPage
      }
    case .refused:
      WritingRefusedView(
        task: .init(
          title: WritingLabels.taskTitle(
            unit: essay.writing.unit, task: essay.writingTask, fallback: essay.writing.title)
            ?? essay.writing.title,
          minutes: essay.pacing.minutes),
        isBusy: finishing.isRunning, onContinue: finish)
    }
  }

  private var questionPage: some View {
    ZoonkList {
      Section {
        PageHeader(
          Text(essay.writing.title), facts: WritingLabels.facts(essay.writing, pacing: essay.pacing)
        ) {
          EmptyView()
        }
      }
      WritingQuestionBody(essay: essay)
      Section {
        Button {
          sheet = .criteria
        } label: {
          ListRow(
            Text("Grading criteria", tableName: "Essay"),
            description: Text(WritingCriteriaList.summary(essay.writing))
          )
          .disclosureChevron()
        }
      }
    }
    .lonePage()
    .bottomBar {
      if essay.isClosed {
        todayButton
      } else {
        Button {
          writer.mode = .write
        } label: {
          writer.hasDraft
            ? Text("Continue", tableName: "Essay")
            : Text("Write", tableName: "Essay")
        }
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
      }
    }
  }

  private func resultPage(_ answer: WritingAnswer) -> some View {
    ZoonkList {
      WritingResultSections(grade: answer.grade, prompt: essay.writing, text: answer.text)
    }
    .lonePage()
    .bottomBar(note: resultNote) {
      if essay.isClosed {
        todayButton
      } else if WritingNextStep(grade: answer.grade, text: answer.text) == .done,
        writer.editsAfterGrading == nil
      {
        // Nothing left to rewrite: the one way on.
        BusyButton(isBusy: finishing.isRunning) {
          finish()
        } label: {
          Text(
            "Continue", tableName: "Essay")
        }
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
      } else {
        Button {
          finish()
        } label: {
          Text("Skip", tableName: "Essay", comment: "Goes on without rewriting")
        }
        .buttonStyle(.outline)
        .disabled(finishing.isRunning || writer.isRewriting)

        BusyButton(isBusy: writer.isRewriting) {
          Task { await writer.rewrite() }
        } label: {
          Text("Rewrite", tableName: "Essay", comment: "Rewrites the answer")
        }
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
        .disabled(finishing.isRunning)
      }
    }
  }

  private var todayButton: some View {
    Button {
      router.showRoot(of: .today)
    } label: {
      Text("Today", tableName: "Essay", comment: "Leaves a finished written task for Today")
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
  }

  private var resultNote: BarNote? {
    guard finishFailures > 0 || writer.failures > 0, !finishing.isRunning else {
      return writer.editsAfterGrading == nil
        ? nil
        : BarNote(
          LocalizedStringResource(
            "This grade is for the version you sent first. Your changes are kept for your rewrite.",
            table: "Essay"), tone: .status)
    }

    return BarNote(
      LocalizedStringResource(
        "That didn't go through. Try again in a moment.", table: "Essay",
        comment: "Finishing or rewriting a written task failed"),
      action: .init(
        label: Text("Report", tableName: "Essay", comment: "Reports a save that keeps failing"),
        perform: { showsSaveReport = true }))
  }

  /// The finished block goes on to the session.
  private func finish() {
    let essay = essay

    finishing.run {
      let result = await store.cache.mutate(
        invalidating: [.goals, .learnerModel, .userProgress, .userSession],
        { [api = practice.api] identity in
          try await api.finishStudyBlock(
            token: identity.bearerToken, sessionId: essay.sessionId, blockId: essay.blockId)
        })

      switch result {
      case .done: return true
      case .failed: return false
      case .obsolete: return nil
      }
    } then: { done in
      if done == true {
        finishFailures = 0
        dismiss()
      } else if done == false {
        finishFailures += 1
      }
    }
  }
}

/// The field fills the screen; the line count graders would read stays under it, in view while the
/// keyboard is up.
private struct WritingEditorPage: View {
  @Bindable var writer: EssayWriter
  let essay: EssayView
  let onSend: () -> Void
  @FocusState private var isFocused: Bool
  @Environment(\.scenePhase) private var scenePhase

  private var label: Text {
    writer.answers.isEmpty
      ? Text("Your answer", tableName: "Essay", comment: "The box for a written answer")
      : Text("Rewrite what needs work", tableName: "Essay", comment: "The rewrite box")
  }

  var body: some View {
    let count = WritingLabels.lineCount(writer.text, writing: essay.writing)

    VStack(alignment: .leading, spacing: 8) {
      TextEditor(text: Binding(get: { writer.text }, set: { writer.write($0) }))
        .typeStyle(.writing)
        .scrollContentBackground(.hidden)
        .focused($isFocused)
        // What's being graded is what was sent.
        .disabled(writer.status == .grading)
        .fieldBorder(isFocused: isFocused, holdsFocus: true)
        .frame(maxHeight: .infinity)
        .accessibilityLabel(label)
        .accessibilityHint(Text(count.words))

      Text(count.words)
        .typeStyle(.data)
        .foregroundStyle(count.isOver ? .warningText : .mutedForeground)
        .accessibilityHidden(true)

      // The bar's note floats over the page: the field gives it room so the count stays in view.
      if let note {
        note.floatingNote()
          .hidden()
          .accessibilityHidden(true)
      }
    }
    .scenePadding(.horizontal)
    .padding(.top, 8)
    .padding(.bottom, 4)
    .readableColumn(640)
    .bottomBar(note: note) {
      BusyButton(isBusy: writer.status == .grading) {
        onSend()
      } label: {
        writer.answers.isEmpty
          ? Text("Grade answer", tableName: "Essay")
          : Text("Grade rewrite", tableName: "Essay", comment: "Sends a rewrite to be graded")
      }
      .buttonStyle(.mainAction)
      .disabled(!writer.canSend)
    }
    .onAppear { writer.startTiming() }
    .onDisappear {
      writer.stopTiming()
      Task { await writer.flush() }
    }
    .onChange(of: scenePhase) { _, phase in
      if phase == .active {
        writer.startTiming()
      } else {
        writer.stopTiming()
        flushInBackground()
      }
    }
  }

  /// The app leaving the screen saves the last edit, with the time iOS gives a task to finish.
  private func flushInBackground() {
    let writer = writer
    let task = UIApplication.shared.beginBackgroundTask(withName: "Save writing")

    Task {
      await writer.flush()
      UIApplication.shared.endBackgroundTask(task)
    }
  }

  private var note: BarNote? {
    switch writer.status {
    case .failed:
      BarNote(
        LocalizedStringResource(
          "That didn't go through. Your text is still here. Try again in a moment.",
          table: "Essay", comment: "Grading failed"))
    case .grading:
      BarNote(
        writer.slow
          ? LocalizedStringResource(
            "Still grading. This is taking longer than usual.", table: "Essay",
            comment: "Grading is slow")
          : LocalizedStringResource(
            "Reading your answer against each criterion. It can take up to 30 seconds.",
            table: "Essay"),
        tone: .status)
    case .idle where writer.saveFailed:
      BarNote(
        LocalizedStringResource("Not saved yet. It's kept on this device.", table: "Essay"),
        tone: .status)
    case .idle:
      nil
    }
  }
}

/// The support text and what to write: the question's body, on its page and in the writer's sheet.
struct WritingQuestionBody: View {
  let essay: EssayView

  var body: some View {
    if let context = essay.context, !context.isEmpty {
      Section {
        QuotedPassage(context, isItalic: false)
      } header: {
        SectionTitle(
          Text("Support text", tableName: "Essay"))
      }
    }

    Section {
      LessonTextBlocks(essay.question)
        .typeStyle(.reading)
    } header: {
      SectionTitle(Text("What to write", tableName: "Essay"))
    }
  }
}

/// How the question's points are split, one row away from it.
struct WritingCriteriaList: View {
  let writing: WritingPrompt
  var detail = false

  static func summary(_ writing: WritingPrompt) -> String {
    if writing.criteria.contains(where: { $0.points != nil }), let points = writing.points {
      return String(
        localized: "How the \(WritingLabels.points(points)) points are split", table: "Essay")
    }

    return String(
      localized: "What the answer is judged on", table: "Essay")
  }

  var body: some View {
    Section {
      ForEach(writing.criteria) { criterion in
        LabeledContent {
          if let points = criterion.points {
            Text(verbatim: WritingLabels.points(points))
              .typeStyle(.data)
          }
        } label: {
          Text(criterion.name)
        }
      }
    } header: {
      if detail {
        SectionTitle(Text(Self.summary(writing)))
      } else {
        SectionTitle(Text("Grading criteria", tableName: "Essay"))
      }
    } footer: {
      SectionFooter {
        writing.keySource == .notice
          ? Text("From the exam notice.", tableName: "Essay")
          : Text(
            "From the exam notice. The answer key is ours, for practice.", tableName: "Essay")
      }
    }
  }
}
