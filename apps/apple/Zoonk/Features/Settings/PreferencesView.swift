import SwiftUI

/// Light, dark and reduced motion follow the device, so there's no theme picker.
struct PreferencesView: View {
  @Environment(\.openURL) private var openURL
  @Environment(SettingsStore.self) private var settings
  @State private var isEditingBuddy = false
  @State private var isPickingHome = false

  var body: some View {
    ZoonkList {
      Section {
        PageHeader(
          Text("Preferences", tableName: "Account", comment: "Title of the Preferences page"))
      }

      if let preferences = settings.preferences.value {
        Section {
          IconLabeledContent {
            Button {
              isEditingBuddy = true
            } label: {
              if preferences.buddyPicked {
                Text("Change", tableName: "Settings", comment: "Opens the buddy editor")
              } else {
                Text(
                  "Choose your buddy", tableName: "Settings",
                  comment: "Opens the buddy editor before the learner picked one")
              }
            }
            .buttonStyle(.outline)
            .controlSize(.small)
          } title: {
            Text(preferences.buddy.displayName)
          } icon: {
            BuddyFace(kind: preferences.buddy.kind, glasses: preferences.buddy.glasses)
              .typeStyle(.section.weight(.regular))
          }
        } header: {
          SectionTitle(
            Text(
              "Your buddy", tableName: "Settings", comment: "Preferences section about the buddy"))
        }

        Section {
          SettingToggle(
            isOn: soundsBinding(preferences),
            title: Text("Sounds", tableName: "Settings", comment: "Switch for the lessons' sounds"),
            description: Text(
              "When you get it right or finish", tableName: "Settings",
              comment: "When the lessons' sounds play"))

        } header: {
          SectionTitle(
            Text("Lessons", tableName: "Settings", comment: "Preferences section about lessons"))
        }

      }

      Section {
        Button {
          if let url = URL(string: UIApplication.openSettingsURLString) {
            openURL(url)
          }
        } label: {
          ListRow(
            Text("Language", tableName: "Settings", comment: "Row opening the app's language")
          ) {
            EmptyView()
          } trailing: {
            Text(appLanguageName)
              .typeStyle(.meta)
          }
        }
        .foregroundStyle(.primary)

        // Beside the language's own name, which says whose words it is ("Português (Brasil)").
        if let preferences = settings.preferences.value {
          Button {
            isPickingHome = true
          } label: {
            ListRow(
              Text(
                "Where you live", tableName: "Settings",
                comment: "Row with the country the learner lives in, which they tell us")
            ) {
              EmptyView()
            } trailing: {
              homeCountryName(preferences)
                .typeStyle(.meta)
                .multilineTextAlignment(.trailing)
            }
            .disclosureChevron()
          }
          .foregroundStyle(.primary)
        }
      } header: {
        SectionTitle(
          Text(
            "Language and region", tableName: "Settings",
            comment: "Preferences section about the app's language and where the learner lives"))
      } footer: {
        if settings.preferences.value != nil {
          SectionFooter {
            Text(
              "So examples and exams match your country.", tableName: "Settings",
              comment: "Under the country the learner lives in: what it changes")
          }
        }
      }

      if settings.saveFailed {
        SettingsSaveError()
      }
    }
    .navigationTitle(
      Text("Preferences", tableName: "Account", comment: "Title of the Preferences page")
    )
    .barTitleAfterHero(
      String(localized: "Preferences", table: "Account", comment: "Title of the Preferences page")
    )
    .overlay {
      SettingsLoadingState(state: settings.preferences.state) {
        Task {
          await settings.preferences.refresh()
        }
      }
    }
    .loads(settings.preferences)
    .sheet(isPresented: $isPickingHome) {
      if let preferences = settings.preferences.value {
        CountryPickerSheet(
          title: Text(
            "Where you live", tableName: "Settings",
            comment: "Row with the country the learner lives in, which they tell us"),
          language: OnboardingAPI.language,
          suggested: preferences.suggestedCountries,
          selected: preferences.homeCountry?.code
        ) { choice in
          // Nothing rebuilds, so it closes at once; a failed save shows on the page.
          Task {
            await settings.updatePreferences(.homeCountry(choice))
          }

          return true
        }
        .zoonkStyles()
      }
    }
    .sheet(isPresented: $isEditingBuddy) {
      if let preferences = settings.preferences.value {
        BuddyEditor(choice: preferences.buddy, availableGlasses: preferences.availableGlasses) {
          choice in
          Task {
            await settings.updatePreferences(.buddy(choice))
          }
        }
        .zoonkStyles()
      }
    }
  }

  private func homeCountryName(_ preferences: LearningPreferences) -> Text {
    preferences.homeCountry.map { Text($0.name) }
      ?? Text(
        "Not set", tableName: "Settings",
        comment: "Where the learner lives, when they haven't said")
  }

  private func soundsBinding(_ preferences: LearningPreferences) -> Binding<Bool> {
    Binding(
      get: { preferences.soundsEnabled },
      set: { enabled in
        Task {
          await settings.updatePreferences(.soundsEnabled(enabled))
        }
      })
  }
}

struct SettingsSaveError: View {
  var body: some View {
    Section {
      FailureLine(
        message: LocalizedStringResource(
          "That didn't save. Try again.", table: "Settings",
          comment: "Shown when a setting change didn't save"),
        systemImage: "exclamationmark.circle")
    }
  }
}

struct SettingsLoadingState<Value: Equatable & Sendable>: View {
  let state: LoadState<Value>
  let retry: () -> Void

  var body: some View {
    switch state {
    case .idle, .loading:
      ProgressView()
    case .failed:
      ContentUnavailableView {
        Label {
          Text(
            "Couldn't load this page", tableName: "Settings",
            comment: "Title shown when a settings page couldn't load")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } description: {
        Text(
          "Check your connection and try again.", tableName: "Settings",
          comment: "Explains how to recover when a settings page couldn't load")
      } actions: {
        Button(action: retry) {
          Text("Try again", tableName: "Settings", comment: "Retries loading a settings page")
        }
        .buttonStyle(.mainAction)
      }
    case .loaded, .empty:
      EmptyView()
    }
  }
}

/// The language the app shows, which the device chooses.
var appLanguageName: String {
  appLanguageLabel(Bundle.main.preferredLocalizations.first ?? "en")
}

/// Main's `LOCALE_LABELS`: a language whose words are one country's names it. Fixed, since the
/// system calls `en-US` "English (United States)".
func appLanguageLabel(_ identifier: String) -> String {
  switch String(identifier.prefix(2)) {
  case "en": "English (US)"
  case "es": "Español (México)"
  case "pt": "Português (Brasil)"
  default: nativeLanguageName(identifier)
  }
}

func nativeLanguageName(_ identifier: String) -> String {
  Locale(identifier: identifier).languageTitle(identifier)
}
