import SwiftUI

extension ActivityRenderer {
  static let dialogueSimulator = ActivityRenderer(
    template: "dialogueSimulator", badge: .always(.reply),
    grade: ActivityExpectedAnswer.grader(DialogueFields.self) { $0.expected }
  ) { context in
    if let fields = try? context.fields(as: DialogueFields.self) {
      DialogueCanvas(fields: fields, context: context)
    }
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
      Label {
        LessonRichText(fields.scene)
      } icon: {
        Image(systemName: "mappin")
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)

      VStack(spacing: 10) {
        ForEach(Array(fields.lines.enumerated()), id: \.offset) { _, line in
          bubble(line)
        }
      }

      LessonOptionList(
        options: fields.replies.map { reply in
          LessonOption(
            id: reply.id, text: reply.text,
            detail: isChecked ? "\(reply.translation)\n\(LessonRichText.plain(reply.why))" : nil,
            isCorrect: reply.isBest)
        },
        selectedId: selectedId,
        isChecked: isChecked,
        isLocked: isChecked
      ) { id in
        context.setAnswer(id == selectedId ? nil : .selection([id]))
      }

      if isChecked, let speak = audio.speak, let best = fields.replies.first(where: \.isBest) {
        Button {
          Task { await speak(best.text, fields.language) }
        } label: {
          Label {
            Text(
              "Hear the best reply", tableName: "Activities",
              comment: "Plays the best reply of a conversation aloud")
          } icon: {
            Image(systemName: "speaker.wave.2")
          }
        }
        .buttonStyle(.bordered)
      }
    }
  }

  private func bubble(_ line: DialogueFields.Line) -> some View {
    let isThem = line.speaker == "them"

    return HStack(alignment: .bottom, spacing: 8) {
      if isThem {
        Image(systemName: "person.crop.circle.fill")
          .font(.title2)
          .foregroundStyle(.purple)
          .accessibilityHidden(true)
      } else {
        Spacer(minLength: 40)
      }

      VStack(alignment: .leading, spacing: 2) {
        Text(line.text)
          .fontWeight(.medium)
        Text(line.translation)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 10)
      .background(
        isThem ? Color(.secondarySystemBackground) : Color.mint.opacity(0.15),
        in: .rect(cornerRadius: 16)
      )
      .accessibilityElement(children: .combine)
      .accessibilityLabel(
        isThem
          ? Text(
            "They say: \(line.text), \(line.translation)", tableName: "Activities",
            comment: "VoiceOver: a line the other person says in a conversation, then its meaning")
          : Text(
            "You said: \(line.text), \(line.translation)", tableName: "Activities",
            comment: "VoiceOver: a line the learner said in a conversation, then its meaning"))

      if isThem {
        if let speak = audio.speak {
          Button {
            Task { await speak(line.text, fields.language) }
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
      }
    }
  }
}
