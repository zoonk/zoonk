import SwiftUI

extension ActivityRenderer {
  static let dialogueSimulator = ActivityRenderer(
    template: "dialogueSimulator",
    grade: ActivityExpectedAnswer.grader(DialogueFields.self) { $0.expected }
  ) { context, fields in
    DialogueCanvas(fields: fields, context: context)
  }
}

struct DialogueFields: Decodable, Hashable, Sendable {
  struct Line: Decodable, Hashable, Sendable {
    /// "them" or "you".
    let speaker: String
    let text: String
    let translation: String
  }

  struct Reply: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let isBest: Bool
    let text: String
    let translation: String
    let why: String
  }

  let language: String
  let lines: [Line]
  let replies: [Reply]
  let scene: String

  var expected: ActivityExpectedAnswer {
    .selection(replies.filter(\.isBest).map(\.id))
  }
}

private struct DialogueCanvas: View {
  let fields: DialogueFields
  let context: ActivityCanvasContext

  @Environment(\.lessonAudio) private var audio

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  var body: some View {
    let selectedId = context.answer?.ids?.first

    VStack(alignment: .leading, spacing: 16) {
      VStack(alignment: .leading, spacing: 12) {
        Label {
          LessonRichText(fields.scene)
        } icon: {
          Image(systemName: "mappin")
        }
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)

        ForEach(Array(fields.lines.enumerated()), id: \.offset) { _, line in
          bubble(line)
        }
      }

      LessonOptionList(
        options: fields.replies.map { reply in
          LessonOption(
            id: reply.id, text: reply.text, detail: isChecked ? detail(reply) : nil,
            isCorrect: reply.isBest)
        },
        selectedId: selectedId,
        isChecked: isChecked,
        isLocked: isChecked,
        keepsEveryOption: true
      ) { id in
        context.setAnswer(id == selectedId ? nil : .selection([id]))
      }

      if isChecked, let speak = audio.speak, let best = fields.replies.first(where: \.isBest) {
        Button {
          Task { await speak(best.text, fields.language, nil, 1) }
        } label: {
          Label {
            Text(
              "Hear the best reply", tableName: "Activities",
              comment: "Plays the best reply of a conversation aloud")
          } icon: {
            Image(systemName: "speaker.wave.2")
          }
        }
        .buttonStyle(.outline)
      }
    }
  }

  /// Every reply stays to say why, so the best one is named, whichever was picked.
  private func detail(_ reply: DialogueFields.Reply) -> RichInline {
    var why = LessonRichText.typeset(reply.why)
    why.text.foregroundColor = Color(.foreground)

    var best = AttributedString(String(localized: "Best reply:", table: "Activities") + " ")
    best.foregroundColor = .successText

    return RichInline(text: AttributedString(reply.translation + "\n"))
      + (reply.isBest ? RichInline(text: best) : RichInline(text: AttributedString())) + why
  }

  private func bubble(_ line: DialogueFields.Line) -> some View {
    let isThem = line.speaker == "them"
    let words = VStack(alignment: .leading, spacing: 2) {
      Text(line.text)
        .typeWeight(.medium)
      Text(line.translation)
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel(
      isThem
        ? Text(
          "They say: \(line.text), \(line.translation)", tableName: "Activities",
          comment: "VoiceOver: a line the other person says in a conversation, then its meaning")
        : Text(
          "You said: \(line.text), \(line.translation)", tableName: "Activities",
          comment: "VoiceOver: a line the learner said in a conversation, then its meaning"))

    return HStack(alignment: .bottom, spacing: 10) {
      if isThem {
        Image(systemName: "person")
          .typeStyle(.note)
          .foregroundStyle(.vizSecondary)
          .frame(width: 36, height: 36)
          .background(Color.vizSecondary.opacity(0.15), in: .circle)
          .accessibilityHidden(true)

        words
          .padding(.horizontal, 14)
          .padding(.vertical, 10)
          .background(.boxBackground, in: Self.theirBubble)
          .overlay(Self.theirBubble.strokeBorder(.border))

        if let speak = audio.speak {
          Button {
            Task { await speak(line.text, fields.language, nil, 1) }
          } label: {
            Label {
              Text(
                "Hear this line", tableName: "Activities",
                comment: "Plays a line of a conversation aloud")
            } icon: {
              Image(systemName: "speaker.wave.2")
            }
            .labelStyle(.iconOnly)
          }
          .buttonStyle(.borderless)
        }

        Spacer(minLength: 40)
      } else {
        Spacer(minLength: 40)

        words.learnerBubble()
      }
    }
  }

  /// Main's outline bubble, its corner by the speaker tucked in.
  private static let theirBubble = UnevenRoundedRectangle(
    topLeadingRadius: Radius.xxl, bottomLeadingRadius: Radius.sm,
    bottomTrailingRadius: Radius.xxl, topTrailingRadius: Radius.xxl, style: .continuous)
}
