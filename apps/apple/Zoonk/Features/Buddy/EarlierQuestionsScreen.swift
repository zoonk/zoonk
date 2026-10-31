import SwiftUI

/// The lessons are gone, so nothing links anywhere: it's history to read.
struct EarlierQuestionsScreen: View {
  @Environment(BuddyStore.self) private var store

  var body: some View {
    List {
      Section {
        switch store.earlierQuestions.state {
        case .idle, .loading:
          ProgressView()
            .frame(maxWidth: .infinity)
        case .failed:
          Button {
            Task { await store.earlierQuestions.refresh() }
          } label: {
            Text(
              "Something went wrong. Try again.", tableName: "Buddy",
              comment: "Earlier questions couldn't be read")
          }
        case .empty:
          Text(
            "You have no earlier questions.", tableName: "Buddy",
            comment: "The learner has no earlier questions"
          )
          .foregroundStyle(.secondary)
        case .loaded(let page):
          ForEach(page.questions, id: \.id) { question in
            EarlierQuestionRow(question: question)
          }

          if page.nextCursor != nil {
            Button {
              Task { await store.loadOlderQuestions() }
            } label: {
              if store.isLoadingOlder {
                ProgressView()
              } else {
                Text(
                  "Older questions", tableName: "Buddy", comment: "Shows older earlier questions")
              }
            }
            .disabled(store.isLoadingOlder)
          }

          if store.olderFailed {
            Text(
              "Something went wrong. Try again.", tableName: "Buddy",
              comment: "Older earlier questions couldn't be read"
            )
            .foregroundStyle(.destructive)
          }
        }
      } header: {
        Text(
          "What you asked in your courses before we rewrote them. The lessons changed, so your questions stay here to reread.",
          tableName: "Buddy", comment: "What the earlier questions page holds"
        )
        .textCase(nil)
      }
    }
    .navigationTitle(
      Text("Earlier questions", tableName: "Buddy", comment: "Title of the earlier questions page")
    )
    .loads(store.earlierQuestions)
  }
}

private struct EarlierQuestionRow: View {
  let question: Components.Schemas.EarlierQuestion

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      source
        .font(.caption)
        .foregroundStyle(.secondary)

      Text(question.question)
        .font(.headline)

      if let answer = question.answer {
        TutorAnswerText(text: answer, linksEnabled: false, buddyName: "")
          .font(.subheadline)
          .accessibilityLabel(Text(answer))
      } else {
        Text(
          "No answer was saved.", tableName: "Buddy",
          comment: "An earlier question without its answer"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }
    }
    .padding(.vertical, 4)
    .textSelection(.enabled)
  }

  private var source: Text {
    let course =
      question.courseTitle.map {
        Text(
          "From an earlier version of \($0)", tableName: "Buddy",
          comment: "Where an earlier question was asked; the argument is a course")
      }
      ?? Text(
        "From an earlier version of this course", tableName: "Buddy",
        comment: "Where an earlier question was asked")

    guard let lesson = question.lessonTitle else {
      return course
    }

    return Text("\(course) · \(lesson)")
  }
}
