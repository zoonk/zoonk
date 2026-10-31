import SwiftUI

/// Main's `useCitationLabel`: the page or slide of the learner's material, or its title when it
/// has no pages.
enum CitationLabel {
  static func material(title: String, page: Int?, unit: String) -> String {
    guard let page else {
      return title
    }

    return unit == "slide"
      ? String(
        localized: "\(title), slide \(String(page))", table: "Citations",
        comment: "Where something comes from in the learner's material: a deck's slide")
      : String(
        localized: "\(title), page \(String(page))", table: "Citations",
        comment: "Where something comes from in the learner's material: a document's page")
  }
}

/// Main's `SourcesChip`: when a public document was last checked, opening its title, publisher
/// and link.
struct SourcesChip: View {
  let title: String
  let publisher: String?
  let url: String?
  let checkedAt: Date

  @State private var showsSource = false

  var body: some View {
    Button {
      showsSource = true
    } label: {
      Label {
        Text(
          "Sources · Checked \(checkedAt.formatted(.dateTime.month(.abbreviated).year()))",
          tableName: "Citations",
          comment:
            "Opens a source. \"Checked\" agrees with plural \"Sources\". Date like \"May 2026\".")
      } icon: {
        Image(systemName: "book")
      }
      .font(.footnote)
      .foregroundStyle(.secondary)
    }
    .buttonStyle(.bordered)
    .controlSize(.small)
    .popover(isPresented: $showsSource) {
      SourceDetails(title: title, publisher: publisher, url: url, checkedAt: checkedAt)
        .presentationCompactAdaptation(.popover)
    }
  }
}

private struct SourceDetails: View {
  let title: String
  let publisher: String?
  let url: String?
  let checkedAt: Date

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 12) {
        VStack(alignment: .leading, spacing: 4) {
          Text(title)
            .font(.headline)

          checked
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        if let url = url.flatMap(URL.init(string:)) {
          Link(destination: url) {
            Label {
              Text(
                "Open the source", tableName: "Citations",
                comment: "Opens the public source in the browser")
            } icon: {
              Image(systemName: "arrow.up.right.square")
            }
          }
          .font(.subheadline.weight(.medium))
        }
      }
      .padding()
      .frame(idealWidth: 320, alignment: .leading)
    }
    .scrollBounceBehavior(.basedOnSize)
  }

  private var checked: Text {
    let day = checkedAt.formatted(date: .abbreviated, time: .omitted)

    if let publisher, !publisher.isEmpty {
      return Text(
        "\(publisher) · Checked \(day)", tableName: "Citations",
        comment: "A source's publisher and when it was last checked. Date like \"May 5, 2026\".")
    }

    return Text(
      "Checked \(day)", tableName: "Citations",
      comment: "When a source was last checked. The date is a full date, like \"May 5, 2026\".")
  }
}
