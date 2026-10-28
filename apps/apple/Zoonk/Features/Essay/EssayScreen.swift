import SwiftUI

/// Writing practice for an exam's essay, a block of the learner's session: the texts and the
/// instruction, the learner's text sent for grading (a tap; grading takes 10 to 30 seconds), then
/// the grade (the estimated range by the official rubric, the one next step, the comments on every
/// criterion). Rewriting grades a new draft; skipping the rewrite goes on with the session.
struct EssayScreen: View {
  @Environment(ExamStore.self) private var store
  @Environment(\.dismiss) private var dismiss

  let blockId: String

  var body: some View {
    let essay = store.essay(blockId: blockId)

    NavigationStack {
      Group {
        switch essay.state {
        case .idle, .loading:
          ProgressView()
        case .empty, .failed(.notFound):
          ContentUnavailableView {
            Label {
              Text("This essay isn't here", tableName: "Essay", comment: "A missing essay block")
            } icon: {
              Image(systemName: "text.document")
            }
          }
        case .failed:
          ContentUnavailableView {
            Label {
              Text("The essay didn't load", tableName: "Essay", comment: "Loading failed")
            } icon: {
              Image(systemName: "wifi.exclamationmark")
            }
          } actions: {
            Button {
              Task { await essay.refresh() }
            } label: {
              Text("Try again", tableName: "Essay", comment: "Button to retry loading")
            }
            .buttonStyle(.bordered)
          }
        case .loaded(let view):
          EssayContent(resource: essay, essay: view)
        }
      }
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        if essay.value == nil {
          ToolbarItem(placement: .cancellationAction) {
            Button(role: .close) { dismiss() }
          }
        }
      }
    }
    .loads(essay, refreshable: false)
  }
}

/// Where sending a draft stands.
private enum EssaySendStatus: Equatable {
  case idle
  case grading
  case failed
  case limitReached
}

private struct EssayContent: View {
  @Environment(ExamStore.self) private var store
  @Environment(PracticeStore.self) private var practice
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss
  @State private var writing: Bool?
  @State private var typed: String?
  @State private var status = EssaySendStatus.idle
  @State private var slow = false
  @State private var startedAt: Date?
  /// The last text sent that wasn't graded, with the id it goes again under.
  @State private var ungraded: (attemptId: String, text: String)?
  @State private var finishing = false
  @State private var finishFailed = false
  @State private var confirmsLeave = false

  let resource: Resource<EssayView>
  let essay: EssayView

  /// Grading takes 10 to 30 seconds: past 20 the screen says it's still at it, past 90 it stops
  /// waiting and lets the learner send it again, with the text kept.
  private static let slowAfter = Duration.seconds(20)
  private static let timeout = Duration.seconds(90)

  private var isWriting: Bool { writing ?? essay.drafts.isEmpty }
  private var graded: String { essay.drafts.first?.text ?? "" }

  /// What the learner typed; until then, the text kept on this device, else the last graded one.
  private var text: String {
    if let typed { return typed }
    if let kept = UnsentEssay.read(essay.blockId),
      !kept.trimmingCharacters(in: .whitespaces).isEmpty,
      kept != graded
    {
      return kept
    }
    return graded
  }

