import SwiftUI

/// Everything Zoonk remembers, grouped by category, with where each fact came from. The learner
/// can correct or delete any fact (with undo), turn memory off and download it.
struct MemoryView: View {
  @Environment(SettingsStore.self) private var settings
  @State private var editing: MemoryFact?
  @State private var statement = ""

  var body: some View {
    List {
      Section {
        Text(
          "What Zoonk remembers to give you examples and plans that fit your life.",
          tableName: "Settings", comment: "What the Memory page is for"
        )
        .foregroundStyle(.secondary)
        .listRowBackground(Color.clear)
      }

      if let memory = settings.memory.value {
        Section {
          Toggle(isOn: enabledBinding(memory.enabled)) {
            Text("Use memory", tableName: "Settings", comment: "Switch that turns memory on or off")

            if memory.enabled {
              Text(
                "Personal examples and plans that fit your week", tableName: "Settings",
                comment: "What memory does while it's on")
            } else {
              Text(
                "Memory is off. Nothing new is learned, and these facts aren't used.",
                tableName: "Settings", comment: "What happens while memory is off")
            }
          }
          .tint(.success)
        } footer: {
          if let deleted = settings.deletedFact {
            MemoryUpdatedNotice(fact: deleted, status: settings.undoStatus) {
              Task {
                await settings.undoDeletion()
              }
            }
          }
        }

        if settings.saveFailed {
          SettingsSaveError()
        }

        if memory.facts.isEmpty {
          Section {
            if memory.enabled {
              Text(
                "Nothing yet. As you study and chat, short notes that help Zoonk teach you show up here.",
                tableName: "Settings", comment: "Memory page without facts while memory is on")
            } else {
              Text(
                "Nothing here. Zoonk keeps no notes about you while memory is off.",
                tableName: "Settings", comment: "Memory page without facts while memory is off")
            }
          }
          .foregroundStyle(.secondary)
        }

        ForEach(MemoryFact.Category.allCases, id: \.self) { category in
          let facts = memory.facts.filter { $0.category == category }

          if !facts.isEmpty {
            Section {
              ForEach(facts) { fact in
                MemoryFactRow(fact: fact, edit: { startEditing(fact) }) {
                  Task {
                    await settings.deleteMemoryFact(id: fact.id)
                  }
                }
              }
            } header: {
              category.name
            }
          }
        }

        Section {
          DataExportRow(
            title: Text(
              "Download my memory", tableName: "Settings",
              comment: "Row that downloads everything in the learner's memory"),
            description: Text(
              "Everything in your memory, as one file", tableName: "Settings",
              comment: "What the memory download contains"),
            filename: "zoonk-memory"
          ) {
            await settings.exportMemory()
          }
        } footer: {
          Text(
            "Zoonk doesn't keep health, religion or other sensitive details unless you ask it to.",
            tableName: "Settings", comment: "Note about sensitive details at the Memory page's end")
        }
      }
    }
    .navigationTitle(Text("Memory", tableName: "Settings", comment: "Title of the Memory page"))
    .overlay {
      SettingsLoadingState(state: settings.memory.state) {
        Task {
          await settings.memory.refresh()
        }
      }
    }
    .loads(settings.memory)
    .alert(
      Text("Edit memory", tableName: "Settings", comment: "Title of the dialog correcting a fact"),
      isPresented: isEditingBinding,
      presenting: editing
    ) { fact in
      TextField(text: $statement) {
        Text(
          "What Zoonk remembers", tableName: "Settings",
          comment: "Field holding a fact Zoonk remembers")
      }
      .onChange(of: statement) { _, value in
        statement = String(value.prefix(memoryStatementLimit))
      }

      Button(role: .cancel) {}

      Button(role: .confirm) {
        let trimmed = statement.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmed.isEmpty, trimmed != fact.statement else {
          return
        }

        Task {
          await settings.updateMemoryFact(id: fact.id, statement: trimmed)
        }
      }
    } message: { _ in
      Text(
        "Say it the way it's true for you.", tableName: "Settings",
        comment: "Asks the learner to correct a fact in their own words")
    }
  }

  private var isEditingBinding: Binding<Bool> {
    Binding(
      get: { editing != nil },
      set: { isPresented in
        if !isPresented {
          editing = nil
        }
      })
  }

  private func startEditing(_ fact: MemoryFact) {
    statement = fact.statement
    editing = fact
  }

