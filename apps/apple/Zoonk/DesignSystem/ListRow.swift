import SwiftUI

/// Main's `ListRow`: a leading mark, a title over an optional description, and quiet data at its
/// end, which goes under the words once content stacks, as main's and Android's rows wrap it. It's
/// a row's content, so a `NavigationLink` or a `Button` around it keeps the row's chevron and press.
struct ListRow<Leading: View, Trailing: View>: View {
  @Environment(\.stacksContent) private var isStacked
  let title: Text
  /// Main's `ListRowNumberedTitle`: a place in a list before the title, quiet and mono.
  var number: Int?
  var description: Text?
  /// `.center` beside a mark taller than its words, such as a certificate's picture.
  var alignment = VerticalAlignment.firstTextBaseline
  @ViewBuilder let leading: Leading
  @ViewBuilder let trailing: Trailing

  /// Marks differ in width, so titles start in one column.
  @ScaledMetric(relativeTo: .subheadline) private var markWidth = 20.0

  init(
    _ title: Text, number: Int? = nil, description: Text? = nil,
    alignment: VerticalAlignment = .firstTextBaseline,
    @ViewBuilder leading: () -> Leading, @ViewBuilder trailing: () -> Trailing
  ) {
    self.title = title
    self.number = number
    self.description = description
    self.alignment = alignment
    self.leading = leading()
    self.trailing = trailing()
  }

  var body: some View {
    if isStacked, Leading.self == EmptyView.self {
      words
    } else {
      MarkedRow(alignment: alignment, stackedSpacing: 4) {
        if Leading.self != EmptyView.self {
          leading
            .foregroundStyle(.mutedForeground)
            .frame(minWidth: markWidth)
        }
      } content: {
        words
      } end: {
        if !isStacked {
          value
        }
      }
    }
  }

  private var words: some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        if let number {
          Text(verbatim: "\(number).")
            .typeStyle(.data)
            .foregroundStyle(.mutedForeground)
            .accessibilityHidden(true)
        }

        titleText
      }

      if let description {
        description
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }

      if isStacked {
        value
      }
    }
  }

  private var value: some View {
    trailing
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)
  }

  @ViewBuilder private var titleText: some View {
    let text = title.typeStyle(.rowTitle).foregroundStyle(Color(.foreground))

    if let number {
      // One phrase, "3. Title", rather than the number and the title read apart.
      text.accessibilityLabel(Text("\(Text(verbatim: "\(number).")) \(title)"))
    } else {
      text
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
