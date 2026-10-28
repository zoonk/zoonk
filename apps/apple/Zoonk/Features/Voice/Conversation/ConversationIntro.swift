import SwiftUI

/// Before the call: what it is, who the learner talks to and what to get across, or an exam
/// task's card; then Start. A call the learner's plan leaves to Plus shows the same intro, locked.
struct ConversationIntro: View {
  let conversation: LanguageConversation
  let isLocked: Bool
  let onStart: () -> Void

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 8) {
          Text(
            "\(Duration.seconds(conversation.minutes * 60).formatted(.units(allowed: [.minutes], width: .wide))) · Level \(conversation.level.rawValue)",
            tableName: "Voice", comment: "A call's length and level, over its title"
          )
          .font(.caption.monospaced())
          .foregroundStyle(.tertiary)

          Text(conversation.speakingTask?.task.name ?? conversation.title)
            .font(.title2.weight(.semibold))

          Text(conversation.speakingTask?.card.summary ?? conversation.situation)
            .foregroundStyle(.secondary)
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
      }

      Section {
        CharacterRow(conversation: conversation, isTalking: false)
      }

      if let examTask = conversation.speakingTask {
        ExamTaskCard(task: examTask)
      } else {
        Section {
          ForEach(conversation.objectives, id: \.label) { objective in
            VStack(alignment: .leading, spacing: 2) {
              Text(objective.label)
                .typesettingLanguage(.init(identifier: conversation.targetLanguage))
              Text(objective.description)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
          }
        } header: {
          Text(
            "What to get across", tableName: "Voice", comment: "The call's goals, before it starts")
        } footer: {
          Label {
            Text(
              "Speak or type. The microphone is used only during the call.", tableName: "Voice",
              comment: "How the call hears the learner")
          } icon: {
            Image(systemName: "mic")
          }
        }
      }
    }
    .safeAreaBar(edge: .bottom) {
      VStack(spacing: 12) {
        if isLocked {
          PlusNotice(
            description: Text(
              "Challenge calls come with Plus. Your plan keeps going without them.",
              tableName: "Voice", comment: "A checkpoint call or exam speaking task needs Plus"),
            showsSeePlus: false)

          SeePlusButton()
            .frame(maxWidth: .infinity)
            .buttonStyle(.mainAction)
            .controlSize(.large)
        } else {
          Button(action: onStart) {
            Label {
              Text("Start the call", tableName: "Voice", comment: "Starts a live call")
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
      .scenePadding()
      .keepsOffFold()
    }
  }
}

/// Who the learner talks to: their initial, their name, and who they are ("Landlord · Toronto").
/// While they talk, a ring around the initial shows it.
struct CharacterRow: View {
  let conversation: LanguageConversation
  let isTalking: Bool

  var body: some View {
    let character = conversation.character

    HStack(spacing: 12) {
      Text(character.name.prefix(1).uppercased())
        .font(.subheadline.weight(.medium))
        .frame(minWidth: 32, minHeight: 32)
        .background(Color(.secondarySystemFill), in: .circle)
        .overlay {
          Circle().strokeBorder(isTalking ? Color.secondary : .clear, lineWidth: 1.5)
        }
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 2) {
        Text(character.name)
          .font(.headline)

        Group {
          if let role = conversation.speakingTask?.task.role {
            switch role {
            case .examiner:
              Text("Examiner", tableName: "Voice", comment: "Whom the AI plays in an exam task")
            case .partner:
              Text("Your partner", tableName: "Voice", comment: "Whom the AI plays in an exam task")
            }
          } else {
            Text("\(character.role) · \(character.place)")
          }
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

/// An exam task's card as the candidate gets it: what to do, the points to cover, a text, a table
/// or photos, in the exam's language.
private struct ExamTaskCard: View {
  let task: Components.Schemas.ExamSpeakingTask

  var body: some View {
    let card = task.card

    Section {
      ForEach(card.instructions, id: \.self) { line in
        Text(line)
      }

      if let text = card.text {
        VStack(alignment: .leading, spacing: 4) {
          Text(text.title).font(.headline)
          Text(text.body)
        }
      }

      if let table = card.table {
        VStack(alignment: .leading, spacing: 8) {
          Text(table.title).font(.headline)

          Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 4) {
            GridRow {
              ForEach(table.columns, id: \.self) { column in
                Text(column).font(.subheadline.weight(.semibold))
              }
            }

            ForEach(Array(table.rows.enumerated()), id: \.offset) { _, row in
              GridRow {
                ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                  Text(cell).font(.subheadline)
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
          Color(.secondarySystemFill)
            .aspectRatio(4 / 3, contentMode: .fit)
        }
        .clipShape(.rect(cornerRadius: 8, style: .continuous))
        .accessibilityLabel(photo.alt)
      }
    } header: {
      Text(
        "Task \(task.number) of \(task.taskCount)", tableName: "Voice",
        comment: "Which task of the exam's speaking paper this is")
    } footer: {
      if task.task.prepMinutes > 0 {
        Text(
          "The exam gives \(Duration.seconds(task.task.prepMinutes * 60).formatted(.units(allowed: [.minutes, .seconds], width: .wide))) to prepare.",
          tableName: "Voice", comment: "How long the exam gives to prepare this task")
      }
    }
    .typesettingLanguage(.init(identifier: task.language))
  }
}
