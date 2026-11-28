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
    /// When no call time is left; the server then sends no lengths.
    let limit: CallTimeLimit?
  }

  /// Which call time is used up, and when it comes back.
  struct CallTimeLimit: Decodable, Equatable, Sendable {
    let availableAt: Date?
    let period: String
    let tier: LearnerTier

    var helpLimit: HelpLimit {
      .reached(period: period, tier: tier, availableAt: availableAt)
    }
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

  /// A pattern noticed in the unit's recent mistakes; `typos` when they were slips.
  struct Pattern: Decodable, Equatable, Sendable {
    let id: String
    let kind: String
    let title: String
  }

  /// Mispronounced words due to be said again today; `words` names the first few.
  struct Pronunciation: Decodable, Equatable, Sendable {
    let count: Int
    let words: [String]
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
    let position: Int?
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
  let pattern: Pattern?
  let pronunciation: Pronunciation?
  /// The finished lessons' summary cards, in lesson order.
  let summaries: [GoalChapter.Summary]
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
          StateMessage {
            Label {
              Text(
                "This unit isn't in your plan", tableName: "Plan",
                comment: "Shown for a unit that isn't in the learner's plan")
            } icon: {
              Image(systemName: "character.book.closed")
            }
          }
          .lonePage()
        case .failed:
          PageLoadFailure {
            Label {
              Text(
                "Couldn't load this unit", tableName: "Plan",
                comment: "Title shown when a language unit failed to load")
            } icon: {
              Image(systemName: "wifi.exclamationmark")
            }
          } retry: {
            await unit.refresh()
          }
        case .idle, .loading:
          ProgressView()
        }
      }
      .barTitleAfterHero(
        unit.value?.unit.title
          ?? String(
            localized: "Unit", table: "Navigation",
            comment: "Title shown instead of a unit of a language plan until it can open")
      )
      .toolbar {
        TutorAskToolbarItem(scope: .chapter(chapterId: chapterId))

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
      .feedbackSheet(
        isPresented: $isReporting,
        context: FeedbackContext(contentID: chapterId, contentKind: .chapter, screen: "unit"),
        isReport: true
      )
      .loads(unit)
    }
  }
}

private struct LanguageUnitContent: View {
  @Environment(AppRouter.self) private var router
  @Environment(\.legibilityWeight) private var legibilityWeight
  /// Above the split: folding iPhone Duo recreates its panes, and the call's picker is in one.
  @State private var callMinutes: Int?
  @State private var callSetup = PracticeCallSetup()
  @ScaledMetric(relativeTo: .body) private var markSize = 14.0

  let unit: LanguageUnit

  var body: some View {
    PaneSplit(primaryShare: 0.55) {
      ZoonkList {
        unitAndLessons
      }
    } secondary: {
      ZoonkList {
        practice
      }
    } single: {
      ZoonkList {
        unitAndLessons
        practice
      }
    }
    .bottomBar {
      if let next = unit.lessons.first(where: { $0.state == .next }) {
        Button {
          router.open(.lesson(lessonId: next.lessonId))
        } label: {
          if unit.lessons.contains(where: { $0.state == .done }) {
            Text("Continue", tableName: "Plan", comment: "Opens the unit's next lesson")
          } else {
            Text("Start", tableName: "Plan", comment: "Opens the unit's first lesson")
          }
        }
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
      }
    }
    .sheet(isPresented: $callSetup.isOpen) {
      if let conversation = unit.conversation {
        NavigationStack {
          ZoonkList {
            PracticeCallSection(
              conversation: conversation, chapterId: unit.unit.chapterId, goalId: unit.goalId,
              minutes: $callMinutes, start: callSetup.start
            ) { conversationId in
              callSetup.isOpen = false
              router.open(.conversation(conversationId: conversationId))
            }
          }
        }
        .presentationDetents([.medium, .large])
        .zoonkSheet()
      }
    }
    .onDisappear {
      callSetup.start.leave()
    }
  }

