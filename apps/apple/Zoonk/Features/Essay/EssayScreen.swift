import SwiftUI

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
          EssayContent(store: store, essay: view)
        }
      }
      .navigationTitle(
        essay.value?.rubric.promptLabel
          ?? String(localized: "Writing practice", table: "Essay", comment: "A writing task")
      )
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

private struct EssayContent: View {
  @Environment(ExamStore.self) private var store
  @Environment(PracticeStore.self) private var practice
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss
  @State private var writer: EssayWriter
  @State private var finishing = false
  @State private var finishFailed = false
  @State private var confirmsLeave = false
  @State private var openCriteria: Set<String> = []

  let essay: EssayView

  init(store: ExamStore, essay: EssayView) {
    _writer = State(initialValue: EssayWriter(store: store, blockId: essay.blockId))
    self.essay = essay
  }

  private var canSend: Bool {
    EssayWords.count(writer.text) > 0 && writer.status != .grading && essay.gradesLeft > 0
      && !finishing
  }

  var body: some View {
    Group {
      if writer.isWriting {
        PaneSplit {
          Form {
            promptSections
          }
        } secondary: {
          Form {
            writeSections
          }
          .safeAreaBar(edge: .bottom) { actionBar }
        } single: {
          Form {
            promptSections
            writeSections
          }
          .safeAreaBar(edge: .bottom) { actionBar }
        }
      } else if let grade = essay.drafts.first?.grade {
        PaneSplit {
          List {
            EssayGradeSections(grade: grade, isClosed: writer.isClosed)
          }
        } secondary: {
          List {
            EssayCommentsSection(grade: grade, openCriteria: $openCriteria)
          }
          // An essay too short to grade has no comments, and an empty list draws the plain
          // background.
          .scrollContentBackground(.hidden)
          .background(Color(.systemGroupedBackground))
          .safeAreaBar(edge: .bottom) { actionBar }
        } single: {
          List {
            EssayGradeSections(grade: grade, isClosed: writer.isClosed)
            EssayCommentsSection(grade: grade, openCriteria: $openCriteria)
          }
          .safeAreaBar(edge: .bottom) { actionBar }
        }
      } else {
        List {
          Section {
            ItemText(essay.question)
              .font(.headline)
          } footer: {
            Text(
              "You skipped this essay.", tableName: "Essay",
              comment: "An essay the learner skipped without sending a draft")
          }
        }
        .safeAreaBar(edge: .bottom) { actionBar }
      }
    }
    .toolbar {
      ToolbarItem(placement: .cancellationAction) {
        Button(role: .close) {
          if writer.isWriting, writer.unsent {
            confirmsLeave = true
          } else {
            dismiss()
          }
        }
      }
    }
    .interactiveDismissDisabled(writer.isWriting && writer.unsent)
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
  }

  private var actionBar: some View {
    VStack(spacing: 10) {
      if writer.isClosed {
        Button {
          router.showRoot(of: .today)
        } label: {
          Text("Back to Today", tableName: "Essay", comment: "Leaves a finished essay for Today")
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .keyboardShortcut(.defaultAction)
      } else {
        writeActions
      }
    }
    .scenePadding(.horizontal)
    .padding(.vertical, 10)
    .keepsOffFold()
  }

  @ViewBuilder
  private var writeActions: some View {
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
        .disabled(finishing || writer.status == .grading)
      }

      if writer.isWriting {
        Button {
          Task { await writer.send() }
        } label: {
          if writer.status == .grading {
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
          writer.writing = true
        } label: {
          Text("Rewrite", tableName: "Essay", comment: "Rewrites the essay")
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .keyboardShortcut(.defaultAction)
      }
    }
  }

  @ViewBuilder
  private var promptSections: some View {
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
  }

  @ViewBuilder
  private var writeSections: some View {
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
          writer.writing = false
        } label: {
          Text("See the grade", tableName: "Essay", comment: "Back to the last grade")
        }
      } header: {
        Text("Your last grade", tableName: "Essay", comment: "The last grade while rewriting")
      }
    }

    let words = EssayWords.count(writer.text)

    Section {
      TextEditor(text: $writer.text)
        .frame(minHeight: 280)
        .accessibilityLabel(Text(boxLabel))
        .accessibilityHint(EssayWords.hint(words))
    } header: {
      Text(boxLabel)
    } footer: {
      if words > 0 {
        EssayWords.text(words)
          .monospacedDigit()
      }
    }
  }

  private var boxLabel: String {
    essay.drafts.isEmpty
      ? essay.rubric.writingName
      : String(localized: "Rewrite what needs work", table: "Essay", comment: "The rewrite box")
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
      } else if writer.status == .failed {
        Text(
          "That didn't go through. Your text is still here. Try again in a moment.",
          tableName: "Essay", comment: "Grading failed"
        )
        .foregroundStyle(.destructive)
      } else if writer.isWriting, writer.status == .dailyLimitReached {
        VStack(alignment: .leading, spacing: 2) {
          Text(
            "You've reached your daily time limit. Your text stays here.", tableName: "Essay",
            comment: "The daily time limit is a setting that stops study for the day"
          )
          .foregroundStyle(.secondary)
          ChangeLimitButton()
        }
      } else if writer.isWriting, writer.status == .limitReached || essay.gradesLeft == 0 {
        Text(
          "You've used today's essay grades. Your text stays here; send it tomorrow.",
          tableName: "Essay", comment: "No essay grades left today"
        )
        .foregroundStyle(.secondary)
      } else if writer.status == .grading {
        Group {
          if writer.slow {
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
      writer.didFinish()
      dismiss()
    case .failed:
      finishFailed = true
    case .obsolete:
      break
    }
  }
}
