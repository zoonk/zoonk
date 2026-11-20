import SwiftUI

/// The lessons are gone, so nothing links anywhere: it's history to read.
struct EarlierQuestionsScreen: View {
  @Environment(BuddyStore.self) private var store

  var body: some View {
    content
      .barTitleAfterHero(
        String(
          localized: "Earlier questions", table: "Buddy",
          comment: "Title of the earlier questions page")
      )
      .loads(store.earlierQuestions)
  }

  @ViewBuilder
  private var content: some View {
    switch store.earlierQuestions.state {
    case .empty:
      StateMessage {
        Label {
          Text("No earlier questions", tableName: "Buddy")
        } icon: {
          Image(systemName: "clock.arrow.circlepath")
        }
      } description: {
        Text(
          "When a lesson you asked about is updated, your questions and their answers are kept here.",
          tableName: "Buddy")
      }
      .lonePage()
    default:
      ZoonkList {
        Section {
          PageHeader(
            Text(
              "Earlier questions", tableName: "Buddy",
              comment: "Title of the earlier questions page"),
            supporting: Text(
              "Your questions from lessons that were updated, with their answers.",
              tableName: "Buddy"))
        }

        Section {
          questions
        }
      }
    }
  }

  @ViewBuilder
  private var questions: some View {
    switch store.earlierQuestions.state {
    case .idle, .loading, .empty:
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
    case .loaded(let page):
      ForEach(page.questions, id: \.id) { question in
        EarlierQuestionRow(question: question)
      }

      if page.nextCursor != nil {
        BusyButton(isBusy: store.isLoadingOlder, isRow: true) {
          Task { await store.loadOlderQuestions() }
        } label: {
          Text("Older questions", tableName: "Buddy", comment: "Shows older earlier questions")
        }
      }

      if store.olderFailed {
        FailureLine(
          message: LocalizedStringResource(
            "Something went wrong. Try again.", table: "Buddy",
            comment: "Older earlier questions couldn't be read"))
      }
    }
  }
}

private struct EarlierQuestionRow: View {
  let question: Components.Schemas.EarlierQuestion

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Chip(source)

      Text(question.question)
        .typeStyle(.body.weight(.semibold))

      if let answer = question.answer {
        TutorAnswerText(text: answer, linksEnabled: false, buddyName: nil)
          .typeStyle(.message)
      } else {
        Text(
          "No answer was saved.", tableName: "Buddy",
          comment: "An earlier question without its answer"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
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

    return Text("\(course)\u{00A0}· \(lesson)")
  }
}
