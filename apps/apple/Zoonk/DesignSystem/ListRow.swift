import SwiftUI

/// Main's `ListRow`: a leading mark, a title over an optional description, and quiet data at its
/// end. It's a row's content, so a `NavigationLink` or a `Button` around it keeps the row's chevron
/// and press.
struct ListRow<Leading: View, Trailing: View>: View {
  let title: Text
  var description: Text?
  @ViewBuilder let leading: Leading
  @ViewBuilder let trailing: Trailing

  /// Marks differ in width, so titles start in one column.
  @ScaledMetric(relativeTo: .subheadline) private var markWidth = 20.0

  init(
    _ title: Text, description: Text? = nil, @ViewBuilder leading: () -> Leading,
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.title = title
    self.description = description
    self.leading = leading()
    self.trailing = trailing()
  }

  var body: some View {
    MarkedRow(stackedSpacing: 4) {
      if Leading.self != EmptyView.self {
        leading
          .foregroundStyle(.mutedForeground)
          .frame(minWidth: markWidth)
      }
    } content: {
      VStack(alignment: .leading, spacing: 1) {
        title
          .font(.subheadline.weight(.medium))
          .foregroundStyle(Color(.foreground))

        if let description {
          description
            .font(.caption)
            .foregroundStyle(.mutedForeground)
        }
      }
    } end: {
      trailing
        .font(.caption.monospacedDigit())
        .foregroundStyle(.mutedForeground)
    }
  }
}

extension ListRow where Trailing == EmptyView {
  init(_ title: Text, description: Text? = nil, @ViewBuilder leading: () -> Leading) {
    self.init(title, description: description, leading: leading) { EmptyView() }
  }
}

extension ListRow where Leading == EmptyView, Trailing == EmptyView {
  init(_ title: Text, description: Text? = nil) {
    self.init(title, description: description) {
      EmptyView()
    } trailing: {
      EmptyView()
    }
  }
}
