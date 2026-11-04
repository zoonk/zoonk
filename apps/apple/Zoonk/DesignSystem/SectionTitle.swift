import SwiftUI

/// Main's `PageSectionTitle` as a `Section`'s header: names a block of the page in ink, with a
/// quiet detail or a small action at its end that goes under it when content stacks.
struct SectionTitle<Trailing: View>: View {
  let title: Text
  var alignment: VerticalAlignment = .firstTextBaseline
  @ViewBuilder let trailing: Trailing

  init(
    _ title: Text, alignment: VerticalAlignment = .firstTextBaseline,
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.title = title
    self.alignment = alignment
    self.trailing = trailing()
  }

  var body: some View {
    AccessibilityStack(alignment: alignment) {
      title
        .sectionTitleStyle()
        .frame(maxWidth: .infinity, alignment: .leading)

      trailing
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
    }
    .textCase(nil)
  }
}

extension View {
  /// `SectionTitle`'s look for a header that isn't one text, such as a `Label` with its icon.
  func sectionTitleStyle() -> some View {
    typeStyle(.sectionTitle)
      .foregroundStyle(Color(.foreground))
      .textCase(nil)
  }
}

extension SectionTitle where Trailing == EmptyView {
  init(_ title: Text) {
    self.init(title) { EmptyView() }
  }
}

/// Main's `PageSectionFooter` as a `Section`'s footer: the system's would draw it in a gray under
/// AA on white.
struct SectionFooter<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    content
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
      // A plain list draws a footer like a row, between hairlines main doesn't have.
      .listRowSeparator(.hidden)
  }
}
