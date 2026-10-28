import SwiftUI

/// A language goal's unit (`GET /language-units/{chapterId}`): what it teaches, its lessons with
/// the next one, its grammar tips and words, a test that skips it, and the unit's mistakes.
struct LanguageUnit: Decodable, Equatable, Sendable {
  struct Lesson: Decodable, Equatable, Identifiable, Sendable {
    let lessonId: String
    let minutes: Int
    let state: GoalChapter.Lesson.State
    let title: String

    var id: String { lessonId }
  }

  struct Mistake: Decodable, Equatable, Identifiable, Sendable {
    let answer: String
    let correctAnswer: String
    let id: String
    let question: String
  }

  struct Tip: Decodable, Equatable, Hashable, Sendable {
    let text: String
    let title: String
  }

  struct Unit: Decodable, Equatable, Sendable {
    let chapterId: String
    let description: String?
    let levelRange: String?
    let objectives: [String]
    let position: Int
    let title: String
  }

  struct Words: Decodable, Equatable, Sendable {
    let count: Int
    let sample: [String]
  }

  let canTestOut: Bool
  let grammarTips: [Tip]
  let lessons: [Lesson]
  let mistakes: [Mistake]
  let unit: Unit
  let words: Words?
}

extension GoalContentAPI {
  func unit(token: String, goalId: String, chapterId: String) async throws -> LanguageUnit {
    try await clients.perform(token: token) { client in
      switch try await client.getLanguageUnit(
        path: .init(chapterId: chapterId), query: .init(goalId: goalId))
      {
      case .ok(let response): return try PracticeJSON.recode(try response.body.json)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }
}

struct LanguageUnitScreen: View {
  @Environment(GoalContentStore.self) private var store
  @Environment(LearnerSummaryStore.self) private var learner

  let chapterId: String

  var body: some View {
    if let goal = learner.summary.value?.shownGoal {
      let unit = store.unit(goalId: goal.id, chapterId: chapterId)

      Group {
        switch unit.state {
        case .loaded(let value):
          LanguageUnitContent(unit: value)
        case .failed(.notFound), .empty:
          ContentUnavailableView {
            Label {
              Text(
                "This unit isn't in your plan", tableName: "Plan",
                comment: "Shown for a unit that isn't in the learner's plan")
            } icon: {
              Image(systemName: "character.book.closed")
            }
          }
        case .failed:
          ContentUnavailableView {
            Label {
              Text(
                "Couldn't load this unit", tableName: "Plan",
                comment: "Title shown when a language unit failed to load")
            } icon: {
              Image(systemName: "wifi.exclamationmark")
            }
          } actions: {
            Button {
              Task { await unit.refresh() }
            } label: {
              Text("Try again", tableName: "Plan", comment: "Retries loading the plan")
            }
            .buttonStyle(.bordered)
          }
        case .idle, .loading:
          ProgressView()
        }
      }
      .navigationTitle(unit.value.map { Text($0.unit.title) } ?? Text(verbatim: ""))
      .toolbarTitleDisplayMode(.inline)
      // The page heads itself with its title, as main does; the bar keeps it for the back button.
      .toolbar(removing: .title)
      .loads(unit)
    }
  }
}

private struct LanguageUnitContent: View {
  @Environment(AppRouter.self) private var router

  let unit: LanguageUnit

  var body: some View {
    let lessons = unit.lessons
    let done = lessons.filter { $0.state == .done }.count
    let next = lessons.first { $0.state == .next }

    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          eyebrow
            .font(.subheadline)
            .foregroundStyle(.secondary)

          Text(unit.unit.title)
            .font(.title2.weight(.semibold))

          if let description = unit.unit.description, !description.isEmpty {
            Text(description)
              .foregroundStyle(.secondary)
          }

          if let next {
            Button {
              router.open(.lesson(lessonId: next.lessonId))
            } label: {
              Group {
                if done > 0 {
                  Text("Continue", tableName: "Plan", comment: "Opens the unit's next lesson")
                } else {
                  Text("Start", tableName: "Plan", comment: "Opens the unit's first lesson")
                }
              }
              .frame(maxWidth: .infinity)
            }
            .buttonStyle(.mainAction)
            .controlSize(.large)
            .padding(.top, 8)
          }
        }
        .padding(.vertical, 4)
      }

      if !unit.unit.objectives.isEmpty {
        Section {
          ForEach(unit.unit.objectives, id: \.self) { objective in
            Label {
              Text(objective)
            } icon: {
              Image(systemName: "checkmark.circle")
                .foregroundStyle(.secondary)
            }
          }
        } header: {
          Text("You'll be able to", tableName: "Plan", comment: "Section of what a unit teaches")
        }
      }

      if !lessons.isEmpty {
        Section {
          ForEach(lessons) { lesson in
            Button {
              router.open(.lesson(lessonId: lesson.lessonId))
            } label: {
              LessonRow(
                lesson: GoalChapter.Lesson(
                  lessonId: lesson.lessonId, minutes: lesson.minutes, plusRequired: false,
                  state: lesson.state, title: lesson.title))
            }
          }
        } header: {
          HStack {
            Text("Lessons", tableName: "Plan", comment: "Section of a chapter's lessons")
            Spacer()
            Text(
              "\(done) of \(lessons.count)", tableName: "Plan",
              comment: "Lessons done of the chapter's lessons"
            )
            .monospacedDigit()
          }
        }
      }

      if !unit.grammarTips.isEmpty {
        Section {
          ForEach(unit.grammarTips, id: \.self) { tip in
            DisclosureGroup {
              Text((try? AttributedString(markdown: tip.text)) ?? AttributedString(tip.text))
                .foregroundStyle(.secondary)
            } label: {
              Text(tip.title)
            }
          }
        } header: {
          Text("Grammar tips", tableName: "Plan", comment: "Section of a unit's grammar tips")
        }
      }

      if let words = unit.words, words.count > 0 {
        Section {
          Text(words.sample.formatted(.list(type: .and)))
            .foregroundStyle(.secondary)
        } header: {
          Text(
            "^[\(words.count) word](inflect: true)", tableName: "Plan",
            comment: "Section of a unit's words, with how many it teaches")
        }
      }

      if unit.canTestOut {
        Section {
          Button {
            router.open(.testOut(chapterId: unit.unit.chapterId))
          } label: {
            VStack(alignment: .leading, spacing: 2) {
              Text(
                "Already know this?", tableName: "Plan", comment: "Offers the chapter's test-out"
              )
              .foregroundStyle(.primary)

              Text(
                "Take the test and skip the unit", tableName: "Plan",
                comment: "What the unit's test-out does"
              )
              .font(.subheadline)
              .foregroundStyle(.secondary)
            }
          }
        }
      }

      if !unit.mistakes.isEmpty {
        Section {
          ForEach(unit.mistakes) { mistake in
            VStack(alignment: .leading, spacing: 4) {
              Text(mistake.question)

              Text(
                "You answered: \(mistake.answer)", tableName: "Plan",
                comment: "The learner's wrong answer to a unit question"
              )
              .foregroundStyle(.destructive)

              Text(
                "Answer: \(mistake.correctAnswer)", tableName: "Plan",
                comment: "The right answer to a unit question"
              )
              .foregroundStyle(.secondary)
            }
            .font(.subheadline)
          }
        } header: {
          Text("Your mistakes", tableName: "Plan", comment: "Section of a unit's mistakes")
        }
      }
    }
  }

  private var eyebrow: Text {
    if let range = unit.unit.levelRange, !range.isEmpty {
      return Text(
        "Unit \(unit.unit.position) · \(range)", tableName: "Plan",
        comment: "A unit's number and its level range")
    }

    return Text("Unit \(unit.unit.position)", tableName: "Plan", comment: "A unit's number")
  }
}
