import SwiftUI

/// The profile's name, edited where a certificate shows it: every certificate and the buddy use
/// it.
struct CertificateNameEditor: View {
  @Environment(SessionStore.self) private var session
  @FocusState private var isFocused: Bool

  /// Kept by the screen, so folding or unfolding keeps what the learner typed.
  @Binding var name: String
  /// Empty when the learner hasn't given a name yet.
  let current: String
  /// After a save, or Esc while changing it.
  let onDone: () -> Void

  private var isFirst: Bool { current.isEmpty }

  private var trimmed: String {
    name.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var isTooLong: Bool {
    ProfileName.isChangeTooLong(name, saved: current)
  }

  private var canSave: Bool {
    !trimmed.isEmpty && trimmed != current && !isTooLong && !session.isWorking
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      label
        .typeStyle(.rowTitle)
        .foregroundStyle(Color(.foreground))

      HStack(spacing: 8) {
        TextField(
          text: $name,
          prompt: Text(
            "Your full name", tableName: "Certificates",
            comment: "Placeholder of the field for the name on the learner's certificates")
        ) {
          label
        }
        .textContentType(.name)
        .fieldBorder(isFocused: isFocused, isInvalid: isTooLong)
        .submitLabel(.done)
        .focused($isFocused)
        .onSubmit(save)

        BusyButton(isBusy: session.isWorking, action: save) {
          Text("Save", tableName: "Certificates", comment: "Saves the name on the certificates")
        }
        .buttonStyle(.mainAction)
        .disabled(!canSave)
      }

      Group {
        if isTooLong {
          Text(
            "Use 150 characters or fewer.", tableName: "Account",
            comment: "Shown under the profile name field when the typed name is too long"
          )
          .foregroundStyle(.destructiveText)
        } else {
          hint
            .foregroundStyle(.mutedForeground)
        }
      }
      .typeStyle(.note)

      AccountFailureMessage(failure: session.failure)
    }
    .onKeyPress(.escape) {
      guard !isFirst else {
        return .ignored
      }

      onDone()
      return .handled
    }
    .onAppear {
      isFocused = !isFirst
    }
  }

  private var label: Text {
    isFirst
      ? Text(
        "Your name, as it should appear", tableName: "Certificates",
        comment: "Label of the field asking for the name to print on a certificate")
      : Text(
        "Name on your certificates", tableName: "Certificates",
        comment: "Label of the field that changes the name on the learner's certificates")
  }

  private var hint: Text {
    isFirst
      ? Text(
        "Your certificates and your buddy use this name. You can change it anytime.",
        tableName: "Certificates", comment: "Under the field asking for the learner's name")
      : Text(
        "Your certificates and your buddy use this name.", tableName: "Certificates",
        comment: "Under the field that changes the learner's name")
  }

  private func save() {
    guard canSave else {
      return
    }

    Task {
      if await session.updateProfile(name: trimmed) {
        onDone()
      }
    }
  }
}
