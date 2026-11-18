import SwiftUI

/// Main's `CoverageBar`: what was studied, then what the learner already knew, on one track.
/// Shares are 0 to 1.
struct CoverageBar: View {
  let studied: Double
  var known = 0.0

  var body: some View {
    Canvas { context, size in
      let track = Path(
        roundedRect: CGRect(origin: .zero, size: size), cornerRadius: size.height / 2)
      let studiedShare = min(max(studied, 0), 1)
      let knownShare = min(max(known, 0), 1 - studiedShare)

      context.fill(track, with: .color(.surface3))
      context.clip(to: track)
      context.fill(
        Path(CGRect(x: 0, y: 0, width: size.width * studiedShare, height: size.height)),
        with: .color(.success))
      context.fill(
        Path(
          CGRect(
            x: size.width * studiedShare, y: 0, width: size.width * knownShare,
            height: size.height)),
        with: .color(.mutedForeground.opacity(0.7)))
    }
    .frame(height: 6)
    .accessibilityHidden(true)
  }
}

/// Main's `CoverageLegend`: a word for each part of a `CoverageBar`.
struct CoverageLegend: View {
  enum State {
    case studied
    case known
    case new
  }

  let states: [State]

  var body: some View {
    FlowLayout(spacing: 12, rowSpacing: 4) {
      ForEach(states, id: \.self) { state in
        HStack(spacing: 6) {
          mark(state)
            .frame(width: 6, height: 6)

          Text(label(state))
        }
      }
    }
    .typeStyle(.small)
    .foregroundStyle(.mutedForeground)
    .accessibilityHidden(true)
  }

  @ViewBuilder
  private func mark(_ state: State) -> some View {
    switch state {
    case .studied:
      Circle().fill(.success)
    case .known:
      Circle().fill(.mutedForeground.opacity(0.7))
    case .new:
      Circle().strokeBorder(.mutedForeground.opacity(0.7), lineWidth: 1)
    }
  }

  private func label(_ state: State) -> LocalizedStringResource {
    switch state {
    case .studied:
      LocalizedStringResource(
        "Studied", table: "DesignSystem", comment: "A coverage bar's key: lessons studied")
    case .known:
      LocalizedStringResource(
        "Already knew", table: "DesignSystem",
        comment: "A coverage bar's key: lessons the learner already knew")
    case .new:
      LocalizedStringResource(
        "New", table: "DesignSystem", comment: "A coverage bar's key: lessons not studied yet")
    }
  }
}
