import SwiftUI

/// Every `DisclosureGroup` ends its label with the app's `DisclosureChevron`, pointing down while
/// open, where the system's draws its own in the ink tint, heavier than a `NavigationLink` row's.
/// What it opens follows indented, as the system's does; in a list, as rows of their own.
struct FoldDisclosureGroupStyle: DisclosureGroupStyle {
  func makeBody(configuration: Configuration) -> some View {
    Fold(configuration: configuration)
  }
}

extension DisclosureGroupStyle where Self == FoldDisclosureGroupStyle {
  static var fold: Self { Self() }
}

private struct Fold: View {
  let configuration: DisclosureGroupStyleConfiguration

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @ScaledMetric private var indent = 20

  var body: some View {
    Button {
      withAnimation(reduceMotion ? nil : .default) {
        configuration.isExpanded.toggle()
      }
    } label: {
      HStack(spacing: 12) {
        configuration.label
          .frame(maxWidth: .infinity, alignment: .leading)

        DisclosureChevron(pointsDown: configuration.isExpanded)
      }
      .contentShape(.rect)
    }
    .accessibilityValue(
      configuration.isExpanded
        ? Text("Expanded", tableName: "DesignSystem", comment: "VoiceOver: a fold that is open")
        : Text("Collapsed", tableName: "DesignSystem", comment: "VoiceOver: a fold that is closed"))

    if configuration.isExpanded {
      configuration.content
        .padding(.leading, indent)
    }
  }
}
