import SwiftUI

/// The buddy's day, beside the conversation on a wide screen and in a sheet on a phone: Energy,
/// today's missions, then the buddy (how it grows, what it remembers, its glasses, the week's
/// summary).
struct BuddyDayView: View {
  @Environment(\.tutorPlaces) private var places

  let status: BuddyStatus
  let name: String
  let onGlasses: () -> Void
  /// Hides the day: its sheet on a phone, its column on a wide screen.
  let onClose: () -> Void

  var body: some View {
    NavigationStack {
      List {
        energy

        if let today = status.today, !today.missions.isEmpty {
          Section {
            ForEach(Array(today.missions.enumerated()), id: \.offset) { _, mission in
              BuddyMissionRow(mission: mission, buddyName: name) {
                if let opens = mission.opens?.value1 {
                  places.open(.mission(opens))
                }
              }
            }
          } header: {
            missionsHeader(today)
          }
        }

        Section {
          Button {
            places.open(.memory)
          } label: {
            Text(
              "What \(name) remembers", tableName: "Buddy",
              comment: "Opens what the buddy remembers; the argument is its name")
          }

          Button(action: onGlasses) {
            LabeledContent {
              Text(
                "\(status.earnedGlasses) of \(status.glasses.count)", tableName: "Buddy",
                comment: "Glasses earned of all of them"
              )
              .monospacedDigit()
            } label: {
              Text("Glasses", tableName: "Buddy", comment: "Opens the buddy's glasses")
            }
          }

          Button {
            places.open(.logbook)
          } label: {
            Text("Weekly summary", tableName: "Buddy", comment: "Opens the week's logbook")
          }
        } header: {
          Text(name)
        }
        .foregroundStyle(.primary)
      }
      .navigationTitle(
        Text(
          "\(name) today", tableName: "Buddy",
          comment: "Title of the buddy's day; the argument is its name")
      )
      .navigationSubtitle(
        Text("\(status.stage.name) · \(status.growthLine)")
      )
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close, action: onClose)
        }
      }
    }
  }

  /// "Today's missions", how many and about how long, and the Brain Power every mission done
  /// adds.
  private func missionsHeader(_ today: BuddyStatus.TodayPayload) -> some View {
    let minutes = Int(today.missions.compactMap(\.minutes).reduce(0, +).rounded())

    return HStack(alignment: .firstTextBaseline) {
      VStack(alignment: .leading, spacing: 2) {
        Text("Today's missions", tableName: "Buddy", comment: "Section of the day's missions")

        Text(
          "\(missionCount(today.missions.count)) · ~\(minutes) min", tableName: "Buddy",
          comment:
            "How many missions today and about how long they take; the first argument is the count"
        )
        .font(.footnote)
        .foregroundStyle(.secondary)
      }

      Spacer()

      if today.fullMeal.bonus > 0 {
        Label {
          Text(
            "+\(today.fullMeal.bonus) Brain Power", tableName: "Buddy",
            comment: "The Brain Power every mission done adds")
        } icon: {
          Image(systemName: "brain")
        }
        .font(.footnote.monospacedDigit())
        .foregroundStyle(.brain)
      }
    }
    .textCase(nil)
  }

  private func missionCount(_ count: Int) -> String {
    String(localized: "\(count) missions", table: "Buddy", comment: "How many missions today")
  }

  @ViewBuilder
  private var energy: some View {
    Section {
      if let current = status.energy.current {
        Button {
          places.open(.energy)
        } label: {
          VStack(alignment: .leading, spacing: 8) {
            LabeledContent {
              Text((current / 100).formatted(.percent.precision(.fractionLength(0))))
                .monospacedDigit()
            } label: {
              Label {
                Text("Energy", tableName: "Buddy", comment: "The buddy's Energy")
              } icon: {
                Image(systemName: "bolt.fill")
                  .foregroundStyle(.energy)
              }
            }

            ProgressView(value: min(max(current / 100, 0), 1))
              .tint(.energy)
              .accessibilityHidden(true)

            status.energyLine(name: name)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
        }
        .foregroundStyle(.primary)
      } else {
        VStack(alignment: .leading, spacing: 4) {
          Label {
            Text("Energy", tableName: "Buddy", comment: "The buddy's Energy")
          } icon: {
            Image(systemName: "bolt.fill")
              .foregroundStyle(.energy)
          }

          Text(
            "Energy starts with your first lesson and grows as you learn.", tableName: "Buddy",
            comment: "Energy before the first lesson"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
      }
    }
  }
}

/// One of the day's missions: its mark, what it asks and how far it is. A tap opens where it's
/// done.
struct BuddyMissionRow: View {
  let mission: Components.Schemas.StudyMission
  let buddyName: String
  let open: () -> Void

  /// The block it still asks ("Why doesn't the electron fall?") and about how long it takes.
  private var stepLine: String? {
    let minutes = mission.minutes.map {
      String(
        localized: "\(Int($0.rounded())) min", table: "Buddy",
        comment: "About how long a mission takes")
    }
    let parts = [mission.detail?.value1.title, minutes].compactMap(\.self)
    return parts.isEmpty ? nil : parts.joined(separator: " · ")
  }

  var body: some View {
    let done = mission.status == .done

    Button(action: open) {
      Label {
        LabeledContent {
          if !done, mission.total > 1 {
            Text(verbatim: "\(mission.done)/\(mission.total)")
              .monospacedDigit()
          }
        } label: {
          mission.name(buddy: buddyName)
            .foregroundStyle(done ? .secondary : .primary)

          if !done, let line = stepLine {
            Text(line)
          }
        }
      } icon: {
        Image(systemName: done ? "checkmark.circle.fill" : "circle")
          .foregroundStyle(done ? AnyShapeStyle(.success) : AnyShapeStyle(.tertiary))
      }
    }
    .foregroundStyle(.primary)
    .disabled(done || mission.opens == nil)
    .accessibilityValue(
      done
        ? Text("Done", tableName: "Buddy", comment: "VoiceOver: a mission that's done") : Text(""))
  }
}
