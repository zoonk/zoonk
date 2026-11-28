import SwiftUI

struct BuddyDayView: View {
  @Environment(BuddyStore.self) private var buddy
  @Environment(\.tutorPlaces) private var places
  @Environment(TodayStore.self) private var todayStore

  let status: BuddyStatus
  let name: String
  /// The page's, so a tap goes on as the sheet is drawn again.
  let tap: BuddyMissionTap
  /// Asking happens in the page's own composer, so the sheet hands it back.
  let ask: () -> Void

  var body: some View {
    ZoonkList {
      energy

      if let today = status.today, !today.missions.isEmpty {
        // Today's missions card, as Today draws it.
        PageSection(isPanel: true) {
          MissionsSummary(
            missions: today.missions.compactMap(StudyMission.init), bonus: today.fullMeal.bonus,
            earned: today.fullMeal.earned, collapsesWhenWon: false
          )
          .rowSeparatorHiddenBelow()

          ForEach(Array(today.missions.enumerated()), id: \.offset) { _, mission in
            if let row = StudyMission(mission) {
              missionRow(row, opens: mission.opens?.value1)
            }
          }
        } header: {
          EmptyView()
        }
      }

      if let firstSteps = status.firstSteps?.value1 {
        firstStepsSection(firstSteps)
      }
    }
  }

  /// Main's first steps: only the ones a learner can do now are rows. The ones done are in the
  /// count, and the ones that open later are one line, since a row nobody can press only says when
  /// the plan gets to it.
  private func firstStepsSection(_ firstSteps: Components.Schemas.BuddyFirstSteps) -> some View {
    let steps = firstSteps.steps.filter { $0.kind != .unrecognized }
    let later = steps.filter { $0.status == .later }.count

    return PageSection {
      ForEach(
        steps.filter { $0.status == .today || $0.status == .available }, id: \.kind
      ) { step in
        if let row = StudyMission(step) {
          missionRow(
            row, opens: step.opens?.value1, name: step.kind.name(buddy: name), isFirstStep: true)
        }
      }

      if later > 0 {
        Text("\(later) more open as you go", tableName: "Buddy")
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }

      if firstSteps.completedOn != nil {
        Text("You've tried everything.", tableName: "Buddy")
          .typeStyle(.note.weight(.medium))
          .foregroundStyle(.successText)
      }
    } header: {
      SectionTitle(Text("First steps", tableName: "Buddy")) {
        Text("\(firstSteps.done) of \(firstSteps.total)", tableName: "Buddy")
      }
    }
  }

  private func missionRow(
    _ mission: StudyMission, opens: Components.Schemas.StudyMissionOpens?,
    name rowName: String? = nil, isFirstStep: Bool = false
  ) -> some View {
    let key = opens?.blockID.map { BuddyMissionTap.Row(blockID: $0, isFirstStep: isFirstStep) }

    return MissionRow(
      mission: mission, buddyName: name, name: rowName, isBusy: key != nil && tap.opening == key,
      failed: key != nil && tap.failed == key
    ) {
      if let opens {
        open(opens, isFirstStep: isFirstStep)
      }
    }
    .disabled(tap.opening != nil && tap.opening != key)
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

  private func open(_ opens: Components.Schemas.StudyMissionOpens, isFirstStep: Bool) {
    if case .case4 = opens {
      ask()
      return
    }

    guard let blockID = opens.blockID else {
      places.open(.mission(opens))
      return
    }

    tap.open(
      BuddyMissionTap.Row(blockID: blockID, isFirstStep: isFirstStep), today: todayStore,
      places: places
    ) {
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
              Text(
                (current / 100).formatted(
                  .percent.precision(.fractionLength(0)).locale(.appLanguage))
              )
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
        Button {
          places.open(.energy)
        } label: {
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
        }.buttonStyle(.plain)
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
  /// A row that opens a block. A first step and a mission can open the same one, and only the row
  /// tapped shows it opening.
  struct Row: Equatable {
    let blockID: String
    let isFirstStep: Bool
  }

  /// The row a tap is opening, and the one that didn't open, as Today keeps its rows'.
  private(set) var opening: Row?
  private(set) var failed: Row?
  @ObservationIgnored private var task: Task<Void, Never>?

  /// `refreshDay` reads the day again when the open changed it rather than opening a screen.
  func open(
    _ row: Row, today: TodayStore, places: TutorPlaces,
    refreshDay: @escaping @MainActor () async -> Void
  ) {
    guard opening == nil else {
      return
    }

    opening = row
    failed = nil

    task = Task {
      let result = await today.open(blockID: row.blockID)

      guard !Task.isCancelled else {
        return
      }

      switch result {
      // Busy until the card shows what changed, which the open's own invalidation doesn't wait for.
      case .done(.changed):
        await refreshDay()

        guard !Task.isCancelled else {
          return
        }
      case .done(let destination):
        places.open(.missionStep(destination))
      case .failed:
        failed = row
      case .obsolete:
        break
      }

      opening = nil
    }
  }

  /// The page left, a task covers it, or another goal's or day's missions show: the tap ends, and
  /// the next one starts with nothing of it, whether it opened, failed or still runs.
  func cancel() {
    task?.cancel()
    task = nil
    opening = nil
    failed = nil
  }
}
