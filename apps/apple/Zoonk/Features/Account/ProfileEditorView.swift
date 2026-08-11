import SwiftUI

struct ProfileEditorView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(SessionStore.self) private var session
  @State private var name: String
  @State private var username: String

  let account: CurrentAccount
  let isRequiredSetup: Bool

  init(account: CurrentAccount, isRequiredSetup: Bool) {
    self.account = account
    self.isRequiredSetup = isRequiredSetup
    _name = State(initialValue: account.user.name)
    _username = State(initialValue: account.user.displayUsername ?? account.user.username ?? "")
  }

  var body: some View {
    Form {
      if isRequiredSetup {
        Section {
          Text(
            "Choose how your name appears before you continue.",
            tableName: "Account",
            comment: "Explains why first-time profile setup is required"
          )
          .foregroundStyle(.secondary)
        }
      }

      Section {
        TextField(
          text: $name,
          prompt: Text(
            "Your name",
            tableName: "Account",
            comment: "Placeholder for the profile name field")
        ) {
          Text("Name", tableName: "Account", comment: "Profile name field label")
        }
        .textContentType(.name)
        .accessibilityLabel(
          Text("Name", tableName: "Account", comment: "Profile name field label"))

        TextField(
          text: normalizedUsernameBinding,
          prompt: Text(
            "username",
            tableName: "Account",
            comment: "Placeholder for the username field")
        ) {
          Text("Username", tableName: "Account", comment: "Profile username field label")
        }
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .textContentType(.username)
        .accessibilityLabel(
          Text("Username", tableName: "Account", comment: "Profile username field label"))
      } footer: {
        Text(
          "Use 3–30 letters, numbers, or underscores.",
          tableName: "Account",
          comment: "Username requirements below the profile field")
      }

      Section(
        String(
          localized: "Account email",
          table: "Account",
          comment: "Section title above the read-only account email")
      ) {
        LabeledContent {
          Text(account.user.email)
            .foregroundStyle(.secondary)
        } label: {
          Text("Email", tableName: "Account", comment: "Read-only profile email label")
        }
      }

      if session.failure != nil {
        Section {
          AccountFailureMessage(failure: session.failure)
        }
      }
    }
    .disabled(session.isWorking)
    .navigationTitle(profileNavigationTitle)
    .toolbarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .confirmationAction) {
        Button {
          Task {
            let didUpdate = await session.updateProfile(
              name: normalizedName,
              username: normalizedUsername)

            if didUpdate && !isRequiredSetup {
              dismiss()
            }
          }
        } label: {
          if session.isWorking {
            ProgressView()
              .controlSize(.small)
          } else {
            Text("Save", tableName: "Account", comment: "Button that saves profile changes")
          }
        }
        .disabled(!isValid || session.isWorking)
      }
    }
  }

  private var normalizedName: String {
    name.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var normalizedUsername: String {
    username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  private var normalizedUsernameBinding: Binding<String> {
    Binding(
      get: { username },
      set: { username = $0.lowercased() })
  }

  private var isValid: Bool {
    let allowedCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789_")
    let hasSupportedCharacters = normalizedUsername.unicodeScalars.allSatisfy {
      allowedCharacters.contains($0)
    }

    return !normalizedName.isEmpty
      && 3...30 ~= normalizedUsername.count
      && hasSupportedCharacters
  }

  private var profileNavigationTitle: Text {
    if isRequiredSetup {
      return Text(
        "Finish setup",
        tableName: "Account",
        comment: "Navigation title for required first-time profile setup")
    }

    return Text("Profile", tableName: "Account", comment: "Profile editor navigation title")
  }
}

#Preview {
  NavigationStack {
    ProfileEditorView(
      account: CurrentAccount(
        account: AccountAccess(
          deletion: AccountDeletionRequirements(hasAppleAccount: false),
          subscription: nil),
        user: AccountUser(
          displayUsername: "zoonk_user",
          email: "hello@zoonk.com",
          id: UUID().uuidString,
          image: nil,
          name: "Zoonk User",
          username: "zoonk_user")),
      isRequiredSetup: false)
  }
  .environment(SessionStore.preview())
}