  private var unsent: Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && text != graded
  }

  private var canSend: Bool {
    EssayWords.count(text) > 0 && status != .grading && essay.gradesLeft > 0 && !finishing
  }

  var body: some View {
    Group {
      if isWriting {
        writeForm
      } else if let grade = essay.drafts.first?.grade {
        List {
          EssayGradeSections(grade: grade)
        }
      }
    }
    .navigationTitle(essay.rubric.promptLabel)
    .toolbar {
      ToolbarItem(placement: .cancellationAction) {
        Button(role: .close) {
          if isWriting, unsent {
            confirmsLeave = true
          } else {
            dismiss()
          }
        }
      }
    }
    .interactiveDismissDisabled(isWriting && unsent)
    .confirmationDialog(
      Text("Leave for now?", tableName: "Essay", comment: "Leaving with unsent text"),
      isPresented: $confirmsLeave, titleVisibility: .visible
    ) {
      Button {
        dismiss()
      } label: {
        Text("Leave", tableName: "Essay", comment: "Leaves the essay")
      }
      Button(role: .cancel) {
      } label: {
        Text("Keep writing", tableName: "Essay", comment: "Stays on the essay")
      }
    } message: {
      Text(
        "Your text stays on this device, here when you come back.", tableName: "Essay",
        comment: "Unsent text is kept")
    }
    .safeAreaBar(edge: .bottom) {
      VStack(spacing: 10) {
        statusLine
        HStack(spacing: 12) {
          if !essay.drafts.isEmpty {
            Button {
              Task { await finish() }
            } label: {
              Text("Skip the rewrite", tableName: "Essay", comment: "Goes on without rewriting")
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
            .disabled(finishing || status == .grading)
          }

          if isWriting {
            Button {
              Task { await send() }
            } label: {
              if status == .grading {
                Text("Grading…", tableName: "Essay", comment: "A draft is being graded")
              } else if essay.drafts.isEmpty {
                Text("Send for grading", tableName: "Essay", comment: "Sends a draft")
              } else {
                Text("Grade the rewrite", tableName: "Essay", comment: "Sends a rewrite")
              }
            }
            .buttonStyle(.mainAction)
            .controlSize(.large)
            .disabled(!canSend)
          } else {
            Button {
              writing = true
            } label: {
              Text("Rewrite", tableName: "Essay", comment: "Rewrites the essay")
            }
            .buttonStyle(.mainAction)
            .controlSize(.large)
            .keyboardShortcut(.defaultAction)
          }
        }
      }
      .scenePadding(.horizontal)
      .padding(.vertical, 10)
    }
  }

  private var writeForm: some View {
    Form {
      if let context = essay.context, !context.isEmpty {
        Section {
          ItemText(context)
            .font(.callout)
        } header: {
          Text(essay.rubric.textsLabel)
        }
      }

      Section {
        ItemText(essay.question)
          .font(.headline)
      }

      if let grade = essay.drafts.first?.grade, grade.zeroReason != .tooShort {
        Section {
          if let next = grade.nextStep {
            VStack(alignment: .leading, spacing: 4) {
              if let criterion = grade.nextStepCriterion {
                Text("Next step: \(criterion.name)", tableName: "Essay", comment: "Rewrite guide")
                  .font(.headline)
              }
              Text(next.text)
            }
          } else {
            Text(
              "Every criterion has full marks in this estimate.", tableName: "Essay",
              comment: "Full marks")
          }
          Button {
            writing = false
          } label: {
            Text("See the grade", tableName: "Essay", comment: "Back to the last grade")
          }
        } header: {
          Text("Your last grade", tableName: "Essay", comment: "The last grade while rewriting")
        }
      }

      Section {
        TextEditor(text: textBinding)
          .frame(minHeight: 280)
          .accessibilityLabel(Text(boxLabel))
      } header: {
        Text(boxLabel)
      } footer: {
        let words = EssayWords.count(text)
        if words > 0 {
          Text("\(words) words", tableName: "Essay", comment: "An essay's word count")
            .monospacedDigit()
        }
      }
    }
  }

  private var boxLabel: String {
    essay.drafts.isEmpty
      ? essay.rubric.writingName
      : String(localized: "Rewrite what needs work", table: "Essay", comment: "The rewrite box")
  }

  private var textBinding: Binding<String> {
    Binding(
      get: { text },
      set: { next in
        startedAt = startedAt ?? .now
        typed = next
        UnsentEssay.keep(next, blockId: essay.blockId)
      })
  }

  @ViewBuilder
  private var statusLine: some View {
    Group {
      if finishFailed {
        Text(
          "That didn't go through. Try again in a moment.", tableName: "Essay",
          comment: "Finishing the block failed"
        )
        .foregroundStyle(.destructive)
      } else if status == .failed {
        Text(
          "That didn't go through. Your text is still here. Try again in a moment.",
          tableName: "Essay", comment: "Grading failed"
        )
        .foregroundStyle(.destructive)
      } else if isWriting, status == .limitReached || essay.gradesLeft == 0 {
        Text(
          "You've used today's essay grades. Your text stays here; send it tomorrow.",
          tableName: "Essay", comment: "No essay grades left today"
        )
        .foregroundStyle(.secondary)
      } else if status == .grading {
        Group {
          if slow {
            Text(
              "Still grading. This is taking longer than usual.", tableName: "Essay",
              comment: "Grading is slow")
          } else {
            Text(
              "Reading your essay against each criterion. It can take up to 30 seconds.",
              tableName: "Essay", comment: "Grading a draft")
          }
        }
        .foregroundStyle(.secondary)
      }
    }
    .font(.subheadline)
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  /// Sends the text for grading, under the same id when it didn't change since a send that
  /// failed, so the server grades it once.
  private func send() async {
    let text = text
    let attemptId = ungraded?.text == text ? ungraded!.attemptId : UUID().uuidString.lowercased()
    let durationMs = startedAt.map { Int(Date.now.timeIntervalSince($0) * 1000) } ?? 0
    let blockId = essay.blockId
    ungraded = (attemptId, text)
    status = .grading
    slow = false

    let slowTask = Task {
      try? await Task.sleep(for: Self.slowAfter)
      if !Task.isCancelled { slow = true }
    }

    let result: MutationResult<EssaySubmission>? = await within(Self.timeout) { [store] in
      await store.write(invalidating: [.learnerModel, .userProgress]) { api, token in
        try await api.submitEssay(
          token: token, blockId: blockId, attemptId: attemptId, text: text, durationMs: durationMs)
      }
    }

    slowTask.cancel()

    switch result {
    case .done(.graded(let grade)):
      status = .idle
      startedAt = nil
      ungraded = nil
      typed = nil
      UnsentEssay.clear(blockId)
      resource.update { essay in
        var essay = essay
        essay.drafts.insert(.init(grade: grade, submittedAt: .now, text: text), at: 0)
        essay.gradesLeft = max(0, essay.gradesLeft - 1)
        return essay
      }
      writing = false
    case .done(.limitReached):
      status = .limitReached
    case .obsolete:
      status = .idle
    case .failed, nil:
      status = .failed
    }
  }

  /// Finishes the block and goes on with the session.
  private func finish() async {
    finishing = true
    finishFailed = false
    defer { finishing = false }
    let essay = essay

    switch await store.cache.mutate(
      invalidating: [.goals, .learnerModel, .userProgress, .userSession],
      { [api = practice.api] identity in
        try await api.finishStudyBlock(
          token: identity.bearerToken, sessionId: essay.sessionId, blockId: essay.blockId)
      })
    {
    case .done:
      dismiss()
      router.open(.session)
    case .failed:
      finishFailed = true
    case .obsolete:
      break
    }
  }
}

/// The text typed on this device and not graded yet, kept until it's graded, so opening the
/// essay again brings it back.
private enum UnsentEssay {
  private static func key(_ blockId: String) -> String { "essay.unsent.\(blockId)" }

  static func read(_ blockId: String) -> String? {
    UserDefaults.standard.string(forKey: key(blockId))
  }

  static func keep(_ text: String, blockId: String) {
    UserDefaults.standard.set(text, forKey: key(blockId))
  }

  static func clear(_ blockId: String) {
    UserDefaults.standard.removeObject(forKey: key(blockId))
  }
}
