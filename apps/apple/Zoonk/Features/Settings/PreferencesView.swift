import SwiftUI

/// Light, dark and reduced motion follow the device, so there's no theme picker.
struct PreferencesView: View {
  @Environment(\.openURL) private var openURL
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SettingsStore.self) private var settings
  @State private var isEditingBuddy = false

  var body: some View {
    ZoonkList {
      Section {
        PageHeader(
          Text("Preferences", tableName: "Account", comment: "Title of the Preferences page"),
          supporting: Text(
            "Your buddy, lessons and language, the way you like them.", tableName: "Settings",
            comment: "Under the Preferences page's title: what the page changes"))
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
            Text(
              "\(BuddyStage(belt: learner.summary.value?.level?.belt ?? .white).name)\u{00A0}· \(preferences.buddy.glasses.worn)",
              tableName: "Settings",
              comment: "The buddy's growth stage and glasses, as in “Baby · Round glasses”")
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

          Picker(selection: dailyLimitBinding(preferences)) {
            Text("No limit", tableName: "Settings", comment: "Daily time limit option: none")
              .tag(Int?.none)

            ForEach(preferences.dailyLimitChoices, id: \.self) { minutes in
              Text(
                "\(studyDuration(minutes: minutes)) a day",
                tableName: "Settings",
                comment: "Daily time limit option, as in “30 min a day”"
              )
              .tag(Int?.some(minutes))
            }
          } label: {
            ListRow(
              Text(
                "Daily time limit", tableName: "Settings",
                comment: "Setting that ends the day's study after a time"),
              description: Text(
                "Stop for the day after this much study.", tableName: "Settings",
                comment: "Explains the daily time limit"))
          }
        } header: {
          SectionTitle(
            Text("Lessons", tableName: "Settings", comment: "Preferences section about lessons"))
        }

        Section {
          SettingToggle(
            isOn: usageDataBinding,
            title: Text(
              "Share usage data", tableName: "Settings",
              comment: "Switch that lets Zoonk record how the learner uses it, for analytics"),
            description: Text(
              "Shows us how you use Zoonk, so we can improve it", tableName: "Settings",
              comment: "What sharing usage data does"))
        } header: {
          SectionTitle(
            Text(
              "Your data", tableName: "Settings",
              comment: "Preferences section about the learner's data"))
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
      } header: {
        SectionTitle(
          Text("Language", tableName: "Settings", comment: "Preferences section about language"))
      } footer: {
        SectionFooter {
          Text(
            "Zoonk follows your device's language. Change it for Zoonk alone in Settings.",
            tableName: "Settings",
            comment: "Explains where the app's language is changed on iPhone and iPad")
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
      String(localized: "Preferences", table: "Account", comment: "Title of the Preferences page"))
    .overlay {
      SettingsLoadingState(state: settings.preferences.state) {
        Task {
          await settings.preferences.refresh()
        }
      }
    }
    .loads(settings.preferences)
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

  private func soundsBinding(_ preferences: LearningPreferences) -> Binding<Bool> {
    Binding(
      get: { preferences.soundsEnabled },
      set: { enabled in
        Task {
          await settings.updatePreferences(.soundsEnabled(enabled))
        }
      })
  }

  private var usageDataBinding: Binding<Bool> {
    Binding(
      get: { learner.summary.value?.analytics.usageDataSharing == true },
      set: { shares in
        learner.showUsageDataSharing(shares)

        Task {
          await settings.updatePreferences(.shareUsageData(shares))
        }
      })
  }

  private func dailyLimitBinding(_ preferences: LearningPreferences) -> Binding<Int?> {
    Binding(
      get: { preferences.dailyLimitMinutes },
      set: { minutes in
        Task {
          await settings.updatePreferences(.dailyLimitMinutes(minutes))
        }
      })
  }
}

struct ChangeLimitButton: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    Button {
      router.present(.account(.preferences))
    } label: {
      Text("Change limit", tableName: "Settings", comment: "Opens the daily time limit setting")
        .typeWeight(.semibold)
    }
    .buttonStyle(.borderless)
  }
}

struct SettingsSaveError: View {
  var body: some View {
    Section {
      Label {
        Text(
          "That didn't save. Try again.", tableName: "Settings",
          comment: "Shown when a setting change didn't save")
      } icon: {
        Image(systemName: "exclamationmark.circle")
      }
      .foregroundStyle(.destructiveText)
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
  nativeLanguageName(Bundle.main.preferredLocalizations.first ?? "en")
}

func nativeLanguageName(_ identifier: String) -> String {
  Locale(identifier: identifier).languageTitle(identifier)
}
