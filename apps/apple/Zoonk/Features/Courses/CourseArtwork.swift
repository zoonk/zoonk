import SwiftUI

struct CourseArtwork: View {
  @Environment(\.privateImageLoader) private var privateImages
  @Environment(SessionStore.self) private var session: SessionStore?

  let imageURL: URL?
  var cornerRadius: CGFloat = 16
  var symbolTint: Color?
  var systemImage = "book.closed.fill"

  var body: some View {
    Group {
      if let imageURL, let privateImages, privateImages.requiresSession(imageURL) {
        PrivateArtworkImage(
          loader: privateImages,
          token: session?.authenticatedSession?.bearerToken,
          url: imageURL
        ) { phase in
          artwork(phase)
        }
      } else if let imageURL {
        AsyncImage(url: imageURL) { phase in
          switch phase {
          case .success(let image):
            artwork(.loaded(image))
          case .empty:
            artwork(.loading)
          case .failure:
            artwork(.failed)
          @unknown default:
            artwork(.failed)
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
        .font(.system(.largeTitle, design: .rounded, weight: .medium))
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

/// Loads a private picture with the learner's session, and shows the fallback when signed out.
private struct PrivateArtworkImage<Content: View>: View {
  @State private var phase = ArtworkPhase.loading

  let loader: PrivateImageLoader
  let token: String?
  let url: URL
  @ViewBuilder let content: (ArtworkPhase) -> Content

  var body: some View {
    content(phase)
      .task(id: PrivateArtworkRequest(token: token, url: url)) {
        await load()
      }
  }

  private func load() async {
    guard let token else {
      phase = .failed
      return
    }

    phase = .loading
    let image = await loader.image(for: url, token: token)

    guard !Task.isCancelled else {
      return
    }

    phase = image.map { .loaded(Image(uiImage: $0)) } ?? .failed
  }
}

private struct PrivateArtworkRequest: Equatable {
  let token: String?
  let url: URL
}

#Preview {
  CourseArtwork(imageURL: nil)
    .frame(width: 80)
    .padding()
}
