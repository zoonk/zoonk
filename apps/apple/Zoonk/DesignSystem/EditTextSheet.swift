import SwiftUI

struct EditTextSheet: View {
  @Environment(\.dismiss) private var dismiss
  @FocusState private var isFocused: Bool

  let title: Text
  let label: Text
  let description: Text
  @Binding var text: String
  let limit: Int
  let original: String
  var multiline = false
  var isSaving = false
  var failure: Text?
  let onSave: (String) -> Void

  var body: some View {
    NavigationStack {
      ZoonkList {
        Section {
          FormField(title: label, isFocused: isFocused) {
            if multiline {
              MultilineTextField(text: $text, limit: limit, label: label)
                .lineLimit(2...6)
            } else {
              FittedTextInput(text: $text, limit: limit) { text, selection in
                TextField(text: text, selection: selection) { label }
                  .submitLabel(.done)
                  .onSubmit(save)
              }
            }
          } hint: {
            description
          }
          .focused($isFocused)
          .disabled(isSaving)

          if let failure {
            failure.foregroundStyle(.destructiveText)
          }
        }
      }
      .navigationTitle(title)
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .cancel) { dismiss() }
            .disabled(isSaving)
        }

        ToolbarItem(placement: .confirmationAction) {
          BusyButton(isBusy: isSaving, role: .confirm, icon: .check, action: save) {
            Text("Save", tableName: "Plan", comment: "Saves the goal's new name")
          }
          .disabled(!canSave && !isSaving)
        }
      }
      .onAppear { isFocused = true }
    }
    .interactiveDismissDisabled(isSaving)
    .zoonkSheet()
  }

  private var trimmed: String {
    text.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var canSave: Bool { !trimmed.isEmpty && trimmed != original }

  private func save() {
    guard !isSaving, canSave else { return }
    onSave(trimmed)
  }
}
