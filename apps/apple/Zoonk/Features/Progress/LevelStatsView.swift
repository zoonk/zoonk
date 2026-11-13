import SwiftUI

struct LevelStatsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    StatsContent(state: progress.level.state, retry: { await progress.level.refresh() }) { level in
      StatsLine(
        text: Text(
          "You earn Brain Power for everything you study, and it never goes down.",
          tableName: "Progress", comment: "Under the Belt page's title: how Brain Power grows"))
      BeltProgression(level: level)
    }
    .loads(progress.level)
  }
}

extension LevelProgress {
  /// From 0 to 1, full at the last level.
  var share: Double {
    isMaxLevel ? 1 : min(max(Double(progressInLevel) / Double(max(bpPerLevel, 1)), 0), 1)
  }
}

/// Main's belt panel: the belt and its number with the learner's Brain Power, the drawn belt, and
/// what the next number takes. Under it, every belt.
private struct BeltProgression: View {
  @Environment(\.horizontalSizeClass) private var sizeClass

  let level: LevelProgress

  /// White and black would wash the panel white or gray, so their panel stays neutral.
  private var isNeutral: Bool {
    level.belt == .white || level.belt == .black
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 16) {
        HStack(alignment: .firstTextBaseline) {
          Text(beltAndNumber(level.belt, level.level))
            .typeStyle(.section)
            .frame(maxWidth: .infinity, alignment: .leading)

          Text(
            "\(level.totalBrainPower.formatted()) Brain Power", tableName: "Progress",
            comment: "The learner's Brain Power, at the end of the belt panel's first line"
          )
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
        }
        .accessibilityElement(children: .combine)

        BeltDrawing(level: level, isWide: sizeClass == .regular)
          .padding(.leading, sizeClass == .regular ? -24 : -16)

        nextLine
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)
      }
      .padding(sizeClass == .regular ? 24 : 16)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .fill(isNeutral ? Color.muted : Color.card)
          .overlay {
            if !isNeutral {
              RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(level.belt.color.opacity(0.1))
            }
          }
      }
      .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

      BeltRack(current: level.belt)

      if let next = level.nextBelt {
        StatsLine(
          text: Text(
            "\(String(localized: next.belt.localizedTitle)) comes after \(String(localized: level.belt.localizedTitle)) \(10), at \(next.startBrainPower.formatted()) Brain Power",
            tableName: "Progress",
            comment:
              "Under the belts: the next belt, the belt before it with its last number (10), and the Brain Power where the next one starts, as in Yellow belt comes after White belt 10, at 2,500 Brain Power"
          ))
      }
    }
  }

  @ViewBuilder
  private var nextLine: some View {
    if level.nextBelt == nil, level.isMaxLevel {
      Label {
        Text("Every belt earned", tableName: "Progress", comment: "Shown on Black, the last belt")
      } icon: {
        StatusMark(status: .done)
      }
    } else if level.level == 10, let next = level.nextBelt {
      Text(
        "\(level.bpToNextLevel.formatted()) Brain Power to \(String(localized: next.belt.localizedTitle))",
        tableName: "Progress",
        comment:
          "What the next belt takes, at a belt's tenth number, as in 96 Brain Power to Yellow belt")
    } else {
      Text(
        "\(level.bpToNextLevel.formatted()) Brain Power to \(beltAndNumber(level.belt, level.level + 1))",
        tableName: "Progress",
        comment: "What the belt's next number takes, as in 96 Brain Power to White belt 3")
    }
  }

  private func beltAndNumber(_ belt: ProgressBelt, _ number: Int) -> String {
    String(
      localized: "\(String(localized: belt.localizedTitle)) \(number)", table: "Progress",
      comment: "A belt and its number from 1 to 10, as in White belt 4")
  }
}
