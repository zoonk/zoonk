import SwiftUI

struct CourseArtwork: View {
  let imageURL: URL?
  var cornerRadius: CGFloat = 16
  var systemImage = "book.closed.fill"

  var body: some View {
    Group {
      if let imageURL {
        AsyncImage(url: imageURL) { phase in
          switch phase {
          case .success(let image):
            image
              .resizable()
              .scaledToFill()
          case .empty:
            fallback.redacted(reason: .placeholder)
          case .failure:
            fallback
          @unknown default:
            fallback
          }
        }
      } else {
        fallback
      }
    }
    .aspectRatio(1, contentMode: .fit)
    .background(Color(uiColor: .secondarySystemGroupedBackground))
    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    .contentShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    .accessibilityHidden(true)
  }

  private var fallback: some View {
    ZStack {
      Color(uiColor: .tertiarySystemFill)

      Image(systemName: systemImage)
        .font(.system(.largeTitle, design: .rounded, weight: .medium))
        .symbolRenderingMode(.hierarchical)
        .foregroundStyle(.secondary)
    }
  }
}

#Preview {
  CourseArtwork(imageURL: nil)
    .frame(width: 80)
    .padding()
}
