import SwiftUI

/// Main's page header, as a page's first row: a mono eyebrow, the page's title, at most one
/// supporting line, and at its end the page's main readout or its action. The page keeps
/// `navigationTitle` for Back, VoiceOver and the iPad and iPhone Duo bars, and takes
/// `barTitleAfterHero(_:)`, so its bar shows the name only once this title scrolls under it.
struct PageHeader<Trailing: View>: View {
  var eyebrow: Text?
  private var isEyebrowAsWritten = false
  let title: Text
  var supporting: Text?
  @ViewBuilder let trailing: Trailing

  init(
    _ title: Text, eyebrow: Text? = nil, supporting: Text? = nil,
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.title = title
    self.eyebrow = eyebrow
    self.supporting = supporting
    self.trailing = trailing()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let eyebrow {
        eyebrow
          .typeStyle(isEyebrowAsWritten ? .eyebrow.asWritten() : .eyebrow)
          .foregroundStyle(.faint)
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

extension PageHeader {
  /// Main's `normal-case` eyebrow: a count such as "2 certificates" keeps its case.
  func eyebrowAsWritten() -> Self {
    var header = self
    header.isEyebrowAsWritten = true
    return header
  }
}

extension PageHeader where Trailing == EmptyView {
  init(_ title: Text, eyebrow: Text? = nil, supporting: Text? = nil) {
    self.init(title, eyebrow: eyebrow, supporting: supporting) { EmptyView() }
  }
}
