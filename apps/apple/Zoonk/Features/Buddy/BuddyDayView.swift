import SwiftUI

struct BuddyDayView: View {
  @Environment(\.tutorPlaces) private var places

  let status: BuddyStatus
  let name: String
  let onGlasses: () -> Void
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
        let earned = today.fullMeal.earned

        Section {
          MissionsSummary(
            missions: today.missions.compactMap(StudyMission.init), bonus: today.fullMeal.bonus,
            earned: earned
          )
          .listRowSeparator(.hidden, edges: .bottom)

          if !earned {
            ForEach(Array(today.missions.enumerated()), id: \.offset) { _, mission in
              if let row = StudyMission(mission) {
                MissionRow(mission: row, buddyName: name) {
                  if let opens = mission.opens?.value1 {
                    places.open(.mission(opens))
                  }
                }
              }
            }
          }
        } header: {
          if !earned {
            Text("Today's missions", tableName: "Buddy", comment: "Section of the day's missions")
          }
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

  var title: Text {
    Text(
      "\(name) today", tableName: "Buddy",
      comment: "Title of the buddy's day; the argument is its name")
  }

  var subtitle: Text {
    Text("\(status.stage.name) · \(status.growthLine)")
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
