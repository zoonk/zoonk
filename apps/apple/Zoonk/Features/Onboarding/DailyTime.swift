import SwiftUI

/// Main's `DailyTimePicker`: the time a day, big, opening the times to pick, the suggested one
/// marked. Dimmed while it's `stale`, a suggestion still for the days before.
struct DailyTimeMenu: View {
  let minutes: Int
  let times: [Int]
  let suggested: Int?
  var stale = false
  let onPick: (Int) -> Void

  var body: some View {
    Menu {
      Picker(selection: Binding(get: { minutes }, set: onPick)) {
        ForEach(times, id: \.self) { time in
          Text(TimeAnswer.choiceLabel(time, suggested: suggested))
            .tag(time)
        }
      } label: {
        label
      }
    } label: {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        bigQuantity(planDurationText(minutes: Double(minutes)))
          .typeStyle(.momentReadout)
          .multilineTextAlignment(.leading)
        Image(systemName: "chevron.down")
          .typeStyle(.section)
          .foregroundStyle(.mutedForeground)
      }
      .foregroundStyle(stale ? .mutedForeground : .primary)
    }
    .accessibilityLabel(label)
    .accessibilityValue(planDurationText(minutes: Double(minutes)))
  }

  private var label: Text {
    Text("Time a day", tableName: "Onboarding", comment: "Label of the daily study time picker")
  }
}

/// The time a day with when it finishes beside it, two big numbers side by side, stacked once the
/// text is too big for both. The finish dims while a new one is worked out, and says itself when
/// it changes.
struct DailyTimeRow<Time: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  let finish: PlanForecast?
  var aim: String?
  var updating = false
  @ViewBuilder let time: Time

  var body: some View {
    let stacks = dynamicTypeSize.isAccessibilitySize
    let layout =
      stacks
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12))
      : AnyLayout(HStackLayout(alignment: .lastTextBaseline, spacing: 16))

    layout {
      time

      if let finish {
        let readout = FinishReadout(
          forecast: finish, aim: aim, alignment: stacks ? .leading : .trailing)

        readout
          .frame(maxWidth: .infinity, alignment: stacks ? .leading : .trailing)
          .opacity(updating ? 0.5 : 1)
          .announcesStatus(updating ? nil : readout.spoken)
      }
    }
  }
}
