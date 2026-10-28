import SwiftUI

/// The buddy's day, beside the conversation on a wide screen and in a sheet on a phone: Energy,
/// today's missions, then the buddy (how it grows, what it remembers, its glasses, the week's
/// summary).
struct BuddyDayView: View {
  @Environment(\.tutorPlaces) private var places

  let status: BuddyStatus
  let name: String
  let onGlasses: () -> Void
  /// Beside the conversation the day names itself; in its sheet the navigation bar does.
  var showsTitle = false

  var body: some View {
    List {
      if showsTitle {
        VStack(alignment: .leading, spacing: 2) {
          title
            .font(.headline)
          subtitle
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .listRowBackground(Color.clear)
        .accessibilityAddTraits(.isHeader)
      }

      energy

      if let today = status.today, !today.missions.isEmpty {
        Section {
          ForEach(Array(today.missions.enumerated()), id: \.offset) { _, mission in
            if let row = StudyMission(mission) {
              MissionRow(mission: row, buddyName: name) {
                if let opens = mission.opens?.value1 {
                  places.open(.mission(opens))
                }
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
  }

  /// "Otto today".
  var title: Text {
    Text(
      "\(name) today", tableName: "Buddy",
      comment: "Title of the buddy's day; the argument is its name")
  }

  /// "Baby · Grows to Young at Orange Belt".
  var subtitle: Text {
    Text("\(status.stage.name) · \(status.growthLine)")
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