  private func enabledBinding(_ enabled: Bool) -> Binding<Bool> {
    Binding(
      get: { enabled },
      set: { next in
        Task {
          await settings.setMemoryEnabled(next)
        }
      })
  }
}

/// Core's limit for one fact (`MAX_MEMORY_STATEMENT_LENGTH`); the server checks it too.
private let memoryStatementLimit = 160

/// One fact, where it came from, and a menu to correct or delete it.
private struct MemoryFactRow: View {
  let fact: MemoryFact
  let edit: () -> Void
  let delete: () -> Void

  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      VStack(alignment: .leading, spacing: 2) {
        Text(fact.statement)

        Text(
          "\(fact.source.name) · \(fact.createdAt.formatted(.dateTime.month(.abbreviated).day()))",
          tableName: "Settings",
          comment: "Where a remembered fact came from and its day, as in “From a chat · Oct 11”"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }

      Spacer(minLength: 0)

      Menu {
        Button(action: edit) {
          Label {
            Text("Edit", tableName: "Settings", comment: "Corrects a remembered fact")
          } icon: {
            Image(systemName: "pencil")
          }
        }

        Button(role: .destructive, action: delete) {
          Label {
            Text("Delete", tableName: "Settings", comment: "Deletes a remembered fact")
          } icon: {
            Image(systemName: "trash")
          }
        }
      } label: {
        Image(systemName: "ellipsis")
          .foregroundStyle(.secondary)
          .frame(minWidth: 44, minHeight: 44)
          .contentShape(.rect)
      }
      .accessibilityLabel(
        Text(
          "Options for “\(fact.statement)”", tableName: "Settings",
          comment: "Names the menu that edits or deletes a remembered fact"))
    }
    .swipeActions {
      Button(role: .destructive, action: delete) {
        Label {
          Text("Delete", tableName: "Settings", comment: "Deletes a remembered fact")
        } icon: {
          Image(systemName: "trash")
        }
      }
    }
  }
}

/// "Memory updated", with the deleted fact struck through and an undo, right under the switch.
private struct MemoryUpdatedNotice: View {
  let fact: MemoryFact
  let status: SettingsStore.UndoStatus
  let undo: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(
        "\(Text("Memory updated:", tableName: "Settings", comment: "Starts the line saying a fact was deleted").fontWeight(.medium).foregroundStyle(.primary)) \(Text(fact.statement).strikethrough())",
        tableName: "Settings", comment: "A deleted fact, struck through after “Memory updated:”")

      switch status {
      case .idle:
        Button(action: undo) {
          Text("Undo", tableName: "Settings", comment: "Brings a deleted fact back")
            .underline()
        }
        .buttonStyle(.borderless)
        .foregroundStyle(.primary)
      case .undone:
        Text("Change undone", tableName: "Settings", comment: "Says a deleted fact came back")
      case .failed:
        Text(
          "Couldn't undo. It changed since.", tableName: "Settings",
          comment: "Says a deleted fact couldn't come back"
        )
        .foregroundStyle(.destructive)
      }
    }
    .font(.footnote)
    .padding(.top, 4)
    .accessibilityElement(children: .combine)
  }
}

extension MemoryFact.Category {
  var name: Text {
    switch self {
    case .goals: Text("Goals", tableName: "Settings", comment: "Memory category: goals")
    case .background:
      Text("Background", tableName: "Settings", comment: "Memory category: background")
    case .routine: Text("Routine", tableName: "Settings", comment: "Memory category: routine")
    case .preferences:
      Text("Preferences", tableName: "Settings", comment: "Memory category: preferences")
    case .learning: Text("Learning", tableName: "Settings", comment: "Memory category: learning")
    case .context: Text("Context", tableName: "Settings", comment: "Memory category: context")
    }
  }
}

extension MemoryFact.Source {
  var name: Text {
    switch self {
    case .noticed:
      Text(
        "Noticed from your activity", tableName: "Settings",
        comment: "Source of a fact Zoonk noticed")
    case .told:
      Text("You told us", tableName: "Settings", comment: "Source of a fact the learner said")
    case .chat:
      Text("From a chat", tableName: "Settings", comment: "Source of a fact from a chat")
    case .onboarding:
      Text("From onboarding", tableName: "Settings", comment: "Source of a fact from onboarding")
    case .session:
      Text(
        "From a study session", tableName: "Settings",
        comment: "Source of a fact from a study session")
    }
  }
}
