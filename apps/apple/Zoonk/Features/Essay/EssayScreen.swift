import SwiftUI

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
          EssayLoader(blockId: blockId, admissionId: shownStart?.admissionId)
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

  var body: some View {
    let essay = store.essay(blockId: blockId)

    Group {
      switch essay.state {
      case .idle, .loading:
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .lonePage()
      case .empty, .failed(.notFound):
        NotFoundView()
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
      if essay.value == nil {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) { dismiss() }
        }
      }
    }
    .loads(essay, refreshable: false)
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
      .navigationTitle(WritingLabels.header(essay.writing))
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            Task {
              await writer.flush()
              dismiss()
            }
          }
        }

        if writer.mode == .write {
          ToolbarItem(placement: .primaryAction) {
            Button {
              sheet = .question
            } label: {
              Text("Question", tableName: "Essay", comment: "Opens the question while writing")
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
              : String(localized: "Grading criteria", table: "Essay", comment: "Criteria sheet")
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
        task: .init(title: essay.writing.title, minutes: essay.pacing.minutes),
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
            Text("Grading criteria", tableName: "Essay", comment: "Opens the criteria sheet"),
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
            ? Text("Continue", tableName: "Essay", comment: "Continues a saved draft")
            : Text("Write", tableName: "Essay", comment: "Starts writing the answer")
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
    guard finishFailures > 0 || writer.failures > 0, !finishing.isRunning else { return nil }

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

/// The field fills the screen; the line count a board would see stays under it, in view while the
/// keyboard is up.
private struct WritingEditorPage: View {
  @Bindable var writer: EssayWriter
  let essay: EssayView
  let onSend: () -> Void
  @FocusState private var isFocused: Bool

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
        .fieldBorder(isFocused: isFocused)
        .frame(maxHeight: .infinity)
        .accessibilityLabel(label)
        .accessibilityHint(Text(count.words))

      Text(count.words)
        .typeStyle(.data)
        .foregroundStyle(count.isOver ? .warningText : .mutedForeground)
        .accessibilityHidden(true)
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
          ? Text("Grade answer", tableName: "Essay", comment: "Sends an answer to be graded")
          : Text("Grade rewrite", tableName: "Essay", comment: "Sends a rewrite to be graded")
      }
      .buttonStyle(.mainAction)
      .disabled(!writer.canSend)
    }
    .onDisappear {
      Task { await writer.flush() }
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
            "Reading your essay against each criterion. It can take up to 30 seconds.",
            table: "Essay", comment: "Grading a draft"),
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
          Text("Support text", tableName: "Essay", comment: "Text to read before writing"))
      }
    }

    Section {
      LessonTextBlocks(essay.question)
        .typeStyle(.reading)
    } header: {
      SectionTitle(Text("What to write", tableName: "Essay", comment: "A written question's task"))
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
        localized: "How the \(WritingLabels.points(points)) points are split", table: "Essay",
        comment: "Under the criteria row: how a question's points are split")
    }

    return String(
      localized: "What the answer is judged on", table: "Essay",
      comment: "Under the criteria row of a question without points")
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
        SectionTitle(Text("Grading criteria", tableName: "Essay", comment: "Criteria section"))
      }
    } footer: {
      SectionFooter {
        writing.keySource == .notice
          ? Text("From the exam notice.", tableName: "Essay", comment: "Where criteria come from")
          : Text(
            "From the exam notice. The answer key is ours, for practice.", tableName: "Essay",
            comment: "Where criteria come from, with Zoonk's practice key")
      }
    }
  }
}
