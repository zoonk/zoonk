import SwiftUI

struct LevelStatsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    StatsContent(state: progress.level.state, retry: { await progress.level.refresh() }) { level in
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
        // A section's gap from the panel; the line under it is the rack's own.
        .padding(.top, 12)

      // On a belt's tenth level the panel already names the next belt.
      if let next = level.nextBelt, level.level < 10 {
        StatsLine(
          text: Text(
            "\(String(localized: next.belt.localizedTitle)) comes after level \(10), at \(next.startBrainPower.formatted()) Brain Power",
            tableName: "Progress",
            comment:
              "{next} is a belt's name, such as \"Yellow belt\". {count} is a belt's last level, 10."
          ))
      }
    }
  }

  @ViewBuilder
  private var nextLine: some View {
    if level.nextBelt == nil, level.isMaxLevel {
      Label {
        Text("Every belt earned", tableName: "Progress")
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
        "\(level.bpToNextLevel.formatted()) Brain Power to level \(level.level + 1)",
        tableName: "Progress")
    }
  }

  private func beltAndNumber(_ belt: ProgressBelt, _ number: Int) -> String {
    String(
      localized: "\(String(localized: belt.localizedTitle))\u{00A0}· Level \(number)",
      table: "Progress",
      comment:
        "A belt and a level inside it, from 1 to 10, as in “Yellow belt · Level 2”. It heads the Level page."
    )
  }
}
