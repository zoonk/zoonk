import SwiftUI

struct BuddyDayView: View {
  @Environment(BuddyStore.self) private var buddy
  @Environment(\.tutorPlaces) private var places
  @Environment(TodayStore.self) private var todayStore

  let status: BuddyStatus
  let name: String
  /// The page's, so a tap goes on while the day's pane goes as the page joins its panes.
  let tap: BuddyMissionTap
  let onGlasses: () -> Void
  var showsTitle = false

  var body: some View {
    ZoonkList {
      if showsTitle {
        VStack(alignment: .leading, spacing: 2) {
          title
            .typeStyle(.body.weight(.semibold))
          subtitle
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
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
                  mission: row, buddyName: name, isBusy: blockID != nil && tap.opening == blockID,
                  failed: blockID != nil && tap.failed == blockID
                ) {
                  if let opens = mission.opens?.value1 {
                    open(opens)
                  }
                }
                .disabled(tap.opening != nil && tap.opening != blockID)
              }
            }
          }
        } header: {
          if !earned {
            SectionTitle(
              Text("Today's missions", tableName: "Buddy", comment: "Section of the day's missions")
            )
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
        SectionTitle(Text(name))
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
    status.growthLine
  }

  /// The day is where Energy is taught, so it's named as the buddy's.
  private var energyTitle: Text {
    Text(
      "\(name)'s Energy", tableName: "Buddy",
      comment: "The buddy's Energy; the argument is its name")
  }

  private func open(_ opens: Components.Schemas.StudyMissionOpens) {
    guard let blockID = opens.blockID else {
      places.open(.mission(opens))
      return
    }

    tap.open(blockID, today: todayStore, places: places) {
      await buddy.status.refresh()
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
              energyTitle
            } icon: {
              Image(systemName: "bolt.fill")
                .foregroundStyle(.energy)
            }

            Meter(value: min(max(current / 100, 0), 1), fill: .energy)
              .accessibilityHidden(true)

            if let line = status.energyLine(name: name) {
              line
                .typeStyle(.note)
                .foregroundStyle(.mutedForeground)
            }
          }
        }
        .foregroundStyle(.primary)
      } else {
        VStack(alignment: .leading, spacing: 4) {
          Label {
            energyTitle
          } icon: {
            Image(systemName: "bolt.fill")
              .foregroundStyle(.energy)
          }

          Text(
            "It starts with your first lesson.", tableName: "Buddy",
            comment: "The buddy's Energy before the first lesson"
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
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

/// A block mission opens as Today's rows do, so the row says when it didn't. The tap is the page's:
/// a tap whose page went (another tab, a task over it) is cancelled and says nothing.
@MainActor
@Observable
final class BuddyMissionTap {
  /// The block a mission tap is opening, and the one that didn't open, as Today keeps its rows'.
  private(set) var opening: String?
  private(set) var failed: String?
  @ObservationIgnored private var task: Task<Void, Never>?

  /// `refreshDay` reads the day again when the open changed it rather than opening a screen.
  func open(
    _ blockID: String, today: TodayStore, places: TutorPlaces,
    refreshDay: @escaping @MainActor () async -> Void
  ) {
    guard opening == nil else {
      return
    }

    opening = blockID
    failed = nil

    task = Task {
      let result = await today.open(blockID: blockID)

      switch result {
      // Busy until the card shows what changed, which the open's own invalidation doesn't wait for.
      case .done(.changed) where !Task.isCancelled:
        await refreshDay()
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

  func cancel() {
    task?.cancel()
  }

  /// Another goal's or day's missions start without the last one's tap.
  func startOver() {
    task?.cancel()
    failed = nil
  }
}
