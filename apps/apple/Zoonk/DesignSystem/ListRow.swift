import SwiftUI

/// Main's `ListRow`: a leading mark, a title over an optional description, and quiet data at its
/// end, which goes under the words once content stacks, as main's and Android's rows wrap it. It's
/// a row's content, so a `NavigationLink` or a `Button` around it keeps the row's chevron and press.
struct ListRow<Leading: View, Trailing: View>: View {
  let title: Text
  /// Main's `ListRowNumberedTitle`: a place in a list before the title, quiet and mono.
  var number: Int?
  var description: Text?
  var alignment = VerticalAlignment.center
  @ViewBuilder let leading: Leading
  @ViewBuilder let trailing: Trailing

  init(
    _ title: Text, number: Int? = nil, description: Text? = nil,
    alignment: VerticalAlignment = .center,
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
    RowLayout(alignment: alignment) {
      leading
        .foregroundStyle(.mutedForeground)
    } words: {
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        if let number {
          Text(verbatim: "\(number).")
            .layoutPart(.lead)
            .typeStyle(.data)
            .capitalsLevel(.data, with: .rowTitle)
            .foregroundStyle(.mutedForeground)
            .accessibilityHidden(true)
        }

        titleText
      }

      if let description {
        description
          .layoutPart(.note, text: description)
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    } value: {
      trailing
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
    }
  }

  @ViewBuilder private var titleText: some View {
    let text = title.layoutPart(.label, text: title).typeStyle(.rowTitle)
      .foregroundStyle(Color(.foreground))

    if let number {
      // One phrase, "3. Title", rather than the number and the title read apart.
      text.accessibilityLabel(Text("\(Text(verbatim: "\(number).")) \(title)"))
    } else {
      text
    }
  }
}

/// The one list row's layout, which `ListRow` and `IconLabeledContent` draw: a mark, the words and
/// a value at the end. Beside one line or a title and its description the mark centers on the
/// words (craft E5); the value centers on the row, level with the chevron the list draws after it
/// (E6). Once content stacks, the value goes under the words, on the title's edge (E1).
struct RowLayout<Mark: View, Words: View, Value: View>: View {
  @Environment(\.stacksContent) private var isStacked

  /// `.firstTextBaseline` puts the mark on the first of three lines or more.
  var alignment = VerticalAlignment.center
  @ViewBuilder let mark: Mark
  @ViewBuilder let words: Words
  @ViewBuilder let value: Value

  var body: some View {
    Group {
      if isStacked, Mark.self == EmptyView.self {
        column
      } else {
        HStack(spacing: 12) {
          MarkedRow(alignment: alignment, stackedSpacing: 4) {
            if Mark.self != EmptyView.self {
              mark
                .markColumn()
                .layoutPart(.mark)
            }
          } content: {
            column
          } end: {
          }

          if !isStacked {
            shownValue
          }
        }
      }
    }
    .layoutStacks(isStacked)
    .layoutRow(.listGroup)
  }

  private var column: some View {
    VStack(alignment: .leading, spacing: 1) {
      words

      if isStacked {
        shownValue
      }
    }
    // A list sized a stacked row beside a picture short at accessibility sizes and cut a line.
    .fixedSize(horizontal: false, vertical: true)
  }

  private var shownValue: some View {
    value
      .layoutPart(.value)
      .fixedSize()
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
