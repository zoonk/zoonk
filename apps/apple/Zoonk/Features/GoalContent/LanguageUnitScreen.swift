import SwiftUI

struct LanguageUnit: Decodable, Equatable, Sendable {
  struct Conversation: Decodable, Equatable, Sendable {
    struct Character: Decodable, Equatable, Sendable {
      let name: String
      let role: String
    }

    /// Nil while the unit has no character of its own yet.
    let character: Character?
    let defaultMinutes: Int
    let minutes: [Int]
    let paused: Bool
    let plusMinutes: [Int]
  }

  struct Lesson: Decodable, Equatable, Identifiable, Sendable {
    let lessonId: String
    let minutes: Int
    let state: GoalChapter.Lesson.State
    let title: String

    var id: String { lessonId }
  }

  struct Mistake: Decodable, Equatable, Identifiable, Sendable {
    enum Skill: String, Decodable, Sendable {
      case listening, speaking, words, writing
    }

    let answer: String?
    let correctAnswer: String?
    let explanation: String?
    let id: String
    let question: String
    let skill: Skill
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
  let conversation: Conversation?
  let goalId: String?
  let grammarTips: [Tip]
  let lessons: [Lesson]
  let mistakes: [Mistake]
  let unit: Unit
  let words: Words?
}

extension GoalContentAPI {
  func unit(token: String, goalId: String?, chapterId: String) async throws -> LanguageUnit {
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
  @State private var isReporting = false

  let chapterId: String

  var body: some View {
    if let summary = learner.summary.value {
      let unit = store.unit(goalId: summary.shownGoal?.id, chapterId: chapterId)

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
      .toolbar {
        ToolbarItem(placement: .primaryAction) {
          TutorAskButton(scope: .chapter(chapterId: chapterId))
        }

        ToolbarItem(placement: .primaryAction) {
          Menu {
            Button {
              isReporting = true
            } label: {
              Label {
                Text(
                  "Report a problem", tableName: "Plan",
                  comment: "Opens the feedback form about the unit page")
              } icon: {
                Image(systemName: "flag")
              }
            }
          } label: {
            Label {
              Text("Unit options", tableName: "Plan", comment: "Spoken label of the unit's … menu")
            } icon: {
              Image(systemName: "ellipsis")
            }
          }
        }
      }
      .sheet(isPresented: $isReporting) {
        FeedbackSheet(
          api: FeedbackAPI.live(),
          context: FeedbackContext(contentID: chapterId, contentKind: .chapter, screen: "unit"),
          isReport: true)
      }
      .loads(unit)
    }
  }
}

private struct LanguageUnitContent: View {
  @Environment(AppRouter.self) private var router
  /// Above the split: folding iPhone Duo recreates its panes, and the call's picker is in one.
  @State private var callMinutes: Int?

  let unit: LanguageUnit

  var body: some View {
    PaneSplit(primaryShare: 0.55) {
      List {
        unitAndLessons
      }
    } secondary: {
      List {
        practice
      }
    } single: {
      List {
        unitAndLessons
        practice
      }
    }
  }

