import SwiftUI

/// Choosing a buddy (Zu, Noodle, Beep or Otto) and a name. An empty name keeps the buddy's own
/// name in each language. It saves on Done; the buddy changes at once.
struct BuddyEditor: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(BuddyStore.self) private var store

  let status: BuddyStatus

  @State private var kind: BuddyKind
  @State private var name: String

  init(status: BuddyStatus) {
    self.status = status
    _kind = State(initialValue: status.buddy.kind)
    _name = State(initialValue: status.buddy.name ?? "")
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Picker(selection: $kind) {
            ForEach(buddyKinds, id: \.self) { kind in
              Label {
                VStack(alignment: .leading) {
                  Text(buddyName(kind: kind, name: nil))
                  kind.tagline
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
              } icon: {
                BuddyFace(kind: kind)
              }
              .tag(kind)
            }
          } label: {
            Text("Buddy", tableName: "Buddy", comment: "Choosing which buddy")
          }
          .pickerStyle(.inline)
          .labelsHidden()
        }

        Section {
          TextField(text: $name, prompt: Text(buddyName(kind: kind, name: nil))) {
            Text("Name", tableName: "Buddy", comment: "The buddy's custom name")
          }
          .textInputAutocapitalization(.words)
          .autocorrectionDisabled()
          .onChange(of: name) { _, newName in
            // Custom names stay short so they fit wherever the buddy is named.
            if newName.count > 24 {
              name = String(newName.prefix(24))
            }
          }
        } header: {
          Text("Name", tableName: "Buddy", comment: "The buddy's custom name")
        }

        if store.saveFailed {
          Text(
            "We couldn't save your buddy. Try again.", tableName: "Buddy",
            comment: "Saving the buddy failed"
          )
          .foregroundStyle(.destructive)
        }
      }
      .navigationTitle(
        Text("Choose your buddy", tableName: "Buddy", comment: "Title of choosing a buddy")
      )
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .cancel) {
            dismiss()
          }
        }

        ToolbarItem(placement: .confirmationAction) {
          Button(role: .confirm) {
            let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
            let choice = BuddyChoice(
              kind: kind, name: trimmed.isEmpty ? nil : trimmed, glasses: status.buddy.glasses)
            dismiss()
            Task { await store.save(choice) }
          }
        }
      }
    }
  }
}

/// Every pair of glasses: the earned ones go on with one tap, the rest say how they're earned and
/// how far along the learner is. Nothing is random and nothing is sold.
struct BuddyGlassesPicker: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(BuddyStore.self) private var store

  let status: BuddyStatus

  var body: some View {
    NavigationStack {
      List {
        if store.saveFailed {
          Text(
            "We couldn't save your buddy. Try again.", tableName: "Buddy",
            comment: "Saving the buddy failed"
          )
          .foregroundStyle(.destructive)
        }

        ForEach(status.glasses, id: \.glasses) { option in
          let isWorn = store.status.value?.buddy.glasses == option.glasses.worn

          Button {
            Task {
              await store.save(
                BuddyChoice(
                  kind: status.buddy.kind, name: status.buddy.name, glasses: option.glasses.worn))
            }
          } label: {
            HStack(spacing: 12) {
              BuddyFace(kind: status.buddy.kind, glasses: option.glasses.worn)
                .font(.title)
                .opacity(option.earned ? 1 : 0.4)

              VStack(alignment: .leading, spacing: 4) {
                option.glasses.name
                  .font(.headline)

                if !option.earned {
                  lockedDetail(option)
                }
              }

              Spacer()

              if isWorn {
                Image(systemName: "checkmark")
                  .fontWeight(.semibold)
                  .accessibilityHidden(true)
              }
            }
            .contentShape(.rect)
          }
          .foregroundStyle(.primary)
          .disabled(!option.earned)
          .accessibilityAddTraits(isWorn ? .isSelected : [])
        }
      }
      .navigationTitle(Text("Glasses", tableName: "Buddy", comment: "Title of the buddy's glasses"))
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .principal) {
          VStack {
            Text("Glasses", tableName: "Buddy", comment: "Title of the buddy's glasses")
              .font(.headline)
            Text(
              "Pick a pair you've earned to wear it.", tableName: "Buddy",
              comment: "What the glasses list does"
            )
            .font(.caption)
            .foregroundStyle(.secondary)
          }
        }

        ToolbarItem(placement: .confirmationAction) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
    .presentationDetents([.medium, .large])
  }

  /// A locked pair says how it's earned, and a counted one how far along the learner is.
  @ViewBuilder
  private func lockedDetail(_ option: Components.Schemas.GlassesProgress) -> some View {
    let counted = option.glasses == .catEye || option.glasses == .retro

    VStack(alignment: .leading, spacing: 6) {
      Label {
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
      } icon: {
        Image(systemName: "lock.fill")
          .imageScale(.small)
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)

      if counted, option.target > 0 {
        ProgressView(value: Double(option.current), total: Double(option.target))
          .tint(.secondary)
          .accessibilityHidden(true)
      }
    }
  }
}