  @ViewBuilder
  private var unitAndLessons: some View {
    let lessons = unit.lessons
    let done = lessons.filter { $0.state == .done }.count

    Section {
      PageHeader(Text(unit.unit.title), facts: facts)
    }

    if !lessons.isEmpty {
      Section {
        ForEach(Array(lessons.enumerated()), id: \.element.id) { index, lesson in
          Button {
            router.open(.lesson(lessonId: lesson.lessonId))
          } label: {
            LessonRow(
              lesson: GoalChapter.Lesson(
                lessonId: lesson.lessonId, minutes: lesson.minutes,
                state: lesson.state, title: lesson.title),
              number: index + 1)
          }
          .currentRow(lesson.state == .next)
        }
      } header: {
        SectionTitle(
          Text("Lessons", tableName: "Plan", comment: "Section of a chapter's lessons")
        ) {
          Text(
            "\(done) of \(lessons.count)", tableName: "Plan",
            comment: "Lessons done of the chapter's lessons"
          )
          .monospacedDigit()
        }
      }
    }

    if !unit.unit.objectives.isEmpty {
      let finished = !lessons.isEmpty && done == lessons.count

      Section {
        ForEach(unit.unit.objectives.prefix(3), id: \.self) { objective in
          Label {
            Text(objective)
          } icon: {
            CanDoMark(done: finished)
          }
        }
      } header: {
        if finished {
          SectionTitle(
            Text(
              "I can already…", tableName: "Plan", comment: "Section of what a finished unit taught"
            ))
        } else {
          SectionTitle(
            Text(
              "By the end of this unit", tableName: "Plan",
              comment: "Section of what a unit teaches"))
        }
      }
    }

  }

  @ViewBuilder
  private var practice: some View {
    if unit.conversation != nil || unit.canTestOut || !unit.mistakes.isEmpty || unit.pattern != nil
      || unit.pronunciation != nil
    {
      Section {
        if let conversation = unit.conversation {
          conversationRow(conversation)
        }

        if unit.canTestOut {
          Button {
            router.open(.testOut(chapterId: unit.unit.chapterId))
          } label: {
            ListRow(
              Text(
                "Already know this?", tableName: "Plan", comment: "Offers the chapter's test-out"),
              description: Text(
                "Take the test and skip the unit", tableName: "Plan",
                comment: "What the unit's test-out does")
            ) {
              KindDot(kind: .practice)
            }
            .disclosureChevron()
          }
        }

        if !unit.mistakes.isEmpty {
          DisclosureGroup {
            ForEach(unit.mistakes) { mistake in
              mistakeRow(mistake)
            }
          } label: {
            ListRow(
              Text("Your mistakes", tableName: "Plan", comment: "Section of a unit's mistakes")
            ) {
              KindDot(kind: .mistakes)
            } trailing: {
              Text(unit.mistakes.count, format: .number)
            }
          }
        }

        patternAndPronunciation
      } header: {
        SectionTitle(
          Text("Practice", tableName: "Plan", comment: "Section of a chapter's practice"))
      }
    }

    reference
  }

  /// Main's `PracticeConversation`: a row that opens the call's setup, or says calls are paused.
  @ViewBuilder
  private func conversationRow(_ conversation: LanguageUnit.Conversation) -> some View {
    let title = Text(
      "Practice a conversation", tableName: "Plan", comment: "Section of the unit's practice call")

    if conversation.paused {
      ListRow(
        title,
        description: Text(
          "Calls are paused", tableName: "Plan", comment: "Practice calls are paused for everyone")
      ) {
        KindDot(kind: .conversation)
      }
    } else {
      Button {
        callSetup.isOpen = true
      } label: {
        ListRow(
          title,
          description: conversation.character.map { character in
            Text(
              "with \(character.name)\u{00A0}· \(character.role)", tableName: "Plan",
              comment: "Who the practice call is with: the character's name and role")
          }
        ) {
          KindDot(kind: .conversation)
        }
      }
    }
  }

  private func mistakeRow(_ mistake: LanguageUnit.Mistake) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      skillName(mistake.skill)
        .typeStyle(.meta.weight(.medium))
        .foregroundStyle(.mutedForeground)

