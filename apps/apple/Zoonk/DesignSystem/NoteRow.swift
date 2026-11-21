import SwiftUI

/// Main's note row (`ListRow role="note"` with `ListRowLeading firstLine`): an icon on its title's
/// first line and the lines that explain it under the title, such as a mock result's insight or how
/// an exam is scored.
struct NoteRow<Lines: View>: View {
  let title: Text
  let systemImage: String
  @ViewBuilder let lines: Lines

  init(_ title: Text, systemImage: String, @ViewBuilder lines: () -> Lines) {
    self.title = title
    self.systemImage = systemImage
    self.lines = lines()
  }

  var body: some View {
    RowLayout(alignment: .firstTextBaseline) {
      Image(systemName: systemImage)
        .foregroundStyle(.mutedForeground)
        .accessibilityHidden(true)
    } words: {
      VStack(alignment: .leading, spacing: 4) {
        title
          .layoutPart(.label, text: title)
          .typeStyle(.body.weight(.semibold))
        lines
          .foregroundStyle(.mutedForeground)
      }
    } value: {
      EmptyView()
    }
  }
}
