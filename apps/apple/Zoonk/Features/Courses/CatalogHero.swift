import SwiftUI

struct CatalogDetailHeaderConfiguration {
  let imageURL: URL?
  let description: String?
  let systemImage: String
  let title: String
}

struct CatalogDetailHeader: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let configuration: CatalogDetailHeaderConfiguration
  var showInformation: (() -> Void)?

  var body: some View {
    if dynamicTypeSize.isAccessibilitySize {
      accessibilityLayout
    } else {
      HStack(alignment: .top, spacing: horizontalSizeClass == .regular ? 20 : 12) {
        artwork
        textContent
      }
    }
  }

  private var artwork: some View {
    CourseArtwork(
      imageURL: configuration.imageURL,
      systemImage: configuration.systemImage
    )
    .frame(width: artworkSize, height: artworkSize)
  }

  private var artworkSize: CGFloat {
    horizontalSizeClass == .regular ? 112 : 80
  }

  private var accessibilityLayout: some View {
    VStack(alignment: .leading, spacing: 12) {
      CourseArtwork(
        imageURL: configuration.imageURL,
        systemImage: configuration.systemImage
      )
      .frame(width: 72, height: 72)

      interactiveTextContent
    }
  }

  private var textContent: some View {
    interactiveTextContent
      .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder
  private var interactiveTextContent: some View {
    if let showInformation {
      Button(action: showInformation) {
        textContentBody(showsDisclosureIndicator: true)
      }
      .buttonStyle(.plain)
      .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
      .contentShape(Rectangle())
      .accessibilityAddTraits(.isHeader)
      .accessibilityHint(
        Text(
          "Shows more information",
          tableName: "Courses",
          comment: "Accessibility hint for expandable course or chapter information."))
    } else {
      textContentBody(showsDisclosureIndicator: false)
    }
  }

  private func textContentBody(showsDisclosureIndicator: Bool) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(configuration.title)
          .font(horizontalSizeClass == .regular ? .title.bold() : .title2.bold())
          .fixedSize(horizontal: false, vertical: true)

        if showsDisclosureIndicator {
          Spacer(minLength: 8)

          Image(systemName: "chevron.right")
            .font(.caption.weight(.semibold))
            .foregroundStyle(.tertiary)
            .accessibilityHidden(true)
        }
      }

      description
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder
  private var description: some View {
    if let description = catalogText(configuration.description) {
      descriptionText(description)
    }
  }

  private func descriptionText(_ description: String) -> some View {
    Text(description)
      .font(.subheadline)
      .foregroundStyle(.secondary)
      .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 3)
      .fixedSize(horizontal: false, vertical: true)
      .frame(maxWidth: .infinity, alignment: .leading)
      .contentShape(Rectangle())
  }
}
