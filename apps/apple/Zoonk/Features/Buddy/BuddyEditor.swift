import SwiftUI

struct BuddyEditor: View {
  @Environment(\.dismiss) private var dismiss

  let availableGlasses: [BuddyGlasses]
  let save: (BuddyChoice) -> Void

  @State private var choice: BuddyChoice
  @State private var name: String

  init(
    choice: BuddyChoice, availableGlasses: [BuddyGlasses], save: @escaping (BuddyChoice) -> Void
  ) {
    self.availableGlasses = availableGlasses
    self.save = save
    _choice = State(initialValue: choice)
    _name = State(initialValue: choice.name ?? "")
  }

  var body: some View {
    NavigationStack {
      ZoonkList {
        BuddyPickerSections(kind: $choice.kind, name: $name, glasses: choice.glasses)

        Section {
          ForEach(BuddyGlasses.allCases, id: \.self) { glasses in
            glassesRow(glasses)
          }
        } header: {
          SectionTitle(Text("Glasses", tableName: "Buddy", comment: "Opens the buddy's glasses"))
        }
      }
      .navigationTitle(
        Text("Your buddy", tableName: "Buddy", comment: "Title of the buddy editor")
      )
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .cancel) {
            dismiss()
          } label: {
            Text("Cancel", tableName: "Buddy", comment: "Closes the buddy editor without saving")
          }
        }

        ToolbarItem(placement: .confirmationAction) {
          Button(role: .confirm) {
            let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
            save(
              BuddyChoice(
                kind: choice.kind, name: trimmed.isEmpty ? nil : trimmed, glasses: choice.glasses))
            dismiss()
          }
        }
      }
    }
  }

  private func glassesRow(_ glasses: BuddyGlasses) -> some View {
    let isEarned = availableGlasses.contains(glasses)
    let isWorn = choice.glasses == glasses

    return ChoiceRow(isPicked: isWorn, isLocked: !isEarned) {
      choice.glasses = glasses
    } words: {
      ChoiceWords(title: glasses.name, detail: isEarned ? nil : glasses.howToEarn)
    }
  }
}

private let buddyNameMaxLength = 24

/// An empty name keeps the buddy's own name in each language.
struct BuddyPickerSections: View {
  @Binding var kind: BuddyKind
  @Binding var name: String
  var glasses: BuddyGlasses = .round

  var body: some View {
    Section {
      ForEach(buddyKinds, id: \.self) { option in
        ChoiceRow(isPicked: kind == option) {
          kind = option
        } words: {
          Label {
            ChoiceWords(title: Text(buddyName(kind: option, name: nil)), detail: option.tagline)
          } icon: {
            BuddyFace(kind: option, glasses: glasses)
          }
        }
      }
    }

    Section {
      TextField(text: $name, prompt: Text(buddyName(kind: kind, name: nil))) {
        Text("Name", tableName: "Buddy", comment: "The buddy's custom name")
      }
      .textInputAutocapitalization(.words)
      .autocorrectionDisabled()
      .onChange(of: name) { _, newName in
        if newName.count > buddyNameMaxLength {
          name = String(newName.prefix(buddyNameMaxLength))
        }
      }
    } header: {
      SectionTitle(Text("Name", tableName: "Buddy", comment: "The buddy's custom name"))
    }
  }
}

/// Nothing is random and nothing is sold: the earned pairs go on with one tap, the rest say how
/// they're earned.
struct BuddyGlassesPicker: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(BuddyStore.self) private var store

  let status: BuddyStatus

  var body: some View {
    NavigationStack {
      ZoonkList {
        if store.saveFailed {
          FailureLine(
            message: LocalizedStringResource(
              "We couldn't save your buddy. Try again.", table: "Buddy",
              comment: "Saving the buddy failed"))
        }

        ForEach(status.glasses, id: \.glasses) { option in
          let isWorn = store.status.value?.buddy.glasses == option.glasses.worn

          ChoiceRow(isPicked: isWorn, isLocked: !option.earned) {
            Task {
              await store.save(
                BuddyChoice(
                  kind: status.buddy.kind, name: status.buddy.name, glasses: option.glasses.worn))
            }
          } words: {
            HStack(spacing: 12) {
              BuddyFace(kind: status.buddy.kind, glasses: option.glasses.worn)
                .typeStyle(.pageTitle.weight(.regular))
                .opacity(option.earned ? 1 : 0.4)

              VStack(alignment: .leading, spacing: 4) {
                option.glasses.name
                  .typeStyle(.rowTitle)
                  .foregroundStyle(Color(.foreground))

                if !option.earned {
                  lockedDetail(option)
                }
              }
            }
          }
        }
      }
      .navigationTitle(Text("Glasses", tableName: "Buddy", comment: "Title of the buddy's glasses"))
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .principal) {
          VStack {
            Text("Glasses", tableName: "Buddy", comment: "Title of the buddy's glasses")
              .typeStyle(.body.weight(.semibold))
            Text(
              "Pick a pair you've earned.", tableName: "Buddy",
              comment: "What the glasses list does"
            )
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
          }
        }
      }
      .sheetClose { dismiss() }
    }
    .presentationDetents([.medium, .large])
  }

  @ViewBuilder
  private func lockedDetail(_ option: Components.Schemas.GlassesProgress) -> some View {
    let counted = option.glasses == .catEye || option.glasses == .retro

    VStack(alignment: .leading, spacing: 6) {
      // The lock sits right by its words, as main's does, not in a list row's icon column.
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        Image(systemName: "lock.fill")
          .imageScale(.small)
          .accessibilityHidden(true)

        if counted, option.glasses == .catEye {
          Text(
            "\(option.current) of \(option.target) days with every mission done",
            tableName: "Buddy", comment: "Progress toward the cat-eye glasses")
        } else if counted {
          Text(
            "\(option.current) of \(option.target) reviews", tableName: "Buddy",
            comment: "Progress toward the retro glasses")
        } else {
          option.glasses.howToEarn
        }
      }
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)

      if counted, option.target > 0 {
        Meter(value: Double(option.current), total: Double(option.target), fill: .mutedForeground)
          .accessibilityHidden(true)
      }
    }
  }
}
