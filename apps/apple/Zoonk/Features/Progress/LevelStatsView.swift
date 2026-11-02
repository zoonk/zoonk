import SwiftUI

struct LevelStatsView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    StatsContent(state: progress.level.state, retry: { await progress.level.refresh() }) { level in
      LevelTiles(level: level)
      BeltProgression(level: level)
      StatsLine(
        text: Text(
          "Every lesson adds \(10) Brain Power, and it never goes down.", tableName: "Progress",
          comment:
            "Under the belts: how Brain Power grows. The number is the Brain Power a lesson earns"))
    }
    .loads(progress.level)
  }
}

private struct LevelTiles: View {
  let level: LevelProgress
  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    StatTileGrid(columns: [3, 2, 1], minimumWidth: minimumWidth) {
      StatTile(
        label: Text(StatsSection.level.title),
        value: Text(level.level, format: .number),
        icon: { BeltDot(belt: level.belt) },
        detail: Text(level.belt.localizedTitle)
      )

      StatTile(
        label: Text(
          "Brain Power", tableName: "Progress",
          comment: "Brain Power, the points every lesson earns"),
        value: Text(level.totalBrainPower, format: .number),
        systemImage: "brain", tone: .brain,
        detail: Text(
          "Never goes down", tableName: "Progress", comment: "Under the total Brain Power")
      )

      nextLevelTile
    }
  }

  /// After a belt's tenth level the next one is the next belt's first, so the tile names that belt
  /// instead of an eleventh level.
  @ViewBuilder
  private var nextLevelTile: some View {
    if level.isMaxLevel {
      StatTile(
        label: Text(
          "Next level", tableName: "Progress", comment: "Tile: the Brain Power the next level takes"
        ),
        value: Text(verbatim: "–"),
        systemImage: "chevron.up.2",
        detail: Text(
          "Max level reached", tableName: "Progress",
          comment: "Under the next level at the last level")
      )
    } else {
      StatTile(
        label: nextLevelLabel,
        value: bigQuantity(
          "\(level.bpToNextLevel.formatted()) \(String(localized: "Brain Power", table: "Progress", comment: "Brain Power, the points every lesson earns"))"
        ),
        systemImage: "chevron.up.2",
        meter: level.share
      )
    }
  }

  private var nextLevelLabel: Text {
    guard let next = level.nextBelt, level.level == 10 else {
      return Text(
        "To level \(level.level + 1)", tableName: "Progress",
        comment: "Tile: the Brain Power to the next level")
    }

    // Each belt its own sentence, so every language words it as it needs.
    switch next.belt {
    case .yellow:
      return Text(
        "To Yellow belt", tableName: "Progress", comment: "Tile: the Brain Power to the yellow belt"
      )
    case .orange:
      return Text(
        "To Orange belt", tableName: "Progress", comment: "Tile: the Brain Power to the orange belt"
      )
    case .green:
      return Text(
        "To Green belt", tableName: "Progress", comment: "Tile: the Brain Power to the green belt")
    case .blue:
      return Text(
        "To Blue belt", tableName: "Progress", comment: "Tile: the Brain Power to the blue belt")
    case .purple:
      return Text(
        "To Purple belt", tableName: "Progress", comment: "Tile: the Brain Power to the purple belt"
      )
    case .brown:
      return Text(
        "To Brown belt", tableName: "Progress", comment: "Tile: the Brain Power to the brown belt")
    case .red:
      return Text(
        "To Red belt", tableName: "Progress", comment: "Tile: the Brain Power to the red belt")
    case .gray:
      return Text(
        "To Gray belt", tableName: "Progress", comment: "Tile: the Brain Power to the gray belt")
    case .black:
      return Text(
        "To Black belt", tableName: "Progress", comment: "Tile: the Brain Power to the black belt")
    case .white:
      return Text(
        "To the next belt", tableName: "Progress", comment: "Tile: the Brain Power to the next belt"
      )
    }
  }
}

extension LevelProgress {
  /// From 0 to 1, full at the last level.
  var share: Double {
    isMaxLevel ? 1 : min(max(Double(progressInLevel) / Double(max(bpPerLevel, 1)), 0), 1)
  }
}

private struct BeltProgression: View {
  @Environment(\.horizontalSizeClass) private var sizeClass

  let level: LevelProgress

  /// White and black would wash the panel white or gray, so their panel stays neutral.
  private var isNeutral: Bool {
    level.belt == .white || level.belt == .black
  }

  var body: some View {
    StatsBlock(
      title: Text(
        "Belt progression", tableName: "Progress", comment: "Title of the belts on the Level page")
    ) {
      VStack(alignment: .leading, spacing: 16) {
        if sizeClass == .regular {
          HStack(alignment: .top, spacing: 24) {
            beltName
            Spacer(minLength: 0)
            NextBeltView(level: level, alignment: .trailing)
          }
          BeltDrawing(level: level, isWide: true)
            .padding(.leading, -24)
        } else {
          beltName
          BeltDrawing(level: level, isWide: false)
            .padding(.leading, -16)
          NextBeltView(level: level, alignment: .leading)
        }
      }
      .padding(sizeClass == .regular ? 24 : 16)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
          .fill(isNeutral ? Color(.tertiarySystemFill) : Color(.secondarySystemGroupedBackground))
          .overlay {
            if !isNeutral {
              RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(level.belt.color.opacity(0.1))
            }
          }
      }
      .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

      BeltRack(current: level.belt)
    }
  }

  private var beltName: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(level.belt.localizedTitle)
        .font(.title3.weight(.semibold))

      Text(
        "Level \(Text(level.level, format: .number).foregroundStyle(.primary).fontWeight(.medium)) of \(10)",
        tableName: "Progress",
        comment: "The learner's level within their belt, of the belt's 10 levels"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
    .accessibilityElement(children: .combine)
  }
}

private struct NextBeltView: View {
  let level: LevelProgress
  let alignment: HorizontalAlignment

  var body: some View {
    if let next = level.nextBelt {
      VStack(alignment: alignment, spacing: 4) {
        Text(
          "Next belt", tableName: "Progress", comment: "Label over the belt the learner earns next"
        )
        .font(.caption.weight(.medium))
        .textCase(.uppercase)
        .foregroundStyle(.secondary)

        HStack(spacing: 8) {
          BeltDot(belt: next.belt)

          Text(
            "\(Text(next.belt.localizedTitle)) at \(Text(next.startBrainPower, format: .number).monospacedDigit()) Brain Power",
            tableName: "Progress",
            comment: "The next belt and the total Brain Power where it starts")
        }
        .font(.subheadline.weight(.medium))

        Text(
          "\(next.brainPowerToGo) to go", tableName: "Progress",
          comment: "How much more Brain Power the next belt takes"
        )
        .font(.caption)
        .monospacedDigit()
        .foregroundStyle(.secondary)
      }
      .multilineTextAlignment(alignment == .trailing ? .trailing : .leading)
      .accessibilityElement(children: .combine)
    } else {
      Label {
        Text("Every belt earned", tableName: "Progress", comment: "Shown on Black, the last belt")
      } icon: {
        StatusMark(status: .done)
      }
      .font(.subheadline.weight(.medium))
    }
  }
}
