import SwiftUI

/// Every `DisclosureGroup` ends its label with the app's fold `DisclosureChevron`, down and turned
/// up while open, where the system's points forward in the ink tint, heavier than a
/// `NavigationLink` row's.
/// What it opens follows indented, as the system's does; in a list, as rows of their own.
struct FoldDisclosureGroupStyle: DisclosureGroupStyle {
  var opensUnderLabel = false

  func makeBody(configuration: Configuration) -> some View {
    Fold(configuration: configuration, opensUnderLabel: opensUnderLabel)
  }
}

extension DisclosureGroupStyle where Self == FoldDisclosureGroupStyle {
  static var fold: Self { Self() }

  /// For a row with a mark that holds rows with marks, as main's path holds a phase's chapters:
  /// what it opens starts its marks where the row's words start.
  static var foldUnderLabel: Self { Self(opensUnderLabel: true) }
}

private struct Fold: View {
  let configuration: DisclosureGroupStyleConfiguration
  let opensUnderLabel: Bool

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.rowIndent) private var rowIndent
  @ScaledMetric private var indent = 20
  @ScaledMetric(relativeTo: .body) private var markWidth = MarkColumnMetrics.width

  private var contentIndent: CGFloat {
    opensUnderLabel ? markWidth + MarkColumnMetrics.gap : indent
  }

  var body: some View {
    Button {
      withAnimation(reduceMotion ? nil : .default) {
        configuration.isExpanded.toggle()
      }
    } label: {
      HStack(spacing: 12) {
        configuration.label
          .environment(\.rowHasChevron, true)
          .frame(maxWidth: .infinity, alignment: .leading)

        DisclosureChevron(foldIsOpen: configuration.isExpanded)
      }
      .contentShape(.rect)
    }
    .accessibilityValue(
      configuration.isExpanded
        ? Text("Expanded", tableName: "DesignSystem", comment: "VoiceOver: a fold that is open")
        : Text("Collapsed", tableName: "DesignSystem", comment: "VoiceOver: a fold that is closed"))

    if configuration.isExpanded {
      // A style's content gets the system's style back, so a fold inside one keeps this one.
      configuration.content
        .disclosureGroupStyle(.fold)
        .padding(.leading, contentIndent)
        .environment(\.rowIndent, rowIndent + contentIndent)
        .layoutNest()
    }
  }
}
