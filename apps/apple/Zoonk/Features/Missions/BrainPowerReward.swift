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
        .font(.subheadline.weight(.semibold).monospacedDigit())
        .foregroundStyle(earned ? Color(.systemBackground) : .brain)
        .padding(.horizontal, earned ? 6 : 0)
        .padding(.vertical, earned ? 2 : 0)
        .background {
          if earned {
            Capsule().fill(.brain)
          }
        }

        Text("Brain Power", tableName: "Today", comment: "Under the missions' bonus")
          .font(.caption2)
          .foregroundStyle(.secondary)
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
          .font(.headline)

        Text(
          "What you've learned, in points: it raises your belt and grows your buddy. Answers, lessons and challenges add to it, and finishing today's missions adds +\(points).",
          tableName: "Today", comment: "What Brain Power is; the number is the missions' bonus"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }
      .padding()
      .frame(idealWidth: 280)
      .presentationCompactAdaptation(.popover)
    }
  }
}
