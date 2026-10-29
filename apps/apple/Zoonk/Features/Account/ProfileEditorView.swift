import SwiftUI

struct ProfileEditorView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(SessionStore.self) private var session
  @Environment(SettingsStore.self) private var settings
  @State private var name: String
  @State private var username: String
  @State private var isChangingUsername = false

  let account: CurrentAccount
  let isRequiredSetup: Bool
  /// Nil in the required setup, which has no way out but finishing it.
  let deleteAccount: (() -> Void)?

  init(account: CurrentAccount, isRequiredSetup: Bool, deleteAccount: (() -> Void)? = nil) {
    self.account = account
    self.isRequiredSetup = isRequiredSetup
    self.deleteAccount = deleteAccount
    _name = State(initialValue: account.user.name)
    _username = State(initialValue: account.user.displayUsername ?? account.user.username ?? "")
  }

  var body: some View {
    Form {
      if isRequiredSetup {
        StepHeader(
          title: Text(
            "What should we call you?", tableName: "Account",
            comment: "Title of the profile setup after signing up"),
          description: Text(
            "You can change it later in your profile.", tableName: "Account",
            comment: "Explains that the setup's name and username can change later"))
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
      } header: {
        Text("Name", tableName: "Account", comment: "Profile name field label")
      } footer: {
        if !isRequiredSetup {
          Text(
            "How Zoonk and your buddy call you", tableName: "Account",
            comment: "What the profile name is for")
        }
      }

      if showsUsernameField {
        Section {
          HStack(spacing: 2) {
            Text(verbatim: "@")
              .foregroundStyle(.secondary)
              .accessibilityHidden(true)

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
          }
        } header: {
          Text("Username", tableName: "Account", comment: "Profile username field label")
        } footer: {
          Text(
            "3-30 characters. Letters, numbers, and underscores only.",
            tableName: "Account",
            comment: "Username requirements below the profile field")
        }
      } else {
        Section {
          HStack {
            if username.isEmpty {
              ProgressView()
            } else {
              Text(
                "Your username: @\(username)", tableName: "Account",
                comment: "The username setup suggests; the argument is the username")
            }

            Spacer()

            Button {
              isChangingUsername = true
            } label: {
              Text("Change", tableName: "Account", comment: "Shows the username field in setup")
            }
            .accessibilityLabel(
              Text("Change username", tableName: "Account", comment: "Shows the username field"))
          }
        }
      }

      if !isRequiredSetup {
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
      }

      if session.failure != nil {
        Section {
          AccountFailureMessage(failure: session.failure)
        }
      }

      if isRequiredSetup {
        StepButtons(canContinue: isValid && !session.isWorking, onContinue: save)
      }

      if let deleteAccount {
        Section {
          DataExportRow(
            title: Text(
              "Download my data", tableName: "Account",
              comment: "Row that downloads everything Zoonk keeps about the learner"),
            description: Text(
              "Everything Zoonk keeps about you, as one file", tableName: "Account",
              comment: "What the data download contains"),
            filename: "zoonk-data"
          ) {
            await settings.exportAccountData()
          }
        } header: {
          Text("Your data", tableName: "Account", comment: "Profile section with the data download")
        }

        Section {
          Button(role: .destructive, action: deleteAccount) {
            Text(
              "Delete my account", tableName: "Account",
              comment: "Opens permanent account deletion")
          }
        } header: {
          Text("Delete account", tableName: "Account", comment: "Profile section about deletion")
        } footer: {
          Text(
            "Deletes your account and everything in it for good. Plus bought on the web is canceled; App Store purchases are managed in the App Store.",
            tableName: "Account", comment: "What deleting the account does")
        }
      }
    }
    .disabled(session.isWorking)
    .navigationTitle(
      isRequiredSetup
        ? Text(verbatim: "")
        : Text("Profile", tableName: "Account", comment: "Profile editor navigation title")
    )
    .toolbarTitleDisplayMode(.inline)
    .task {
      guard isRequiredSetup, username.isEmpty else {
        return
      }

      let suggestion = await session.usernameSuggestion()

      guard !Task.isCancelled else {
        return
      }

      if let suggestion {
        username = suggestion
      } else {
        isChangingUsername = true
      }
    }
    .onChange(of: session.failure) {
      if session.failure == .usernameTaken {
        isChangingUsername = true
      }
    }
    .toolbar {
      if !isRequiredSetup {
        ToolbarItem(placement: .confirmationAction) {
          Button(action: save) {
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
  }

  private var showsUsernameField: Bool {
    !isRequiredSetup || isChangingUsername
  }

  private func save() {
    Task {
      let didUpdate = await session.updateProfile(
        name: normalizedName, username: normalizedUsername)

      if didUpdate && !isRequiredSetup {
        dismiss()
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