      LessonTextBlocks(mistake.question)
        .typeStyle(.body.weight(.medium))

      if let answer = mistake.answer {
        MistakeAnswerRow(text: answer, isRight: false, isLiteral: true)
      }

      if let correctAnswer = mistake.correctAnswer {
        MistakeAnswerRow(text: correctAnswer, isRight: true, isLiteral: true)
      }

      if let explanation = mistake.explanation {
        LessonTextBlocks(explanation)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }
    }
    .padding(.vertical, 4)
  }

  @ViewBuilder
  private var patternAndPronunciation: some View {
    if let pattern = unit.pattern {
      Button {
        router.open(.pattern(patternId: pattern.id))
      } label: {
        if pattern.kind == "typos" {
          practiceRow(
            title: Text("Just typos", tableName: "Plan", comment: "Recent mistakes were slips"),
            detail: Text(
              "Your recent mistakes were typos, not a rule to learn.", tableName: "Plan"),
            systemImage: "keyboard")
        } else {
          practiceRow(
            title: Text(
              "We noticed a pattern", tableName: "Plan",
              comment: "A rule the learner keeps getting wrong, noticed in the unit's mistakes"),
            detail: Text(pattern.title), systemImage: "sparkles")
        }
      }
    }

    if let pronunciation = unit.pronunciation {
      Button {
        router.open(.pronunciation(goalId: unit.goalId))
      } label: {
        practiceRow(
          title: Text(
            "Say \(pronunciation.count) words again", tableName: "Plan",
            comment: "Mispronounced words due to be said again today"),
          detail: Text(pronunciation.words.formatted(.list(type: .and))),
          systemImage: "mic")
      }
    }
  }

  /// Main's "For reference": the unit's grammar tips, its words and its lessons' summaries, folded.
  @ViewBuilder
  private var reference: some View {
    let words = unit.words.flatMap { $0.count > 0 ? $0 : nil }

    if !unit.grammarTips.isEmpty || words != nil || !unit.summaries.isEmpty {
      Section {
        if !unit.grammarTips.isEmpty {
          DisclosureGroup {
            ForEach(unit.grammarTips, id: \.self) { tip in
              VStack(alignment: .leading, spacing: 4) {
                Text(tip.title)
                  .typeStyle(.body.weight(.semibold))
                  .accessibilityAddTraits(.isHeader)
                Text(
                  (try? AttributedString(markdown: tip.text)) ?? AttributedString(tip.text),
                  legibility: legibilityWeight
                )
                .foregroundStyle(.mutedForeground)
              }
            }
          } label: {
            ListRow(
              Text("Grammar tips", tableName: "Plan", comment: "Section of a unit's grammar tips")
            ) {
              referenceMark("book.pages")
            } trailing: {
              Text(unit.grammarTips.count, format: .number)
            }
          }
        }

        if let words {
          DisclosureGroup {
            Text(wordsLine(words))
              .foregroundStyle(.mutedForeground)
          } label: {
            ListRow(
              Text(
                "Words in this unit", tableName: "Plan",
                comment: "Folds a few of the words a unit teaches")
            ) {
              referenceMark("translate")
            } trailing: {
              Text(words.count, format: .number)
            }
          }
        }

        if !unit.summaries.isEmpty {
          DisclosureGroup {
            LessonSummaries(summaries: unit.summaries)
          } label: {
            ListRow(
              Text("Unit summary", tableName: "Plan", comment: "Folds a unit's lesson summaries")
            ) {
              // Main's lucide NotebookText, as on the chapter page.
              referenceMark("text.book.closed")
            }
          }
        }
      } header: {
        SectionTitle(
          Text(
            "For reference", tableName: "Plan",
            comment: "Section of a chapter with its mind map and summaries, to look back at"))
      }
    }
  }

  private func referenceMark(_ systemImage: String) -> some View {
    Image(systemName: systemImage)
      .resizable()
      .scaledToFit()
      .frame(width: markSize, height: markSize)
      .accessibilityHidden(true)
  }

  /// A few of the unit's words, then how many more it teaches: "hola · gracias · adiós and 12 more".
  private func wordsLine(_ words: LanguageUnit.Words) -> String {
    let sample = words.sample.joined(separator: "\u{00A0}· ")
    let more = words.count - words.sample.count

    guard more > 0 else {
      return sample
    }

    return String(
      localized: "\(sample) and \(more.formatted(.number.locale(.appLanguage))) more",
      table: "Plan",
      comment: "A few of a unit's words, then how many more it teaches")
  }

  private func practiceRow(title: Text, detail: Text, systemImage: String) -> some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        title
          .foregroundStyle(.primary)
        detail
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
          .lineLimit(1)
      }
    } icon: {
      Image(systemName: systemImage)
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

  /// Where the unit sits, then its lessons and their time; the lesson list counts how many are done.
  private var facts: [String] {
    let lessons = unit.lessons
    let minutes = lessons.reduce(0) { $0 + $1.minutes }

    return [
      place,
      lessons.isEmpty
        ? nil
        : String(
          localized: "\(lessons.count) lessons", table: "Plan",
          locale: .appLanguage, comment: "How many lessons a chapter has"),
      minutes > 0 ? planDurationText(minutes: Double(minutes)) : nil,
    ].compactMap { $0 }
  }

  /// A unit outside the learner's plan has no number.
  private var place: String? {
    let range = unit.unit.levelRange.flatMap { $0.isEmpty ? nil : $0 }

    guard let position = unit.unit.position else {
      return range
    }

    if let range {
      return String(
        localized: "Unit \(position)\u{00A0}· \(range)", table: "Plan",
        locale: .appLanguage, comment: "A unit's number and its level range")
    }

    return String(
      localized: "Unit \(position)", table: "Plan", locale: .appLanguage, comment: "A unit's number"
    )
  }
}

