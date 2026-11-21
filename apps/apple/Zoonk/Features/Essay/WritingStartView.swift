import SwiftUI

/// Before the question exists: it's being written, its writing failed, or the day's extra grades
/// are used. Asking again is always the learner's tap, or the run they started ending.
struct WritingStartView: View {
  @Environment(ExamStore.self) private var store
  @Environment(\.dismiss) private var dismiss

  let blockId: String
  let start: WritingStart
  let onReady: (WritingStart) -> Void

  @State private var asking = VisitRequest<WritingStart>()
  @State private var viewedWait: String?

  private var shown: WritingStart { asking.outcome ?? start }

  var body: some View {
    Group {
      switch shown {
      case .limitReached(_, let task):
        WritingRefusedView(
          task: task.map { .init(title: $0.description, minutes: $0.minutes) }, isBusy: false,
          onContinue: { dismiss() })
      case .writing(let generationId):
        waiting(generationId)
      case .signUpRequired:
        ZoonkList {
          Section { LimitNotice(limit: .signUpRequired) }
        }
        .lonePage()
      case .failed, .ready:
        failed
      }
    }
    .navigationTitle(
      String(localized: "Written answer", table: "Essay", comment: "An exam's written question")
    )
    .toolbar {
      ToolbarItem(placement: .cancellationAction) {
        Button(role: .close) { dismiss() }
      }
    }
    .onDisappear { asking.leave() }
  }

  private func waiting(_ generationId: String) -> some View {
    ZoonkList {
      Section {
        PageHeader(
          Text("Writing your question…", tableName: "Essay", comment: "A question being written"),
          supporting: Text(
            "A new question, like the ones on your exam. It opens here when it's ready.",
            tableName: "Essay", comment: "While a written question is being written")
        ) {
          EmptyView()
        }
      }
      Section {
        WritingWait(
          title: Text(
            "Writing a question like your exam's", tableName: "Essay",
            comment: "The step of writing a question"),
          hint: Text(
            "Checking it against the exam's criteria…", tableName: "Essay",
            comment: "Under the step of writing a question"))
      }
    }
    .lonePage()
    .onAppear {
      if viewedWait != generationId {
        viewedWait = generationId
        UsageAnalytics.track(
          .writingPromptWaitViewed(generationID: generationId, surface: "practice"))
      }

      follow(generationId)
    }
  }

  private var failed: some View {
    ZoonkList {
      Section {
        PageHeader(
          Text(
            "We couldn't write your question", tableName: "Essay",
            comment: "Writing a question failed"),
          supporting: Text(
            "Nothing was lost. Try again in a moment.", tableName: "Essay",
            comment: "After a question's writing failed")
        ) {
          EmptyView()
        }
      }
    }
    .lonePage()
    .bottomBar {
      BusyButton(isBusy: asking.isRunning) {
        ask()
      } label: {
        Text("Try again", tableName: "Essay", comment: "Asks for the question again")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    }
  }

  /// The run ending asks again: its start then admits the grading.
  private func follow(_ generationId: String) {
    guard !asking.isRunning else { return }

    asking.run {
      do {
        try await store.waitForWritingPrompt(generationId: generationId)
      } catch is CancellationError {
        return nil
      } catch {
        return .failed
      }

      return await answer()
    } then: { started in
      if case .ready = started { onReady(started ?? .failed) }
    }
  }

  private func ask() {
    asking.run {
      await answer()
    } then: { started in
      if case .ready = started { onReady(started ?? .failed) }
    }
  }

  private func answer() async -> WritingStart {
    switch await store.startWriting(blockId: blockId) {
    case .done(let started): started
    case .failed, .obsolete: .failed
    }
  }
}

/// Refused before writing: the day's extra grades are used, and the task waits for tomorrow, so
/// nothing written is ever lost to a limit.
struct WritingRefusedView: View {
  struct Task: Hashable {
    let title: String
    let minutes: Int?
  }

  let task: Task?
  let isBusy: Bool
  let onContinue: () -> Void

  var body: some View {
    ZoonkList {
      Section {
        VStack(alignment: .leading, spacing: 12) {
          Image(systemName: "clock")
            .typeStyle(.section)
            .foregroundStyle(.mutedForeground)
            .accessibilityHidden(true)
          PageHeader(
            Text("No more grading today", tableName: "Essay", comment: "Extra grades used up"),
            supporting: Text(
              "You'll have more tomorrow.", tableName: "Essay",
              comment: "When grading comes back")
          ) {
            EmptyView()
          }
        }
      }

      if let task {
        Section {
          ListRow(Text(task.title)) {
            KindMark(kind: .essay)
          } trailing: {
            if let minutes = task.minutes {
              Text(studyDuration(minutes: minutes))
                .typeStyle(.data)
            }
          }
        } header: {
          SectionTitle(
            Text("Left for tomorrow", tableName: "Essay", comment: "The task that waits"))
        }
      }
    }
    .lonePage()
    .bottomBar {
      BusyButton(isBusy: isBusy) {
        onContinue()
      } label: {
        Text("Continue", tableName: "Essay", comment: "Goes on after the refusal")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    }
  }
}
