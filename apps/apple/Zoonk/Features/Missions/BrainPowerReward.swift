import SwiftUI

/// Main's `BrainPowerReward`: the day's missions bonus, outlined until it's earned and then solid.
/// Tapping it says what Brain Power is.
struct BrainPowerReward: View {
  let points: Int
  let earned: Bool

  @Environment(AppRouter.self) private var router

  var body: some View {
    Button {
      router.open(.statistics(section: .level))
    } label: {
      VStack(alignment: .trailing, spacing: 2) {
        Label {
          Text(points, format: .number.sign(strategy: .always()))
        } icon: {
          Image(systemName: earned ? "checkmark" : "brain")
        }
        .labelStyle(.titleAndIcon)
        .typeStyle(.body.weight(.semibold).monospaced())
        .foregroundStyle(earned ? Color(.background) : .brainText)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background {
          // `brainText`, since the page's color on `brain` is under AA in light.
          if earned {
            Capsule().fill(.brainText)
          }
        }

        Text("Brain Power", tableName: "Today", comment: "Under the missions' bonus")
          .typeStyle(.small)
          .foregroundStyle(.mutedForeground)
      }
    }
    .buttonStyle(.plain)
    .accessibilityLabel(
      earned
        ? Text(
          "\(points) Brain Power earned for today's missions", tableName: "Today",
          comment: "The missions' bonus, earned")
        : Text(
          "\(points) Brain Power for finishing them", tableName: "Today",
          comment: "The missions' reward")
    )

  }
}

/// What a task's end earned, under its title: "+12 Brain Power".
struct EarnedBrainPower: View {
  let points: Int

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 0) {
      EarnedNumber(value: points)
        .typeStyle(.readout)
        .foregroundStyle(.brainText)
        .padding(.trailing, 0.1 * 24)

      Text("Brain Power", tableName: "Session", comment: "Beside the Brain Power a task earned")
        .typeStyle(.body)
        .foregroundStyle(.mutedForeground)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      Text(
        "+\(points) Brain Power", tableName: "Session",
        comment: "Spoken: the Brain Power a task earned"))
  }
}