/// A unit's practice call: its length, and Start. Shared by the unit page and the buddy's offer.
/// A limit keeps the section's shape: its words take the line under the lengths, and the place
/// Start holds has the way on until the limit's day comes, then Start again.
struct PracticeCallSection: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(VoiceServices.self) private var voice
  /// The line shows a limit on this visit, so its room is kept once the limit lifts.
  @State private var showedLimit = false

  let conversation: LanguageUnit.Conversation
  let chapterId: String
  let goalId: String?
  @Binding var minutes: Int?
  let start: CallStart
  let onStarted: (String) -> Void

  var body: some View {
    let outcome = start.refusal
    let refused: HelpLimit? = if case .limit(let limit) = outcome { limit } else { nil }
    let limit = refused ?? conversation.limit?.helpLimit

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
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
      } else {
        OpeningClock(availableAt: limit?.availableAt) { now in
          setup(limit: limit.flatMap { $0.isOpen(at: now) ? nil : $0 }, refused: refused)
        }

        if outcome == .failed || outcome == .callInProgress
          || outcome == .previousConnectionClosing || outcome == .ended
        {
          FailureLine(
            message: LocalizedStringResource(
              "The call didn't start. Try again in a moment.", table: "Plan",
              comment: "Says the practice call didn't start"))
        }
      }
    } header: {
      SectionTitle(
        Text(
          "Practice a conversation", tableName: "Plan",
          comment: "Section of the unit's practice call"
        ))
    } footer: {
      SectionFooter {
        if let character = conversation.character {
          Text(
            "with \(character.name)\u{00A0}· \(character.role)", tableName: "Plan",
            comment: "Who the practice call is with: the character's name and role")
        }
      }
    }
  }

  @ViewBuilder
  private func setup(limit: HelpLimit?, refused: HelpLimit?) -> some View {
    let isPlus = learner.summary.value?.tier == .plus
    let picked = minutes ?? conversation.defaultMinutes
    let lengths = conversation.minutes + (isPlus ? [] : conversation.plusMinutes)
    let isLocked = !isPlus && conversation.plusMinutes.contains(picked)

    // With no call time left the server sends no lengths, and there's nothing to pick.
    if !lengths.isEmpty {
      Picker(selection: Binding(get: { picked }, set: { minutes = $0 })) {
        ForEach(lengths, id: \.self) { length in
          Text(planDurationText(minutes: Double(length))).tag(length)
        }
      } label: {
        Text("Call length", tableName: "Plan", comment: "Picks the practice call's length")
      }
    }

    if limit != nil || showedLimit {
      HeldSlot(gated: limit != nil) {
        VStack(alignment: .leading) {
          if let limit {
            let words = limit.words(.callTime)
            GateWords(title: words.title.map(Text.init), line: words.line.map(Text.init))
          }
        }
      }
      .announcesAlert(refused?.words(.callTime).said)
      .onChange(of: limit != nil, initial: true) { _, limited in
        if limited {
          showedLimit = true
        }
      }
    }

    switch PracticeCallAction(limit: limit, isLocked: isLocked, isWriting: start.isWriting) {
    case .wayOn(let limit):
      // In Start's row, as Start: the row keeps its height when Start comes back.
      LimitWayOn(limit: limit)
    case .subscribe:
      SubscribeGate(
        title: Text(
          "Longer calls need a subscription", tableName: "Plan",
          comment: "A free learner picked a practice call length their plan doesn't include"))
    case .writing:
      WritingWait(
        title: Text(
          "Writing your call", tableName: "Plan", comment: "A practice call is being written"),
        hint: Text(
          "Your call opens as soon as it's ready.", tableName: "Plan",
          comment: "A practice call opens by itself once it's written"))
    case .start(let isEnabled):
      BusyButton(isBusy: start.isStarting, isRow: true) {
        startCall(minutes: picked)
      } label: {
        Text("Start call", tableName: "Plan", comment: "Starts the practice call")
      }
      .disabled(!isEnabled)
    }
  }

  private func startCall(minutes: Int) {
    guard
      let input: Components.Schemas.LanguageConversationStartInput = try? PracticeJSON.recode(
        PracticeCallRequest(chapterId: chapterId, goalId: goalId, minutes: minutes))
    else {
      return
    }

    start.start(input, voice: voice, onStarted: onStarted)
  }
}

