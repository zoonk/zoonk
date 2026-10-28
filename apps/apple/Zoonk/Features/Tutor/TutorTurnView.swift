import SwiftUI

struct TutorTurnView: View {
  let turn: TutorTurn
  let conversation: TutorConversation
  let buddyName: String
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

/// Its links open only once the server checked them, so an answer still streaming reads without
/// links.
struct TutorAnswerText: View {
  @Environment(AppRouter.self) private var router
  @ScaledMetric private var listIndent = 20.0

  let text: String
  let linksEnabled: Bool
  let buddyName: String

  var body: some View {
    let blocks = TutorAnswerBlock.blocks(of: text, linksEnabled: linksEnabled)

    VStack(alignment: .leading, spacing: 0) {
      ForEach(blocks) { block in
        blockView(block)
          .padding(.top, block.id == 0 ? 0 : block.followsListItem ? 6 : 12)
      }
    }
    .textSelection(.enabled)
    .frame(maxWidth: .infinity, alignment: .leading)
    .environment(\.openURL, OpenURLAction(handler: open))
    .accessibilityElement(children: .combine)
    .accessibilityLabel(
      Text(
        verbatim:
          "\(buddyName): \(blocks.map { String($0.text.characters) }.joined(separator: "\n"))"))
  }

  @ViewBuilder
  private func blockView(_ block: TutorAnswerBlock) -> some View {
    switch block.kind {
    case .paragraph:
      Text(block.text)
    case .heading:
      Text(block.text)
        .font(.headline)
        .accessibilityAddTraits(.isHeader)
    case .code:
      Text(block.text)
        .font(.callout.monospaced())
    case .listItem(let marker):
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(verbatim: marker)
          .monospacedDigit()
        Text(block.text)
      }
      .padding(.leading, CGFloat(block.depth) * listIndent)
    }
  }

  /// The buddy links the app's pages by their path on main (`/session?block=…`, `/mistakes`).
  private func open(_ url: URL) -> OpenURLAction.Result {
    guard url.scheme == nil else {
      return .systemAction
    }

    guard let page = URL(string: url.relativeString, relativeTo: Self.mainOrigin)?.absoluteURL
    else {
      return .discarded
    }

    return router.open(url: page) ? .handled : .discarded
  }

  /// Any of main's origins: the app reads only a link's path.
  private static let mainOrigin = URL(string: "https://www.zoonk.com")
}

struct TutorAnswerBlock: Identifiable {
  enum Kind: Equatable {
    case paragraph
    case heading
    case code
    case listItem(marker: String)
  }

  let id: Int
  let kind: Kind
  /// How many lists the block sits inside, beyond the first.
  let depth: Int
  let listID: Int?
  let followsListItem: Bool
  let text: AttributedString

  /// Links are underlined, as main draws them, since the ink tint alone doesn't mark them.
  static func blocks(of markdown: String, linksEnabled: Bool) -> [TutorAnswerBlock] {
    guard
      var parsed = try? AttributedString(
        markdown: markdown,
        options: .init(
          allowsExtendedAttributes: false, interpretedSyntax: .full,
          failurePolicy: .returnPartiallyParsedIfPossible))
    else {
      return [
        TutorAnswerBlock(
          id: 0, kind: .paragraph, depth: 0, listID: nil, followsListItem: false,
          text: AttributedString(markdown))
      ]
    }

    for run in parsed.runs where run.link != nil {
      if linksEnabled {
        parsed[run.range].underlineStyle = .single
      } else {
        parsed[run.range].link = nil
      }
    }

    var blocks: [TutorAnswerBlock] = []

    for (intent, range) in parsed.runs[\.presentationIntent] {
      // Innermost first: a list item's paragraph, the item, its list, and any lists around it.
      let components = intent?.components ?? []
      let lists = components.filter { $0.kind == .orderedList || $0.kind == .unorderedList }
      var text = AttributedString(parsed[range])
      text.presentationIntent = nil

      let kind =
        components.lazy.compactMap { component -> Kind? in
          switch component.kind {
          case .listItem(let ordinal):
            .listItem(marker: lists.first?.kind == .orderedList ? "\(ordinal)." : "•")
          case .header: .heading
          case .codeBlock: .code
          default: nil
          }
        }.first ?? .paragraph

      if kind == .code {
        text.characters.removeLast(text.characters.last == "\n" ? 1 : 0)
      }

      let listID = lists.last?.identity

      blocks.append(
        TutorAnswerBlock(
          id: blocks.count, kind: kind, depth: max(lists.count - 1, 0), listID: listID,
          followsListItem: listID != nil && blocks.last?.listID == listID, text: text))
    }

    return blocks
  }
}
