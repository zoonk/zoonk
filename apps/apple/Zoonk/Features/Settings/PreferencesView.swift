import SwiftUI

/// Preferences: the buddy, then the lessons' sounds and daily limit, then the app's language, which
/// iOS keeps per app in Settings. Light, dark and reduced motion follow the device, so there's no
/// theme picker, as on main.
struct PreferencesView: View {
  @Environment(\.openURL) private var openURL
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SettingsStore.self) private var settings
  @State private var isEditingBuddy = false

  var body: some View {
    Form {
      if let preferences = settings.preferences.value {
        Section {
          LabeledContent {
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
            .buttonStyle(.bordered)
          } label: {
            Text(preferences.buddy.displayName)
            Text(
              "\(BuddyStage(belt: learner.summary.value?.level?.belt ?? .white).name) · \(preferences.buddy.glasses.worn)",
              tableName: "Settings",
              comment: "The buddy's growth stage and glasses, as in “Baby · Round glasses”")
          }
        } header: {
          Text("Your buddy", tableName: "Settings", comment: "Preferences section about the buddy")
        }

        Section {
          Toggle(isOn: soundsBinding(preferences)) {
            Text("Sounds", tableName: "Settings", comment: "Switch for the lessons' sounds")
            Text(
              "When you get it right or finish", tableName: "Settings",
              comment: "When the lessons' sounds play")
          }
          .tint(.success)

          Picker(selection: dailyLimitBinding(preferences)) {
            Text("No limit", tableName: "Settings", comment: "Daily time limit option: none")
              .tag(Int?.none)

            ForEach(dailyLimitChoices, id: \.self) { minutes in
              Text(
                "\(Duration.seconds(minutes * 60).formatted(.units(allowed: [.hours, .minutes], width: .abbreviated))) a day",
                tableName: "Settings",
                comment: "Daily time limit option, as in “30 min a day”"
              )
              .tag(Int?.some(minutes))
            }
          } label: {
            Text(
              "Daily time limit", tableName: "Settings",
              comment: "Setting that ends the day's study after a time")
          }
        } header: {
          Text("Lessons", tableName: "Settings", comment: "Preferences section about lessons")
        } footer: {
          Text(
            "Stop for the day after this much study.", tableName: "Settings",
            comment: "Explains the daily time limit")
        }
      }

      Section {
        Button {
          if let url = URL(string: UIApplication.openSettingsURLString) {
            openURL(url)
          }
        } label: {
          LabeledContent {
            Text(appLanguage)
          } label: {
            Text("Language", tableName: "Settings", comment: "Row opening the app's language")
          }
        }
        .foregroundStyle(.primary)
      } header: {
        Text("Language", tableName: "Settings", comment: "Preferences section about language")
      } footer: {
        Text(
          "Zoonk follows your device's language. Change it for Zoonk alone in Settings.",
          tableName: "Settings",
          comment: "Explains where the app's language is changed on iPhone and iPad")
      }

      if settings.saveFailed {
        SettingsSaveError()
      }
    }
    .navigationTitle(
      Text("Preferences", tableName: "Settings", comment: "Title of the Preferences page")
    )
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
      }
    }
  }

  private var appLanguage: String {
    let identifier = Bundle.main.preferredLocalizations.first ?? "en"
    return Locale.current.localizedString(forIdentifier: identifier) ?? identifier
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

  private func dailyLimitBinding(_ preferences: LearningPreferences) -> Binding<Int?> {
    Binding(
      get: { preferences.dailyLimitMinutes.flatMap { dailyLimitChoices.contains($0) ? $0 : nil } },
      set: { minutes in
        Task {
          await settings.updatePreferences(.dailyLimitMinutes(minutes))
        }
      })
  }
}

/// A setting that didn't save, said under the controls: the screen shows what's saved, and the
/// control the learner used tries again.
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
      .foregroundStyle(.destructive)
    }
  }
}

/// What a settings page shows before its data: a spinner only while nothing is cached, and a way to
/// try again when the first read failed.
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
