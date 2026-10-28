import SwiftUI

/// One question and the buddy's answer: the learner's words in a bubble on the trailing side, the
/// buddy's as plain text, then the plan change, app tool or memory update the answer brought.
struct TutorTurnView: View {
  let turn: TutorTurn
  let conversation: TutorConversation
  let buddyName: String
  /// In a panel, what each question was about ("About your answer").
  let showsAbout: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      question
      answer

      // A card comes with the words that say it, never alone under "Thinking…".
      if turn.answer != nil || turn.status != .running {
        if let change = turn.planChange {
          TutorPlanChangeCard(change: change, turnID: turn.id, conversation: conversation)
        }

        if let offer = turn.toolOffer {
          TutorToolOfferCard(offer: offer)
        }
      }

      if let changes = conversation.memoryChanges[turn.id], !changes.isEmpty {
        TutorMemoryUpdate(changes: changes, turnID: turn.id, conversation: conversation)
      }
    }
  }

  private var question: some View {
    VStack(alignment: .trailing, spacing: 4) {
      if showsAbout {
        turn.about.label
          .font(.caption)
          .foregroundStyle(.secondary)
      }

      Text(turn.question)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
          Color(.secondarySystemBackground), in: .rect(cornerRadius: 18, style: .continuous)
        )
        .textSelection(.enabled)
    }
    .frame(maxWidth: .infinity, alignment: .trailing)
    .padding(.leading, 40)
    .accessibilityElement(children: .combine)
    .accessibilityLabel(
      Text(
        "You: \(turn.question)", tableName: "Tutor",
        comment: "VoiceOver: the learner's question to the buddy"))
  }

  @ViewBuilder
  private var answer: some View {
    let isStreamingHere = conversation.answeringID == turn.id
    let failure = conversation.answerFailures[turn.id]

    switch turn.status {
    case .pending where !isStreamingHere:
      Button {
        Task { await conversation.retryAnswer(turn.id) }
      } label: {
        Text(
          "Get answer", tableName: "Tutor",
          comment: "Asks the buddy for an answer that wasn't written yet")
      }
      .buttonStyle(.bordered)
      .disabled(conversation.answeringID != nil)
    case .failed:
      VStack(alignment: .leading, spacing: 12) {
        if let text = turn.answer {
          TutorAnswerText(text: text, linksEnabled: false, buddyName: buddyName)
        }

        if let failure, failure.isLimit {
          // Why, and the one thing to do about it, take the composer's place.
          Text(
            "This one wasn't answered.", tableName: "Tutor",
            comment: "A question the learner's limit stopped"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        } else {
          (failure.map(answerFailureMessage)
            ?? Text(
              "We couldn't finish this answer.", tableName: "Tutor",
              comment: "A buddy answer failed"))
            .font(.subheadline)
            .foregroundStyle(.destructive)

          TutorRemedyButton(failure: failure ?? .failed) {
            Task { await conversation.retryAnswer(turn.id) }
          }
          .disabled(conversation.answeringID != nil)
        }
      }
    default:
      if let text = turn.answer {
        VStack(alignment: .leading, spacing: 12) {
          TutorAnswerText(
            text: text, linksEnabled: turn.linksVerified && turn.status == .completed,
            buddyName: buddyName)

          if turn.status == .running && !isStreamingHere {
            checkAgain
          }
        }
      } else if turn.status == .completed {
        Text("No answer available.", tableName: "Tutor", comment: "A buddy answer that has no text")
          .foregroundStyle(.secondary)
      } else {
        VStack(alignment: .leading, spacing: 12) {
          Text("Thinking…", tableName: "Tutor", comment: "The buddy is writing its answer")
            .foregroundStyle(.secondary)
            .accessibilityAddTraits(.updatesFrequently)

          if turn.status == .running && !isStreamingHere {
            checkAgain
          }
        }
      }
    }
  }

  private var checkAgain: some View {
    Button {
      Task { await conversation.checkAgain(turn.id) }
    } label: {
      Label {
        Text(
          "Check again", tableName: "Tutor",
          comment: "Reads an answer being written elsewhere again")
      } icon: {
        Image(systemName: "arrow.clockwise")
      }
    }
    .buttonStyle(.bordered)
    .disabled(conversation.answeringID != nil)
  }

  private func answerFailureMessage(_ failure: TutorFailure) -> Text {
    switch failure {
    case .signedOut, .plusRequired, .gone, .slowDown:
      failure.message
    case .signUpRequired, .limitReached, .invalid, .conflict, .failed:
      Text("We couldn't finish this answer.", tableName: "Tutor", comment: "A buddy answer failed")
    }
  }
}

/// The buddy's answer as Markdown text. Its links open only once the server checked them: an
/// answer still streaming reads without links.
struct TutorAnswerText: View {
  let text: String
  let linksEnabled: Bool
  let buddyName: String

  var body: some View {
    Text(attributed)
      .textSelection(.enabled)
      .frame(maxWidth: .infinity, alignment: .leading)
      .accessibilityElement(children: .combine)
      .accessibilityLabel(Text(verbatim: "\(buddyName): \(String(attributed.characters))"))
  }

  private var attributed: AttributedString {
    var answer =
      (try? AttributedString(
        markdown: text,
        options: .init(
          allowsExtendedAttributes: false,
          interpretedSyntax: .inlineOnlyPreservingWhitespace,
          failurePolicy: .returnPartiallyParsedIfPossible)))
      ?? AttributedString(text)

    if !linksEnabled {
      for run in answer.runs where run.link != nil {
        answer[run.range].link = nil
      }
    }

    return answer
  }
}
