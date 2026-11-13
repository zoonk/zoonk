import SwiftUI
import UIKit

/// What a call's intro shows: from the call, or from a checkpoint's read before the call is made.
struct CallIntro {
  struct Character {
    let name: String
    let place: String
    let role: String
  }

  struct Objective {
    let description: String
    let label: String
  }

  let character: Character
  /// Nil before a checkpoint's call is made.
  let conversationId: String?
  let level: String
  let minutes: Int
  let objectives: [Objective]
  let situation: String
  let speakingTask: Components.Schemas.ExamSpeakingTask?
  /// A role-play call, not an exam's.
  let callsCharacter: Bool
  let targetLanguage: String
  let title: String

  init(_ conversation: LanguageConversation) {
    let character = conversation.character
    self.character = Character(name: character.name, place: character.place, role: character.role)
    conversationId = conversation.id
    level = conversation.level.rawValue
    minutes = conversation.minutes
    objectives = conversation.objectives.map {
      Objective(description: $0.description, label: $0.label)
    }
    situation = conversation.situation
    speakingTask = conversation.speakingTask
    callsCharacter = conversation.callsCharacter
    targetLanguage = conversation.targetLanguage
    title = conversation.title
  }

  init(_ intro: Components.Schemas.LanguageConversationIntro) {
    let character = intro.character
    self.character = Character(name: character.name, place: character.place, role: character.role)
    conversationId = nil
    level = intro.level.rawValue
    minutes = intro.minutes
    objectives = intro.objectives.map { Objective(description: $0.description, label: $0.label) }
    situation = intro.situation
    speakingTask = intro.examTask?.value1
    callsCharacter = intro.examTask == nil
    targetLanguage = intro.targetLanguage
    title = intro.title
  }
}

struct ConversationIntro<Footer: View>: View {
  let intro: CallIntro
  /// The call needs a subscription: the gate's words take the sound note's place.
  var isLocked = false
  @ViewBuilder let footer: Footer

  var body: some View {
    PaneSplit {
      ZoonkList {
        about
      }
    } secondary: {
      ZoonkList {
        task
      }
      .safeAreaBar(edge: .bottom) { startBar }
    } single: {
      ZoonkList {
        about
        task
      }
      .safeAreaBar(edge: .bottom) { startBar.keepsOffFold() }
    }
  }

  private var length: String {
    Duration.seconds(intro.minutes * 60).formatted(.units(allowed: [.minutes], width: .abbreviated))
  }

  @ViewBuilder
  private var about: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Chip(eyebrow)
          .padding(.bottom, 4)

        Text(intro.speakingTask?.task.name ?? intro.title)
          .typeStyle(.section)

        Text(intro.speakingTask?.card.summary ?? intro.situation)
          .foregroundStyle(.mutedForeground)
      }
      .listRowBackground(Color.clear)
      .listRowSeparator(.hidden)
    }

    Section {
      CharacterRow(intro: intro, isTalking: false)
    }

    if let examTask = intro.speakingTask, examTask.task.prepMinutes > 0,
      let conversationId = intro.conversationId
    {
      ExamPrepTimer(cardId: conversationId, task: examTask.task)
    }
  }

  private var eyebrow: Text {
    if let examTask = intro.speakingTask {
      Text(speakingTaskMinutes(min: examTask.task.minutes.min, max: examTask.task.minutes.max))
    } else {
      Text(
        "\(length)\u{00A0}· Level \(intro.level)", tableName: "Voice",
        comment: "A call's length and level, over its title")
    }
  }

  @ViewBuilder
  private var task: some View {
    if let examTask = intro.speakingTask {
      Section {
        ExamTaskCard(card: examTask.card)
          .typesettingLanguage(.init(identifier: examTask.language))
      } header: {
        SectionTitle(
          Text(
            "Task \(examTask.number) of \(examTask.taskCount)", tableName: "Voice",
            comment: "Which task of the exam's speaking paper this is"))
      } footer: {
        note
      }
    } else {
      Section {
        ForEach(intro.objectives, id: \.label) { objective in
          VStack(alignment: .leading, spacing: 2) {
            Text(objective.label)
              .typesettingLanguage(.init(identifier: intro.targetLanguage))
            Text(objective.description)
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        }
      } header: {
        SectionTitle(
          Text(
            "What to get across", tableName: "Voice", comment: "The call's goals, before it starts")
        )
      } footer: {
        note
      }
    }
  }

  @ViewBuilder
  private var note: some View {
    SectionFooter {
      if isLocked {
        GateWords(title: CallStartFooter.lockedTitle, line: CallStartFooter.lockedLine)
      } else {
        SoundNote()
      }
    }
  }

  private var startBar: some View {
    VStack(spacing: 12) {
      footer
    }
    .scenePadding()
  }
}

/// A call that needs a subscription shows the same intro with the gate in the call button's place.
struct CallStartFooter: View {
  let isLocked: Bool
  /// Whom the learner calls; nil for an examiner, whose call just starts.
  let callee: String?
  let onStart: () -> Void

  static var lockedTitle: Text {
    Text(
      "This call needs a subscription", tableName: "Voice",
      comment: "A free learner tried a language plan's challenge call")
  }

