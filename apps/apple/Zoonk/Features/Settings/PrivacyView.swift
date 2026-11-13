import SwiftUI

/// Everyone shares usage data or not; only an account has data to download or delete.
struct PrivacyView: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SettingsStore.self) private var settings

  /// Nil for a guest, who has no account to delete.
  let deleteAccount: (() -> Void)?

  var body: some View {
    ZoonkList {
      Section {
        PageHeader(Text("Privacy", tableName: "Settings", comment: "Title of the Privacy page"))
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
      }

      if let deleteAccount {
        Section {
          DataExportRow(
            title: Text(
              "Download my data", tableName: "Account",
              comment: "Row that downloads everything Zoonk keeps about the learner"),
            filename: "zoonk-data"
          ) {
            await settings.exportAccountData()
          }

          Button(role: .destructive, action: deleteAccount) {
            Text(
              "Delete my account", tableName: "Account",
              comment: "Opens permanent account deletion"
            )
            .typeStyle(.rowTitle)
          }
          .foregroundStyle(.destructiveText)
        } header: {
          SectionTitle(
            Text(
              "Your data", tableName: "Settings",
              comment: "Privacy section with the data download and account deletion"))
        }
      }

      if settings.saveFailed {
        SettingsSaveError()
      }
    }
    .barTitleAfterHero(
      String(localized: "Privacy", table: "Settings", comment: "Title of the Privacy page")
    )
    // The switch saves through the preferences it belongs to.
    .loads(settings.preferences)
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
}
