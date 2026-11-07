import SwiftUI

/// Main's Settings > Reminders: the time, then each channel, then where study days come from.
struct RemindersView: View {
  @Environment(\.scenePhase) private var scenePhase
  @Environment(AppRouter.self) private var router
  @Environment(PushNotifications.self) private var notifications
  @Environment(StudyRemindersStore.self) private var reminders

  let createAccount: () -> Void

  /// Read from the system each time the app comes back, since it changes in Settings.
  @State private var notificationsOff = false
  @State private var pushFailed = false
  @State private var isSettingUpPush = false

  var body: some View {
    ZoonkList {
      Section {
        PageHeader(
          Text(
            "Reminders", tableName: "Reminders", comment: "Title of the reminders settings page"),
          supporting: Text(
            "One reminder on your study days, when you still have learning left.",
            tableName: "Reminders", comment: "Under the reminders page's title: what reminders do"))
      }

      if let reminder = reminders.reminder.value {
        Section {
          DatePicker(selection: timeBinding(reminder), displayedComponents: .hourAndMinute) {
            ListRow(
              Text("Time", tableName: "Reminders", comment: "Row for the time reminders go out"),
              description: Text(reminder.zoneName))
          }
          .environment(\.timeZone, .gmt)
        }

        Section {
          emailRow(reminder)
          pushRows(reminder)
        } footer: {
          SectionFooter {
            VStack(alignment: .leading, spacing: 4) {
              Text(
                "On your study days, from your plans.", tableName: "Reminders",
                comment: "Under the reminder switches: which days reminders go out")

              Button {
                router.sheet = nil
                router.showRoot(of: .plan)
              } label: {
                Text("See your plan", tableName: "Reminders", comment: "Opens the Plan")
                  .typeWeight(.semibold)
                  .underline()
              }
              .buttonStyle(.borderless)
            }
          }
        }

        if reminder.quiet {
          Section {
            Label {
              Text(
                "Paused while you're away. Studying turns them back on.", tableName: "Reminders",
                comment: "Reminders stopped after a week without study")
            } icon: {
              Image(systemName: "moon.zzz")
            }
            .foregroundStyle(.mutedForeground)
          }
        }
      }

      if reminders.saveFailed || pushFailed {
        SettingsSaveError()
      }
    }
    .navigationTitle(
      Text("Reminders", tableName: "Reminders", comment: "Title of the reminders settings page")
    )
    .barTitleAfterHero(
      String(
        localized: "Reminders", table: "Reminders",
        comment: "Title of the reminders settings page")
    )
    .overlay {
      SettingsLoadingState(state: reminders.reminder.state) {
        Task {
          await reminders.reminder.refresh()
        }
      }
    }
    .loads(reminders.reminder)
    .task(id: scenePhase) {
      if scenePhase == .active {
        notificationsOff = await notifications.isDenied()
      }
    }
  }

  @ViewBuilder
  private func emailRow(_ reminder: StudyReminder) -> some View {
    if let address = reminder.emailAddress {
      SettingToggle(
        isOn: Binding(
          get: { reminder.emailOn },
          set: { on in Task { await reminders.change(StudyReminderChange(emailOn: on)) } }),
        title: Text("Email", tableName: "Reminders", comment: "Switch for email reminders"),
        description: Text(verbatim: address))
    } else {
      Button(action: createAccount) {
        ListRow(
          Text("Email", tableName: "Reminders", comment: "Switch for email reminders"),
          description: Text(
            "Create an account to get email reminders", tableName: "Reminders",
            comment: "A guest's email reminders row, which opens account creation")
        )
        .disclosureChevron()
      }
      .foregroundStyle(.primary)
    }
  }

  @ViewBuilder
  private func pushRows(_ reminder: StudyReminder) -> some View {
    let isThisPhone = reminders.isThisPhone(reminder)

    SettingToggle(
      isOn: Binding(
        get: { reminder.pushOn },
        set: { on in
          Task {
            if on, reminder.phone == nil {
              await setUpPush { await reminders.turnOnPush() }
            } else {
              await reminders.change(StudyReminderChange(pushOn: on))
            }
          }
        }),
      title: Text(
        "Push notifications", tableName: "Reminders", comment: "Switch for push reminders"),
      description: reminder.phone.map { phone in
        isThisPhone
          ? Text(
            "\(phone.label)\u{00A0}· This device", tableName: "Reminders",
            comment: "The phone push reminders go to, as in “iPhone · This device”")
          : Text(verbatim: phone.label)
      }
    )
    .disabled(isSettingUpPush)

    if reminder.phone != nil, !isThisPhone {
      BusyButton(isBusy: isSettingUpPush, icon: .notify) {
        Task { await setUpPush { await reminders.useThisPhone() } }
      } label: {
        Text(
          "Use this device", tableName: "Reminders",
          comment: "Sends push reminders to this device instead of the one chosen before")
      }
      .buttonStyle(.outline)
      .controlSize(.small)
    }

    if notificationsOff, reminder.phone == nil || isThisPhone {
      NotificationsOffNotice()
    }
  }

  private func setUpPush(_ setUp: () async -> PushSetup) async {
    isSettingUpPush = true
    pushFailed = false
    let result = await setUp()
    isSettingUpPush = false

    switch result {
    case .on:
      break
    case .denied:
      notificationsOff = true
    case .failed:
      pushFailed = true
    }
  }

  private func timeBinding(_ reminder: StudyReminder) -> Binding<Date> {
    Binding(
      get: { ReminderTime.date(reminder.time) },
      set: { date in
        Task { await reminders.change(StudyReminderChange(time: ReminderTime.string(date))) }
      })
  }
}

/// The system blocks Zoonk's notifications, which only its Settings page turns back on.
struct NotificationsOffNotice<Actions: View>: View {
  @Environment(\.openURL) private var openURL

  @ViewBuilder var actions: Actions

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Label {
        Text(
          "Notifications are off for Zoonk.", tableName: "Reminders",
          comment: "The system blocks the app's notifications, so push reminders can't show")
      } icon: {
        Image(systemName: "bell.slash")
      }
      .foregroundStyle(.mutedForeground)

      ViewThatFits(in: .horizontal) {
        HStack(spacing: 8) {
          buttons
        }

        VStack(alignment: .leading, spacing: 8) {
          buttons
        }
      }
      .controlSize(.small)
    }
  }

  @ViewBuilder
  private var buttons: some View {
    Button {
      if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
        openURL(url)
      }
    } label: {
      Text(
        "Open Settings", tableName: "Reminders",
        comment: "Opens the system's notification settings for the app")
    }
    .buttonStyle(.outline)

    actions
  }
}

extension NotificationsOffNotice where Actions == EmptyView {
  init() {
    actions = EmptyView()
  }
}

extension StudyReminder {
  /// The zone reminders follow, named the system's way, as in “Brasília Time”.
  var zoneName: String {
    TimeZone(identifier: timeZone)?.localizedName(for: .generic, locale: .current) ?? timeZone
  }
}
