import SwiftUI

struct BuddyDayView: View {
  @Environment(BuddyStore.self) private var buddy
  @Environment(\.isCoveredByTask) private var isCovered
  @Environment(\.tutorPlaces) private var places
  @Environment(TodayStore.self) private var todayStore

  let status: BuddyStatus
  let name: String
  let onGlasses: () -> Void
  var showsTitle = false

  /// The block a mission tap is opening, and the one that didn't open, as Today keeps its rows'.
  @State private var opening: String?
  @State private var failed: String?
  @State private var tapTask: Task<Void, Never>?

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
                let blockID = mission.opens?.value1.blockID

                MissionRow(
                  mission: row, buddyName: name, isBusy: blockID != nil && opening == blockID,
                  failed: blockID != nil && failed == blockID
                ) {
                  if let opens = mission.opens?.value1 {
                    open(opens)
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
    .onChange(of: isCovered) {
      if isCovered {
        tapTask?.cancel()
      }
    }
    // Another goal's or day's missions start without the last one's tap.
    .onChange(of: status.today.map { "\($0.goalId) \($0.localDate)" }) {
      tapTask?.cancel()
      failed = nil
    }
    .onDisappear {
      tapTask?.cancel()
    }
  }

  var title: Text {
    Text(
      "\(name) today", tableName: "Buddy",
      comment: "Title of the buddy's day; the argument is its name")
  }

  var subtitle: Text {
    Text("\(status.stage.name)\u{00A0}· \(status.growthLine)")
  }

  /// A block mission opens as Today's rows do, so the row says when it didn't. A tap whose screen
  /// went (another tab, a task over it, the day's sheet closed) is cancelled and says nothing.
  private func open(_ opens: Components.Schemas.StudyMissionOpens) {
    guard let blockID = opens.blockID else {
      places.open(.mission(opens))
      return
    }

    guard opening == nil else {
      return
    }

    opening = blockID
    failed = nil

    tapTask = Task {
      let result = await todayStore.open(blockID: blockID)

      switch result {
      // Busy until the card shows what changed, which the open's own invalidation doesn't wait for.
      case .done(.changed) where !Task.isCancelled:
        await buddy.status.refresh()
      case .done(let destination) where !Task.isCancelled:
        places.open(.missionStep(destination))
      case .failed:
        failed = blockID
      case .done, .obsolete:
        break
      }

      opening = nil
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
            IconLabeledContent {
              Text((current / 100).formatted(.percent.precision(.fractionLength(0))))
                .monospacedDigit()
            } title: {
              Text("Energy", tableName: "Buddy", comment: "The buddy's Energy")
            } icon: {
              Image(systemName: "bolt.fill")
                .foregroundStyle(.energy)
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

extension Components.Schemas.StudyMissionOpens {
  fileprivate var blockID: String? {
    if case .case1(let block) = self { block.blockId } else { nil }
  }
}
