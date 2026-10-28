import SwiftUI

/// The buddy's day, beside the conversation on a wide screen and in a sheet on a phone: Energy,
/// today's missions, then the buddy (how it grows, what it remembers, its glasses, the week's
/// summary).
struct BuddyDayView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.tutorPlaces) private var places

  let status: BuddyStatus
  let name: String
  let onGlasses: () -> Void

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
            Text("Today's missions", tableName: "Buddy", comment: "Section of the day's missions")
          }
        }

        Section {
          status.growthLine

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
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
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
