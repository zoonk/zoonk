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
  /// Turning push on here just met blocked notifications.
  @State private var pushRefused = false
  /// The time's and email's changes: false when one didn't save, while the learner is on the page.
  @State private var saving = VisitRequest<Bool>()
  /// Nil when no setup ran and the plain change saved.
  @State private var pushSetup = VisitRequest<PushSetup>()

  var body: some View {
    ZoonkList {
      Section {
        PageHeader(
          Text(
            "Reminders", tableName: "Reminders", comment: "Title of the reminders settings page"),
          supporting: Text(
            "One reminder on your \(Self.studyDays), if you're not done for the day.",
            tableName: "Reminders",
            comment:
              "Under the reminders page's title: what reminders do; the argument is the link “study days”"
          ))
      }

      if let reminder = reminders.reminder.value {
        Section {
          DatePicker(selection: timeBinding(reminder), displayedComponents: .hourAndMinute) {
            ListRow(
              Text("Time", tableName: "Reminders", comment: "Row for the time reminders go out"),
              description: ReminderTime.zoneName(reminder.timeZone).map { Text($0) })
          }
          .environment(\.timeZone, .gmt)
        }

        Section {
          emailRow(reminder)
          pushRows(reminder)
        }

        if reminder.quiet {
          Section {
            Label {
              Text(
                "Paused while you're away. Studying turns them back on.", tableName: "Reminders")
            } icon: {
              Image(systemName: "moon.zzz")
            }
            .foregroundStyle(.mutedForeground)
          }
        }
      }

      if saving.outcome == false || pushSetup.outcome == .failed {
        SettingsSaveError()
      }
    }
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
    .environment(
      \.openURL,
      OpenURLAction { url in
        guard url == Self.planLink else {
          return .systemAction
        }

        router.sheet = nil
        router.showRoot(of: .plan)
        return .handled
      }
    )
    .task(id: scenePhase) {
      if scenePhase == .active {
        notificationsOff = await notifications.isDenied()
      }
    }
    .onDisappear {
      pushSetup.leave()
      saving.leave()
    }
  }

  @ViewBuilder
  private func emailRow(_ reminder: StudyReminder) -> some View {
    if let address = reminder.emailAddress {
      SettingToggle(
        isOn: Binding(
          get: { reminder.emailOn },
          set: { on in save(StudyReminderChange(emailOn: on)) }),
        title: Text("Email", tableName: "Reminders", comment: "Switch for email reminders"),
        description: Text(verbatim: address))
    } else {
      Button(action: createAccount) {
        ListRow(
          Text("Email", tableName: "Reminders", comment: "Switch for email reminders"),
          description: Text(
            "Create an account to get email reminders", tableName: "Reminders")
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
          setUpPush { [reminders] in await reminders.setPush(on, in: reminder) }
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
    .disabled(pushSetup.isRunning)

    if reminder.phone != nil, !isThisPhone {
      BusyButton(isBusy: pushSetup.isRunning, icon: .notify) {
        setUpPush { [reminders] in await reminders.useThisPhone() }
      } label: {
        Text(
          "Use this device", tableName: "Reminders",
          comment: "Sends push reminders to this device instead of the one chosen before")
      }
      .buttonStyle(.outline)
      .controlSize(.small)
    }

    // A learner who chose email, or never wanted push, isn't nudged to turn it back on.
    if notificationsOff, pushRefused || (reminder.pushOn && isThisPhone) {
      NotificationsOffNotice()
    }
  }

  private func setUpPush(_ setUp: @escaping @MainActor () async -> PushSetup?) {
    pushSetup.run(setUp) { result in
      if result == .denied {
        notificationsOff = true
        pushRefused = true
      }
    }
  }

  private func save(_ change: StudyReminderChange) {
    saving.run { [reminders] in await reminders.change(change) }
  }

  private static let planLink = URL(string: "zoonk-reminders:plan")!

  /// Opens the Plan, where the study days are.
  private static var studyDays: AttributedString {
    var link = AttributedString(
      localized: "study days", table: "Reminders",
      comment: "Link to the Plan inside “One reminder on your study days…”")
    link.link = planLink
    return link
  }

  private func timeBinding(_ reminder: StudyReminder) -> Binding<Date> {
    Binding(
      get: { ReminderTime.date(reminder.time) },
      set: { date in
        save(StudyReminderChange(time: ReminderTime.string(date)))
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
