import SwiftUI

/// Main's `BrainPowerReward`: the day's missions bonus, outlined until it's earned and then solid.
/// Tapping it says what Brain Power is.
struct BrainPowerReward: View {
  let points: Int
  let earned: Bool

  @State private var explains = false

  var body: some View {
    Button {
      explains = true
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
        .padding(.horizontal, earned ? 6 : 0)
        .padding(.vertical, earned ? 2 : 0)
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
    .popover(isPresented: $explains) {
      VStack(alignment: .leading, spacing: 8) {
        Text("Brain Power", tableName: "Today", comment: "Title of what Brain Power is")
          .typeStyle(.body.weight(.semibold))

        Text(
          "Points for what you learn. They raise your belt and grow your buddy.",
          tableName: "Today", comment: "What Brain Power is"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
      .padding()
      .frame(idealWidth: 280)
      .presentationCompactAdaptation(.popover)
      .zoonkStyles()
    }
  }
}

/// What a task's end earned, under its title: "+12 Brain Power". The first time a learner earns it
/// on this device, one line says what it is (B2's R3); after that the number stands alone.
struct EarnedBrainPower: View {
  let points: Int

  /// Decided when the moment opens, so it never leaves a moment it was drawn on.
  @State private var introduces = UserDefaults.standard.integer(forKey: Self.introKey) < 1

  private static let introKey = "brain-power-intro"

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
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

      if introduces {
        Text(
          "Points for what you learn.", tableName: "Session",
          comment: "Under a learner's first Brain Power on a device: what it is"
        )
        .typeStyle(.body)
        .foregroundStyle(.mutedForeground)
      }
    }
    .onAppear {
      if introduces {
        UserDefaults.standard.set(1, forKey: Self.introKey)
      }
    }
  }
}
