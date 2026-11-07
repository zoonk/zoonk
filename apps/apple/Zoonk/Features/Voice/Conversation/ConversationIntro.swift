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
        eyebrow
          .typeStyle(.data)
          .foregroundStyle(.faint)

        Text(intro.speakingTask?.task.name ?? intro.title)
          .typeStyle(.section)

        Text(intro.speakingTask?.card.summary ?? intro.situation)
          .foregroundStyle(.mutedForeground)

        if !intro.callsCharacter {
          Text(howTheCallRuns)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      }
      .listRowBackground(Color.clear)
      .listRowSeparator(.hidden)
    }

    if let examTask = intro.speakingTask {
      Section {
        CharacterRow(intro: intro, isTalking: false)
      } footer: {
        SectionFooter {
          StandInNote(name: intro.character.name, role: examTask.task.role)
        }
      }
    } else {
      Section {
        CharacterRow(intro: intro, isTalking: false)
      }
    }

    if let examTask = intro.speakingTask {
      if examTask.task.prepMinutes > 0, let conversationId = intro.conversationId {
        ExamPrepTimer(cardId: conversationId, task: examTask.task)
      }
    } else if intro.callsCharacter {
      HowTheCallWorks(intro: intro)
    }
  }

  private var eyebrow: Text {
    if let examTask = intro.speakingTask {
      Text(speakingTaskMinutes(min: examTask.task.minutes.min, max: examTask.task.minutes.max))
    } else {
      Text(
        "About \(length)\u{00A0}· Level \(intro.level)", tableName: "Voice",
        comment: "A call's length and level, over its title")
    }
  }

  private var howTheCallRuns: String {
    let ends = String(
      localized: "It ends on its own after about \(length).", table: "Voice",
      comment: "An exam task's call stops by itself at about its length")

    guard let examTask = intro.speakingTask else {
      return ends
    }

    return [
      String(
        localized: "\(intro.character.name) opens the call, and your card stays on screen.",
        table: "Voice", comment: "An exam task's call: the AI speaks first, the card stays visible"),
      ends,
      speakingRatedOn(
        examTask.criteria.map { speakingCriterionName($0.key, officialName: $0.name) }),
    ].joinedSentences()
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
        SectionFooter {
          MicNote(
            text: Text(
              "Speak your answers: typed ones aren't rated on how you sound. The microphone is used only during the call.",
              tableName: "Voice",
              comment:
                "Before an exam task's call: why to speak rather than type, and the microphone"
            ))
        }
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
        SectionFooter {
          MicNote(
            text: Text(
              "Turn your sound on. The microphone is on only during the call.", tableName: "Voice",
              comment: "Before a call: what it needs from the learner's device"))
        }
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

/// A call the learner's plan leaves to Plus shows the same intro, locked.
struct CallStartFooter: View {
  let isLocked: Bool
  /// Whom the learner calls; nil for an examiner, whose call just starts.
  let callee: String?
  let onStart: () -> Void

  static var plusRequired: Text {
    Text(
      "Challenge calls come with Plus. Your plan keeps going without them.",
      tableName: "Voice", comment: "A checkpoint call or exam speaking task needs Plus")
  }

  var body: some View {
    if isLocked {
      PlusNotice(description: Self.plusRequired, showsSeePlus: false)

      SeePlusButton()
        .frame(maxWidth: .infinity)
        .buttonStyle(.mainAction)
        .controlSize(.large)
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

/// What happens once the learner calls, so the character speaking first is no surprise.
private struct HowTheCallWorks: View {
  let intro: CallIntro

  var body: some View {
    let name = intro.character.name
    let length = Duration.seconds(intro.minutes * 60).formatted(
      .units(allowed: [.minutes], width: .abbreviated))

    Section {
      step(1) {
        Text(
          "\(name) answers and speaks first.", tableName: "Voice",
          comment: "How a call works: step 1")
      }
      step(2) {
        Text(
          "Then it's your turn: answer out loud, or type if you can't talk.", tableName: "Voice",
          comment: "How a call works: step 2")
      }
      step(3) {
        Text(
          "When you've done everything, or after about \(length), \(name) says goodbye and the call ends.",
          tableName: "Voice", comment: "How a call works: step 3")
      }
    } header: {
      SectionTitle(
        Text("How the call works", tableName: "Voice", comment: "Before a call: what will happen"))
    }
  }

  private func step(_ number: Int, @ViewBuilder _ text: () -> Text) -> some View {
    Label {
      text()
    } icon: {
      Image(systemName: "\(number).circle")
    }
  }
}

private struct StandInNote: View {
  let name: String
  let role: Components.Schemas.SpeakingTask.RolePayload

  var body: some View {
    let standIn =
      switch role {
      case .examiner:
        String(
          localized: "\(name) is an AI standing in for a human examiner.", table: "Voice",
          comment: "Before an exam task: who the AI plays")
      case .partner:
        String(
          localized: "\(name) is an AI playing the other candidate, in place of a real one.",
          table: "Voice", comment: "Before an exam task: who the AI plays")
      }

    Label {
      Text(
        [
          standIn,
          String(
            localized: "It's practice: the estimate after it isn't an official score.",
            table: "Voice", comment: "Before an exam task: its estimate isn't an official score"),
        ].joinedSentences())
    } icon: {
      Image(systemName: "info.circle")
    }
  }
}

private struct MicNote: View {
  let text: Text

  var body: some View {
    Label {
      text
    } icon: {
      Image(systemName: "mic")
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
              Text("Examiner", tableName: "Voice", comment: "Whom the AI plays in an exam task")
            case .partner:
              Text(
                "Other candidate", tableName: "Voice", comment: "Whom the AI plays in an exam task")
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
