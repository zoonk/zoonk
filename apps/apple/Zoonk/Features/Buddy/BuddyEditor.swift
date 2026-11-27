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
          ForEach(BuddyGlasses.allCases.filter { $0 != .unrecognized }, id: \.self) { glasses in
            glassesRow(glasses)
          }
        } header: {
          SectionTitle(Text("Glasses", tableName: "Buddy", comment: "Opens the buddy's glasses"))
        }
      }
      .onSubmit(saveChoice)
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
          Button(role: .confirm, action: saveChoice)
            .disabled(choice.input == nil)
        }
      }
    }
  }

  private func saveChoice() {
    guard choice.input != nil else { return }
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    save(
      BuddyChoice(kind: choice.kind, name: trimmed.isEmpty ? nil : trimmed, glasses: choice.glasses)
    )
    dismiss()
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

  @FocusState private var isNameFocused: Bool

  var body: some View {
    Section {
      BuddyCards(kind: $kind, glasses: glasses)
        .listRowSeparator(.hidden)
    }

    Section {
      FormField(
        title: Text("Name", tableName: "Buddy", comment: "The buddy's custom name"),
        isFocused: isNameFocused
      ) {
        FittedTextInput(text: $name, limit: buddyNameMaxLength) { text, selection in
          TextField(
            text: text, selection: selection,
            prompt: Text(buddyName(kind: kind, name: nil)).fieldPrompt()
          ) {
            Text("Name", tableName: "Buddy", comment: "The buddy's custom name")
          }
          .textInputAutocapitalization(.sentences)
          .submitLabel(.done)
          .focused($isNameFocused)
        }
      }
    }
  }
}

/// Main's `BuddyPicker` options: a card per buddy, two to a row and four once the row is 32rem wide,
/// each the buddy drawn whole over its name and what it is, the pick on the pick's fill.
private struct BuddyCards: View {
  @Binding var kind: BuddyKind
  let glasses: BuddyGlasses

  @State private var columns = 2

  var body: some View {
    LazyVGrid(
      columns: Array(
        repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: columns),
      spacing: 12
    ) {
      ForEach(buddyKinds, id: \.self) { option in
        BuddyCard(
          kind: option, glasses: kind == option ? glasses : .round, isPicked: kind == option
        ) {
          kind = option
        }
      }
    }
    .onGeometryChange(for: Int.self) {
      $0.size.width >= 512 ? 4 : 2
    } action: {
      columns = $0
    }
  }
}

private struct BuddyCard: View {
  @Environment(LearnerSummaryStore.self) private var learner

  let kind: BuddyKind
  let glasses: BuddyGlasses
  let isPicked: Bool
  let action: () -> Void

  private var look: BuddyLook {
    var look = learner.summary.value?.buddy ?? BuddyLook()
    look.kind = kind
    look.glasses = glasses
    return look
  }

  var body: some View {
    Button(action: action) {
      VStack(spacing: 4) {
        BuddyCharacter(look: look, expression: .happy)
          .frame(height: 92)
          .accessibilityHidden(true)

        Text(buddyName(kind: kind, name: nil))
          .typeStyle(.rowTitle.weight(.semibold))
          .foregroundStyle(Color(.foreground))

        kind.tagline
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity)
      .padding(12)
      .padding(.top, 4)
      .overlay(alignment: .topTrailing) {
        Image(systemName: isPicked ? "checkmark.circle.fill" : "circle")
          .foregroundStyle(Color(.foreground).opacity(isPicked ? 1 : 0.5))
          .padding(12)
          .accessibilityHidden(true)
      }
      .answerSurface(isPicked ? .picked : .idle, cornerRadius: Radius.xl)
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(isPicked ? .isSelected : [])
  }
}

/// Nothing is random and nothing is sold: the earned pairs go on with one tap, the rest say how
/// they're earned.
struct BuddyGlassesPicker: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(BuddyStore.self) private var store
  /// Says a pair didn't go on, while the sheet is open.
  @State private var saving = VisitRequest<Bool>()

  let status: BuddyStatus

  var body: some View {
    NavigationStack {
      ZoonkList {
        if saving.outcome == false {
          FailureLine(
            message: LocalizedStringResource(
              "We couldn't save your buddy. Try again.", table: "Buddy",
              comment: "Saving the buddy failed"))
        }

        ForEach(status.glasses.filter { $0.glasses != .unrecognized }, id: \.glasses) { option in
          let isWorn = store.status.value?.buddy.glasses == option.glasses.worn

          ChoiceRow(
            isPicked: isWorn, isLocked: !option.earned || status.buddy.kind == .unrecognized
          ) {
            let choice = BuddyChoice(
              kind: status.buddy.kind, name: status.buddy.name, glasses: option.glasses.worn)
            saving.run { [store] in await store.save(choice) }
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
    .onDisappear { saving.leave() }
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