/// The practice call's setup sheet and the start it asks for, presented above the unit's split so a
/// resize keeps both. Closing the sheet ends its start: a call the learner backed out of never
/// opens, and its refusal is gone when the sheet opens again.
@MainActor
@Observable
final class PracticeCallSetup {
  let start = CallStart()
  var isOpen = false {
    didSet {
      if !isOpen {
        start.leave()
      }
    }
  }
}

private struct PracticeCallRequest: Encodable {
  let chapterId: String
  let goalId: String?
  let kind = "practice"
  let minutes: Int
}

/// What the practice call's one action place holds. A limit's way on takes Start's place until its
/// day comes: a guest signs up, a free learner subscribes, a subscriber waits on a disabled Start.
enum PracticeCallAction: Equatable {
  /// The limit's own way on: an account for a guest, a subscription for a free learner.
  case wayOn(HelpLimit)
  /// A free learner picked a length only subscribers get.
  case subscribe
  case writing
  case start(isEnabled: Bool)

  init(limit: HelpLimit?, isLocked: Bool, isWriting: Bool) {
    if let limit, limit.needsAccount || limit.offersSubscription {
      self = .wayOn(limit)
    } else if isLocked {
      self = .subscribe
    } else if isWriting {
      self = .writing
    } else {
      self = .start(isEnabled: limit == nil)
    }
  }
}

/// Main's `CanDoMark`: a ring for what a unit will teach, filled green once it has.
private struct CanDoMark: View {
  let done: Bool

  var body: some View {
    Image(systemName: done ? "circle.fill" : "circle")
      .imageScale(.small)
      .typeStyle(.small)
      .foregroundStyle(done ? Color.success : Color(.foreground).opacity(0.3))
      .markColumn()
      .accessibilityHidden(true)
  }
}