  static var lockedLine: Text {
    Text(
      "Your plan goes on without it.", tableName: "Voice",
      comment: "Under a challenge call that needs a subscription")
  }

  var body: some View {
    if isLocked {
      SubscribeButton()
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .buttonSizing(.flexible)
    } else {
      Button(action: onStart) {
        Label {
          CallButtonTitle(callee: callee)
        } icon: {
          Image(systemName: "phone.fill")
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .keyboardShortcut(.defaultAction)
    }
  }
}

struct CallButtonTitle: View {
  let callee: String?

  var body: some View {
    if let callee {
      Text("Call \(callee)", tableName: "Voice", comment: "Starts a live call with the character")
    } else {
      Text("Start the call", tableName: "Voice", comment: "Starts a live call")
    }
  }
}

/// The learner said no to the microphone: nothing is reserved until they choose to type or allow
/// it in Settings.
struct CallMicrophoneOff: View {
  @Environment(\.openURL) private var openURL
  @AccessibilityFocusState private var isMessageFocused: Bool

  let name: String
  let onType: () -> Void

  static var title: Text {
    Text(
      "Your microphone is off", tableName: "Voice", comment: "The learner blocked the microphone")
  }

  static func text(name: String) -> Text {
    Text(
      "Allow the microphone in Settings to talk with \(name), or do this call by typing.",
      tableName: "Voice", comment: "How to do a call with the microphone blocked")
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Self.title
        .typeStyle(.body.weight(.semibold))

      Self.text(name: name)
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
    // It replaces the Call button VoiceOver was on.
    .accessibilityFocused($isMessageFocused)
    .onAppear {
      isMessageFocused = true
    }

    Button(action: onType) {
      Label {
        Text("Type instead", tableName: "Voice", comment: "Does the call by typing")
      } icon: {
        Image(systemName: "keyboard")
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)

    Button {
      if let url = URL(string: UIApplication.openSettingsURLString) {
        openURL(url)
      }
    } label: {
      Text("Open Settings", tableName: "Voice", comment: "Button that opens the app's settings")
        .frame(maxWidth: .infinity)
    }
    .buttonStyle(.outline)
    .controlSize(.large)
  }
}

/// The system asks for the microphone when the call starts, so the note is only the sound.
private struct SoundNote: View {
  var body: some View {
    Label {
      Text(
        "Turn your sound on.", tableName: "Voice",
        comment: "Before a call: what it needs from the learner's device")
    } icon: {
      Image(systemName: "speaker.wave.2")
    }
  }
}

struct CharacterRow: View {
  let intro: CallIntro
  let isTalking: Bool
  @ScaledMetric(relativeTo: .subheadline) private var markSize = 32.0

  var body: some View {
    let character = intro.character

    HStack(spacing: 12) {
      Text(character.name.prefix(1).uppercased())
        .typeStyle(.note.weight(.medium))
        .frame(width: markSize, height: markSize)
        .background(Color.muted, in: .circle)
        .overlay {
          Circle().strokeBorder(isTalking ? Color.mutedForeground : .clear, lineWidth: 1.5)
        }
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 2) {
        Text(character.name)
          .typeStyle(.body.weight(.semibold))

        Group {
          if let role = intro.speakingTask?.task.role {
            switch role {
            case .examiner:
              Text(
                "Examiner (AI)", tableName: "Voice",
                comment: "Whom the AI plays in an exam task, in place of a human examiner")
            case .partner:
              Text(
                "Other candidate (AI)", tableName: "Voice",
                comment: "Whom the AI plays in an exam task, in place of a real candidate")
            }
          } else {
            Text("\(character.role)\u{00A0}· \(character.place)")
          }
        }
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

private struct ExamTaskCard: View {
  let card: Components.Schemas.SpeakingCard

  var body: some View {
    ForEach(card.instructions, id: \.self) { line in
      Text(line)
    }

    if let text = card.text {
      VStack(alignment: .leading, spacing: 4) {
        Text(text.title).typeStyle(.body.weight(.semibold))
        Text(text.body)
      }
    }

    if let table = card.table {
      VStack(alignment: .leading, spacing: 8) {
        Text(table.title).typeStyle(.body.weight(.semibold))

        Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 4) {
          GridRow {
            ForEach(table.columns, id: \.self) { column in
              Text(column).typeStyle(.body.weight(.semibold))
            }
          }

          ForEach(Array(table.rows.enumerated()), id: \.offset) { _, row in
            GridRow {
              ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                Text(cell).typeStyle(.body)
              }
            }
          }
        }
      }
    }

    ForEach(card.prompts, id: \.self) { prompt in
      Label {
        Text(prompt)
      } icon: {
        Image(systemName: "smallcircle.filled.circle")
          .imageScale(.small)
      }
    }

    ForEach(card.photos, id: \.url) { photo in
      AsyncImage(url: URL(string: photo.url)) { image in
        image.resizable().scaledToFit()
      } placeholder: {
        Color.muted
          .aspectRatio(4 / 3, contentMode: .fit)
      }
      .clipShape(.rect(cornerRadius: Radius.md, style: .continuous))
      .accessibilityLabel(photo.alt)
    }
  }
}
