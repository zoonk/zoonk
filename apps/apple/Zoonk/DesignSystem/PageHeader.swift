import SwiftUI

/// Main's page header, as a page's first row: the page's title, at most one supporting line, and at
/// its end the page's main readout or its action. A page has nothing over its title (B1-038); a
/// task's step, card or result may take the one `Chip` there. The page keeps `navigationTitle`
/// through `barTitleAfterHero(_:)`, so Back, VoiceOver and the iPad and iPhone Duo bars name it,
/// and its bar shows the name only once this title scrolls under it.
struct PageHeader<Trailing: View>: View {
  let title: Text
  var chip: Chip?
  /// A step keeps its chip's room without one, so every step's title sits at one height.
  var keepsChipRoom = false
  var supporting: Text?
  @ViewBuilder let trailing: Trailing

  init(
    _ title: Text, chip: Chip? = nil, keepsChipRoom: Bool = false, supporting: Text? = nil,
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.title = title
    self.chip = chip
    self.keepsChipRoom = keepsChipRoom
    self.supporting = supporting
    self.trailing = trailing()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let chip {
        chip
          .padding(.bottom, 8)
      } else if keepsChipRoom {
        Chip(Text(verbatim: " "))
          .hidden()
          .accessibilityHidden(true)
          .padding(.bottom, 8)
      }

      AccessibilityStack(alignment: .lastTextBaseline, spacing: 12) {
        title
          .typeStyle(.pageTitle)
          .foregroundStyle(Color(.foreground))
          .accessibilityAddTraits(.isHeader)
          .heroTitle()
          .frame(maxWidth: .infinity, alignment: .leading)

        trailing
      }

      if let supporting {
        supporting
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)
      }
    }
    .padding(.bottom, 8)
    .listRowSeparator(.hidden)
  }
}

extension PageHeader where Trailing == EmptyView {
  init(_ title: Text, chip: Chip? = nil, keepsChipRoom: Bool = false, supporting: Text? = nil) {
    self.init(title, chip: chip, keepsChipRoom: keepsChipRoom, supporting: supporting) {
      EmptyView()
    }
  }
}
