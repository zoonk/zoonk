import SwiftUI

/// The card being played, kept by the visit so the strip's other view and the bar act on the same one.
struct DealtCard: Equatable {
  let deck: WarmUpDeck
  let position: Int
  let picked: String?

  var card: WarmUpCard { deck.cards[position] }
  var hasNext: Bool { position + 1 < deck.cards.count }
}

extension WaitVisit {
  /// Nil while there's no card: no deck yet, or every card was guessed this app session.
  func dealtCard(deck: WarmUpDeck?, firstUnguessed: Int) -> DealtCard? {
    guard let deck else {
      return nil
    }

    let dealt = dealt?.deckID == deck.id ? dealt : nil
    let position = dealt?.card ?? firstUnguessed

    guard deck.cards.indices.contains(position) else {
      return nil
    }

    return DealtCard(deck: deck, position: position, picked: dealt?.picked)
  }
}

/// Main's `WaitQuizCard`: a guess while the learner waits, a side game apart from their course,
/// built like a lesson's question. Once what they wait for is ready they can still answer this card
/// and read its reveal, but no new card is dealt.
struct WaitQuiz: View {
  static let revealRow = "waitQuizReveal"

  let dealt: DealtCard
  var goalID: String?

  @Environment(WarmUpStore.self) private var warmUps
  @Environment(WaitVisit.self) private var visit
  @AccessibilityFocusState private var focusesQuestion: Bool

  var body: some View {
    let card = dealt.card

    Section {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "Quiz while you wait", tableName: "Onboarding",
          comment:
            "Eyebrow over a question shown while the learner waits for their course. The quiz is a short side game of questions shown while the learner waits for their course. Use the same word for it in every string about it."
        )
        .typeStyle(.eyebrow)
        .foregroundStyle(.faint)

        Text(card.question)
          .typeStyle(.question)
          .accessibilityAddTraits(.isHeader)
          .accessibilityFocused($focusesQuestion)
          .sensoryFeedback(trigger: dealt.picked) { _, picked in picked == nil ? nil : .selection }
      }
      .listRowBackground(Color.clear)

      VStack(spacing: 10) {
        ForEach(Array(card.options.enumerated()), id: \.element.id) { index, option in
          AnswerOption(
            marker: index + 1, isPicked: option.id == dealt.picked, result: result(option),
            isGuessed: true, isLocked: dealt.picked != nil,
            text: RichInline(text: AttributedString(option.text))
          ) {
            guess(option)
          }
        }
      }
      .listRowBackground(Color.clear)

      Group {
        if let picked = dealt.picked {
          let verdict = LessonVerdict.guess(isRight: isRight(picked))

          VStack(alignment: .leading, spacing: 4) {
            FeedbackVerdict(Text(verdict.title), tone: verdict.tone, symbol: verdict.symbol)

            Text(card.reveal)
          }
          .accessibilityElement(children: .combine)
        } else {
          Text(
            "Just for fun. Your answers don't count.", tableName: "Onboarding",
            comment:
              "Under a quiz question shown while the learner waits for their course: a guess never counts. The quiz is a short side game of questions shown while the learner waits for their course. Use the same word for it in every string about it."
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
      }
      .id(Self.revealRow)
      .listRowBackground(Color.clear)
    }
    .listRowSeparator(.hidden)
    .task(id: dealt.deck.id) { visit.show(dealt.deck, card: dealt.position, goalID: goalID) }
    .onChange(of: dealt.position) { focusesQuestion = true }
  }

  private func guess(_ option: WarmUpCard.OptionsPayloadPayload) {
    let card = dealt.card
    let picked = WaitVisit.Dealt(deckID: dealt.deck.id, card: dealt.position, picked: option.id)

    guard visit.guess(picked, cardID: card.id, correct: option.correct) else {
      return
    }

    warmUps.guessed(card: dealt.position, deckID: dealt.deck.id)

    let verdict = LessonVerdict.guess(isRight: option.correct)
    announcePolitely([String(localized: verdict.title), card.reveal].joinedSentences())
  }

  /// Main's `getResult`: the right answer once answered, and a wrong pick as the learner's guess.
  private func result(_ option: WarmUpCard.OptionsPayloadPayload) -> AnswerOptionResult? {
    guard dealt.picked != nil else {
      return nil
    }

    if option.correct {
      return .right
    }

    return option.id == dealt.picked ? .guess : nil
  }

  private func isRight(_ optionID: String) -> Bool {
    dealt.card.options.contains { $0.id == optionID && $0.correct }
  }
}
