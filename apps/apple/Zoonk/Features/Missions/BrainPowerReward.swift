import SwiftUI

/// Main's `BrainPowerReward`: the day's missions bonus and Brain Power's short form, plain until
/// it's earned and then a solid chip. Tapping it says what Brain Power is.
struct BrainPowerReward: View {
  let points: Int
  let earned: Bool

  @Environment(AppRouter.self) private var router

  var body: some View {
    Button {
      router.open(.statistics(section: .level))
    } label: {
      HStack(spacing: 6) {
        Label {
          Text(points, format: .number.sign(strategy: .always()))
        } icon: {
          Image(systemName: earned ? "checkmark" : "brain")
        }
        .labelStyle(.titleAndIcon)
        .typeStyle(.small.weight(.semibold).monospaced())
        .foregroundStyle(earned ? Color(.background) : .brainText)
        .padding(.horizontal, earned ? 6 : 0)
        .padding(.vertical, 2)
        .background {
          // `brainText`, since the page's color on `brain` is under AA in light.
          if earned {
            Capsule().fill(.brainText)
          }
        }

        Text(
          "BP", tableName: "Today",
          comment:
            "Brain Power's short form after an amount, as in “+50 BP”. Use the short form the style guide gives."
        )
        .typeStyle(.small)
        .foregroundStyle(.mutedForeground)
      }
    }
    .buttonStyle(.plain)
    .help(Text("Brain Power", tableName: "Session", comment: "Beside the Brain Power a task earned"))
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
