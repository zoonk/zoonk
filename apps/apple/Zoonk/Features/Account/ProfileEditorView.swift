import SwiftUI

struct ProfileEditorView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.isPaneSplit) private var isBesideTheList
  @Environment(SessionStore.self) private var session
  @State private var name: String
  @State private var username: String
  @State private var usernameCheck: UsernameCheck?
  /// Setup shows the username only when no username could be suggested.
  @State private var asksUsername = false
  @State private var isSaved = false
  @FocusState private var focusedField: Field?

  private enum Field {
    case name
    case username
  }

  let account: CurrentAccount
  let isRequiredSetup: Bool

  init(account: CurrentAccount, isRequiredSetup: Bool) {
    self.account = account
    self.isRequiredSetup = isRequiredSetup
    _name = State(initialValue: account.user.name)
    _username = State(initialValue: account.user.username ?? "")
  }

  private static var savedLine: String {
    String(
      localized: "Saved.", table: "Account",
      comment: "The profile saved and its editor stays open beside the settings")
  }

  var body: some View {
    ZoonkList {
      // Its sections lock while it saves, not the list, so the button that saves keeps its focus.
      Group {
        if isRequiredSetup {
          StepHeader(title: setupTitle, description: nil)
        } else {
          Section {
            PageHeader(
              Text("Profile", tableName: "Account", comment: "Profile editor navigation title"))
          }
        }

        Section {
          FormField(
            title: Text("Name", tableName: "Account", comment: "Profile name field label"),
            isFocused: focusedField == .name, isInvalid: isNameTooLong
          ) {
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
            .focused($focusedField, equals: .name)
          } hint: {
            if isNameTooLong {
              Text(
                "Use 150 characters or fewer.", tableName: "Account",
                comment: "Shown under the profile name field when the typed name is too long"
              )
              .foregroundStyle(.destructiveText)
            } else if !isRequiredSetup {
              NameHint()
            }
          }

          // Setup asks only the name: the username it saves is the one suggested, changed in Profile.
          if !isRequiredSetup || asksUsername {
            FormField(
              title: Text(
                "Username", tableName: "Account", comment: "Profile username field label"),
              isFocused: focusedField == .username,
              isInvalid: usernameStatus == .taken || usernameStatus == .invalid
            ) {
              HStack(spacing: 2) {
                Text(verbatim: "@")
                  .foregroundStyle(.mutedForeground)
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
                .focused($focusedField, equals: .username)
              }
            } hint: {
              usernameHint
            }
          }
        }

        if session.failure != nil {
          Section {
            AccountFailureMessage(failure: session.failure)
          }
        } else if isSaved {
          Section {
            Label {
              Text(Self.savedLine)
            } icon: {
              Image(systemName: "checkmark.circle")
            }
            .typeStyle(.note)
            .foregroundStyle(.successText)
          }
        }
      }
      .disabled(session.isWorking)
    }
    .bottomBar {
      if isRequiredSetup {
        StepButtons(canContinue: isValid, onContinue: save)
          .environment(\.isSavingAnswer, session.isWorking)
      }
    }
    .navigationTitle(
      isRequiredSetup
        ? setupTitle
        : Text("Profile", tableName: "Account", comment: "Profile editor navigation title")
    )
    .toolbarTitleDisplayMode(.inline)
    .toolbar(removing: isRequiredSetup ? .title : nil)
    .barTitleAfterHero(
      isRequiredSetup
        ? ""
        : String(localized: "Profile", table: "Account", comment: "Profile editor navigation title")
    )
    .task {
      if isRequiredSetup, username.isEmpty {
        await suggestUsername()
      }
    }
    .task(id: normalizedUsername) {
      await checkUsername()
    }
    .onChange(of: session.failure) {
      // Taken since it was suggested: the next Continue saves another.
      if isRequiredSetup, !asksUsername, session.failure == .usernameTaken {
        Task {
          await suggestUsername()
        }
      }
    }
    .onChange(of: name) { isSaved = false }
    .onChange(of: username) { isSaved = false }
    .announcesStatus(isSaved ? Self.savedLine : nil)
    .toolbar {
      if !isRequiredSetup {
        ToolbarItem(placement: .confirmationAction) {
          BusyButton(isBusy: session.isWorking, icon: .check, action: save) {
            Text("Save", tableName: "Account", comment: "Button that saves profile changes")
          }
          .disabled(!isValid)
        }
      }
    }
  }

  private var setupTitle: Text {
    Text(
      "What should we call you?", tableName: "Account",
      comment: "Title of the profile setup after signing up")
  }

  private func suggestUsername() async {
    let suggestion = await session.usernameSuggestion()

    guard !Task.isCancelled else {
      return
    }

    if let suggestion {
      username = suggestion
      usernameCheck = UsernameCheck(username: normalizedUsername, status: .available)
    } else {
      asksUsername = true
    }
  }

  private var usernameStatus: UsernameStatus {
    .of(
      normalizedUsername, current: (account.user.username ?? "").lowercased(), check: usernameCheck)
  }

  @ViewBuilder
  private var usernameHint: some View {
    switch usernameStatus {
    case .checking:
      HStack(spacing: 6) {
        ProgressView()
          .controlSize(.mini)
        Text("Checking…", tableName: "Account", comment: "While a typed username is being checked")
      }
    case .available:
      Text(
        "\(normalizedUsername) is available", tableName: "Account",
        comment: "The typed username is free; the argument is the username"
      )
      .foregroundStyle(.successText)
    case .taken:
      Text(
        "\(normalizedUsername) is already taken", tableName: "Account",
        comment: "Another account has the typed username; the argument is the username"
      )
      .foregroundStyle(.destructiveText)
    case .idle:
      usernameRules
    case .invalid:
      usernameRules
        .foregroundStyle(.destructiveText)
    }
  }

  private var usernameRules: Text {
    Text(
      "3-30 characters. Letters a–z, numbers, and underscores only.",
      tableName: "Account",
      comment: "Username requirements below the profile field")
  }

  private func checkUsername() async {
    let candidate = normalizedUsername

    guard usernameStatus == .checking else {
      return
    }

    do {
      try await Task.sleep(for: .milliseconds(300))
    } catch {
      return
    }

    let isAvailable = await session.isUsernameAvailable(candidate)

    guard !Task.isCancelled else {
      return
    }

    let status: UsernameStatus = isAvailable.map { $0 ? .available : .taken } ?? .idle
    usernameCheck = UsernameCheck(username: candidate, status: status)
  }

  private func save() {
    isSaved = false

    Task {
      let didUpdate = await session.updateProfile(
        name: normalizedName, username: normalizedUsername)

      guard didUpdate, !isRequiredSetup else {
        return
      }

      if isBesideTheList {
        isSaved = true
      } else {
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

  private var isNameTooLong: Bool {
    ProfileName.isChangeTooLong(normalizedName, saved: account.user.name)
  }

  private var isValid: Bool {
    !normalizedName.isEmpty && !isNameTooLong && UsernameStatus.isWellFormed(normalizedUsername)
      && usernameStatus.canSave
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
          email: "hello@zoonk.com",
          id: UUID().uuidString,
          image: nil,
          name: "Zoonk User",
          username: "zoonk_user")),
      isRequiredSetup: false)
  }
  .environment(SessionStore.preview())
}
