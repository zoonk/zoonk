import SwiftUI

/// A past answer from the written part's page, read as its result was.
struct WritingAnswerScreen: View {
  @Environment(ExamStore.self) private var store
  @Environment(\.dismiss) private var dismiss

  let attemptId: String

  var body: some View {
    let attempt = store.writingAttempt(id: attemptId)

    NavigationStack {
      Group {
        switch attempt.state {
        case .idle, .loading:
          ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .empty, .failed(.notFound):
          NotFoundView()
        case .failed:
          PageLoadFailure {
            Label {
              Text("The answer didn't load", tableName: "Essay", comment: "Loading failed")
            } icon: {
              Image(systemName: "wifi.exclamationmark")
            }
          } retry: {
            await attempt.refresh()
          }
        case .loaded(let answer):
          ZoonkList {
            WritingResultSections(grade: answer.grade, prompt: answer.writing, text: answer.text)
          }
          .lonePage()
        }
      }
      .navigationTitle(attempt.value?.writing.title ?? "")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) { dismiss() }
        }
      }
    }
    .loads(attempt)
  }
}
