import SwiftUI

struct CourseArtwork: View {
  @Environment(\.imageLoader) private var images
  @Environment(SessionStore.self) private var session: SessionStore?

  let imageURL: URL?
  var cornerRadius: CGFloat = 16
  var symbolTint: Color?
  var systemImage = "book.closed.fill"

  var body: some View {
    Group {
      if let imageURL, let images {
        ArtworkImage(
          loader: images,
          token: session?.authenticatedSession?.bearerToken,
          url: imageURL
        ) { phase in
          artwork(phase)
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

  @ViewBuilder
  private func artwork(_ phase: ArtworkPhase) -> some View {
    switch phase {
    case .loaded(let image):
      image
        .resizable()
        .scaledToFill()
    case .loading:
      fallback.redacted(reason: .placeholder)
    case .failed:
      fallback
    }
  }

  private var fallback: some View {
    ZStack {
      fallbackBackground

      Image(systemName: systemImage)
        .font(.largeTitle.weight(.medium))
        .symbolRenderingMode(.hierarchical)
        .foregroundStyle(fallbackForeground)
    }
  }

  private var fallbackBackground: Color {
    symbolTint?.opacity(0.12) ?? Color(uiColor: .tertiarySystemFill)
  }

  private var fallbackForeground: Color {
    symbolTint?.mix(with: .primary, by: 0.35) ?? Color(uiColor: .secondaryLabel)
  }
}

private enum ArtworkPhase {
  case failed
  case loaded(Image)
  case loading
}

private struct ArtworkImage<Content: View>: View {
  @State private var phase = ArtworkPhase.loading

  let loader: ImageLoader
  let token: String?
  let url: URL
  @ViewBuilder let content: (ArtworkPhase) -> Content

  var body: some View {
    // A picture already in memory shows in the first frame, before the task runs.
    content(loader.cachedImage(for: url, token: token).map { .loaded(Image(uiImage: $0)) } ?? phase)
      .task(id: ArtworkRequest(token: token, url: url)) {
        await load()
      }
  }

  private func load() async {
    phase = .loading
    let image = await loader.image(for: url, token: token)

    guard !Task.isCancelled else {
      return
    }

    phase = image.map { .loaded(Image(uiImage: $0)) } ?? .failed
  }
}

private struct ArtworkRequest: Equatable {
  let token: String?
  let url: URL
}

#Preview {
  CourseArtwork(imageURL: nil)
    .frame(width: 80)
    .padding()
}