  @ViewBuilder
  private var unitAndLessons: some View {
    let lessons = unit.lessons
    let done = lessons.filter { $0.state == .done }.count
    let next = lessons.first { $0.state == .next }

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
        ForEach(Array(lessons.enumerated()), id: \.element.id) { index, lesson in
          Button {
            router.open(.lesson(lessonId: lesson.lessonId))
          } label: {
            LessonRow(
              lesson: GoalChapter.Lesson(
                lessonId: lesson.lessonId, minutes: lesson.minutes, plusRequired: false,
                state: lesson.state, title: lesson.title),
              number: index + 1)
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

  }

  @ViewBuilder
  private var practice: some View {
    if let conversation = unit.conversation {
      UnitPracticeCallSection(
        conversation: conversation, chapterId: unit.unit.chapterId, goalId: unit.goalId,
        minutes: $callMinutes)
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
          "\(words.count) words", tableName: "Plan",
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
          VStack(alignment: .leading, spacing: 8) {
            skillName(mistake.skill)
              .font(.caption.weight(.medium))
              .foregroundStyle(.secondary)

            ItemText(mistake.question)
              .font(.subheadline.weight(.medium))

            if let answer = mistake.answer {
              MistakeAnswerRow(text: answer, isRight: false)
            }

            if let correctAnswer = mistake.correctAnswer {
              MistakeAnswerRow(text: correctAnswer, isRight: true)
            }

            if let explanation = mistake.explanation {
              ItemText(explanation)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
          }
          .padding(.vertical, 4)
        }
      } header: {
        Text("Your mistakes", tableName: "Plan", comment: "Section of a unit's mistakes")
      }
    }
  }

  private func skillName(_ skill: LanguageUnit.Mistake.Skill) -> Text {
    switch skill {
    case .listening: Text("Listening", tableName: "Plan", comment: "A language skill")
    case .speaking: Text("Speaking", tableName: "Plan", comment: "A language skill")
    case .words: Text("Words", tableName: "Plan", comment: "A language skill")
    case .writing: Text("Writing", tableName: "Plan", comment: "A language skill")
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

private struct UnitPracticeCallSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(VoiceServices.self) private var voice
  @State private var outcome: CallReservation?
  @State private var isStarting = false

  let conversation: LanguageUnit.Conversation
  let chapterId: String
  let goalId: String?
  @Binding var minutes: Int?

  var body: some View {
    let isPlus = learner.summary.value?.tier == .plus
    let picked = minutes ?? conversation.defaultMinutes

    Section {
      if conversation.paused || outcome == .callsPaused {
        VStack(alignment: .leading, spacing: 2) {
          Text(
            "Calls are paused", tableName: "Plan", comment: "Practice calls are paused for everyone"
          )
          Text(
            "It's the same for everyone right now. Try again later.", tableName: "Plan",
            comment: "Explains paused practice calls"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
      } else {
        Picker(selection: Binding(get: { picked }, set: { minutes = $0 })) {
          ForEach(conversation.minutes + (isPlus ? [] : conversation.plusMinutes), id: \.self) {
            length in
            Text(planDurationText(minutes: Double(length))).tag(length)
          }
        } label: {
          Text("Call length", tableName: "Plan", comment: "Picks the practice call's length")
        }

        if !isPlus && conversation.plusMinutes.contains(picked) || outcome == .plusRequired {
          PlusNotice(
            description: Text(
              "Longer calls come with Plus.", tableName: "Plan",
              comment: "Says longer practice calls need Plus"),
            isInset: true)
        } else {
          Button {
            Task { await start(minutes: picked) }
          } label: {
            if isStarting {
              Text("Starting…", tableName: "Plan", comment: "The practice call is starting")
            } else {
              Text("Start the call", tableName: "Plan", comment: "Starts the practice call")
            }
          }
          .disabled(isStarting)
        }

        if case .limit(let limit) = outcome {
          Group {
            if limit.period == .month {
              Text(
                "Not enough call time this month.", tableName: "Plan",
                comment: "The plan's call time this month is used")
            } else {
              Text(
                "Not enough call time today.", tableName: "Plan",
                comment: "The plan's call time today is used")
            }
          }
          .foregroundStyle(.destructive)
        } else if outcome == .failed || outcome == .callInProgress
          || outcome == .previousConnectionClosing || outcome == .ended
        {
          Text(
            "The call didn't start. Try again in a moment.", tableName: "Plan",
            comment: "Says the practice call didn't start"
          )
          .foregroundStyle(.destructive)
        }
      }
    } header: {
      Text(
        "Practice a conversation", tableName: "Plan", comment: "Section of the unit's practice call"
      )
    } footer: {
      if let character = conversation.character {
        Text(
          "with \(character.name) · \(character.role)", tableName: "Plan",
          comment: "Who the practice call is with: the character's name and role")
      }
    }
  }

  /// Only from the learner's tap: it writes the call's card.
  private func start(minutes: Int) async {
    guard
      let input: Components.Schemas.LanguageConversationStartInput = try? PracticeJSON.recode(
        PracticeCallRequest(chapterId: chapterId, goalId: goalId, minutes: minutes))
    else {
      return
    }

    isStarting = true
    outcome = nil
    defer { isStarting = false }

    switch await voice.startConversation(input) {
    case .done(.done(let id)):
      router.open(.conversation(conversationId: id))
    case .done(.refused(let refusal)):
      outcome = CallReservation(refusal: refusal)
    case .failed:
      outcome = .failed
    case .obsolete:
      break
    }
  }
}

private struct PracticeCallRequest: Encodable {
  let chapterId: String
  let goalId: String?
  let kind = "practice"
  let minutes: Int
}
