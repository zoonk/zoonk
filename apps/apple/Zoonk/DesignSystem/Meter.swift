import SwiftUI

/// Main's `Meter`: one share of something on the `surface-3` track, 6pt tall in a page and 4pt in
/// a task's header. A spinner stays a `ProgressView()`; parts of a whole are `MeterParts`. Still a
/// `ProgressView` underneath, so VoiceOver reads it as one.
struct Meter: View {
  let value: Double
  var total = 1.0
  var fill = Color.success
  var height = 6.0

  var body: some View {
    ProgressView(value: min(max(value, 0), total), total: total)
      .progressViewStyle(MeterStyle(fill: fill, height: height))
  }
}

private struct MeterStyle: ProgressViewStyle {
  let fill: Color
  let height: Double

  func makeBody(configuration: Configuration) -> some View {
    let shape = RoundedRectangle(cornerRadius: height / 2, style: .continuous)

    shape
      .fill(.surface3)
      .overlay(alignment: .leading) {
        GeometryReader { proxy in
          shape
            .fill(fill)
            .frame(width: proxy.size.width * (configuration.fractionCompleted ?? 0))
        }
      }
      .frame(height: height)
  }
}
