import SwiftUI

/// The wait's list loads the deck with `warmUpDeck(_:)`, since this section has no rows until it
/// arrives.
struct WarmUpSection: View {
  fileprivate static let lastRow = "warmUpLastRow"

  let deckID: String

  @Environment(WarmUpStore.self) private var warmUps
  @Environment(WarmUpVisit.self) private var visit
  @AccessibilityFocusState private var focusesQuestion: Bool

  var body: some View {
    let dealt = visit.dealt?.deckID == deckID ? visit.dealt : nil
    let position = dealt?.card ?? warmUps.firstUnguessed(deckID: deckID)
    let picked = dealt?.picked

    if let deck = warmUps.deck(id: deckID).value, deck.cards.indices.contains(position) {
      let card = deck.cards[position]

      Section {
        Text(card.question)
          .font(.headline)
          .accessibilityAddTraits(.isHeader)
          .accessibilityFocused($focusesQuestion)
          .sensoryFeedback(trigger: picked) { _, picked in picked == nil ? nil : .selection }

        ForEach(Array(card.options.enumerated()), id: \.element.id) { index, option in
          self.option(option, index: index, of: card, at: position, picked: picked)
        }

        if let picked {
          let verdict = LessonVerdict.guess(isRight: isRight(picked, in: card))
          let isLastCard = position == deck.cards.count - 1

          VStack(alignment: .leading, spacing: 4) {
            Label {
              Text(verdict.title)
                .font(.headline)
            } icon: {
              Image(systemName: verdict.symbol)
            }
            .foregroundStyle(verdict.tint)

            Text(card.reveal)
          }
          .accessibilityElement(children: .combine)
          .id(visit.isHolding && !isLastCard ? Self.lastRow : nil)

          if isLastCard {
            Text(
              "That's all for now.", tableName: "Onboarding",
              comment: "Under a warm-up's last answer: there are no more guesses"
            )
            .foregroundStyle(.secondary)
            .id(Self.lastRow)
          } else if !visit.isHolding {
            Button {
              visit.deal(warmUps.firstUnguessed(deckID: deckID), deckID: deckID)
              focusesQuestion = true
            } label: {
              Text(
                "Next guess", tableName: "Onboarding",
                comment: "Shows the next warm-up question while the plan or lesson is written")
            }
            .buttonStyle(.bordered)
            .keyboardShortcut(.defaultAction)
            .id(Self.lastRow)
          }
        }
      } header: {
        Label {
          Text(
            "Guess while you wait", tableName: "Onboarding",
            comment: "Above quick questions about the goal's subject while it's being prepared")
        } icon: {
          Image(systemName: "sparkles")
            .accessibilityHidden(true)
        }
      } footer: {
        if picked == nil {
          Text(
            "Getting it wrong now helps you remember later.", tableName: "Onboarding",
            comment: "Under a warm-up question: a guess never counts")
        }
      }
      .task(id: deck.id) { visit.show(deck, card: position) }
    }
  }

  private func option(
    _ option: WarmUpCard.OptionsPayloadPayload, index: Int, of card: WarmUpCard, at position: Int,
    picked: String?
  ) -> some View {
    let isPicked = option.id == picked
    let tag: Text? =
      switch (picked != nil, isPicked, option.correct) {
      case (true, true, _):
        Text(
          "Your guess", tableName: "Onboarding",
          comment: "Beside the answer the learner picked for a warm-up question")
      case (true, false, true):
        Text(
          "Correct", tableName: "Onboarding", comment: "Beside a warm-up question's right answer")
      default:
        nil
      }

    return Button {
      let dealt = WarmUpVisit.Dealt(deckID: deckID, card: position, picked: option.id)

      guard visit.guess(dealt, cardID: card.id, correct: option.correct) else {
        return
      }

      warmUps.guessed(card: position, deckID: deckID)

      let verdict = LessonVerdict.guess(isRight: option.correct)
      AccessibilityNotification.Announcement(
        [String(localized: verdict.title), card.reveal].joinedSentences()
      ).post()
    } label: {
      LabeledContent {
        if let tag {
          HStack(spacing: 6) {
            tag

            if picked != nil, option.correct {
              Image(systemName: "checkmark")
                .fontWeight(.semibold)
                .foregroundStyle(.success)
                .accessibilityHidden(true)
            }
          }
        }
      } label: {
        Text(option.text)
          .foregroundStyle(.primary)
      }
    }
    .disabled(picked != nil)
    .modifier(NumberShortcut(index: index))
    .accessibilityAddTraits(isPicked ? .isSelected : [])
  }

  private func isRight(_ optionID: String, in card: WarmUpCard) -> Bool {
    card.options.contains { $0.id == optionID && $0.correct }
  }
}

extension View {
  /// On a wait's list: loads its deck, and keeps the learner's card in view. A guess scrolls just
  /// enough to show its answer, and holding scrolls back to it, since the shorter screen would
  /// otherwise send the list back to its top.
  func warmUpDeck(_ deckID: String?) -> some View {
    modifier(WarmUpDeckList(deckID: deckID))
  }
}

private struct WarmUpDeckList: ViewModifier {
  let deckID: String?

  @Environment(WarmUpStore.self) private var warmUps
  @Environment(WarmUpVisit.self) private var visit: WarmUpVisit?

  func body(content: Content) -> some View {
    ScrollViewReader { proxy in
      content
        .loads(deckID.map { [warmUps.deck(id: $0)] } ?? [], refreshable: false)
        .onChange(of: visit?.guesses) { proxy.scrollTo(WarmUpSection.lastRow) }
        // The held wait's bar lands a moment after it holds.
        .onScrollGeometryChange(for: CGFloat.self, of: \.contentInsets.bottom) { _, _ in
          if visit?.isHolding == true {
            proxy.scrollTo(WarmUpSection.lastRow)
          }
        }
    }
  }
}
