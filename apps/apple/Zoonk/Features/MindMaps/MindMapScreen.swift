import SwiftUI
import UIKit

/// A chapter's mind map full screen: its picture to pinch, double-tap and drag (the system's zoom),
/// or its outline in words when it has no picture. Closing returns to where it opened.
struct MindMapScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store
  @State private var showsOutline = false

  let chapterId: String

  var body: some View {
    NavigationStack {
      Group {
        if let goal = learner.summary.value?.shownGoal {
          let map = store.map(goalId: goal.id, chapterId: chapterId)

          content(map)
            .navigationTitle(map.value.map { Text($0.title) } ?? Text(verbatim: ""))
            .loads(map, refreshable: false)
        }
      }
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            dismiss()
          } label: {
            Label {
              Text("Close", tableName: "MindMaps", comment: "Closes the full-screen mind map")
            } icon: {
              Image(systemName: "xmark")
            }
          }
        }
      }
    }
  }

  @ViewBuilder
  private func content(_ map: Resource<ChapterMindMap>) -> some View {
    switch map.state {
    case .loaded(let value):
      if let image = value.image, let url = URL(string: image.url), !showsOutline {
        ZoomableRemoteImage(url: url, title: value.title)
          .ignoresSafeArea(edges: .bottom)
          .toolbar {
            if value.outline != nil {
              ToolbarItem(placement: .primaryAction) {
                Button {
                  showsOutline = true
                } label: {
                  Label {
                    Text(
                      "As text", tableName: "MindMaps", comment: "Shows the map's outline in words")
                  } icon: {
                    Image(systemName: "text.alignleft")
                  }
                }
              }
            }
          }
      } else if let outline = value.outline {
        MindMapOutlineView(outline: outline)
      } else {
        ContentUnavailableView {
          Label {
            Text(
              "The mind map couldn't be made this time.", tableName: "MindMaps",
              comment: "Shown when a chapter has no map to show")
          } icon: {
            KindMark(kind: .mindMap)
          }
        }
      }
    case .failed, .empty:
      ContentUnavailableView {
        Label {
          Text(
            "We couldn't reach the server.", tableName: "MindMaps",
            comment: "A map that failed to load")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await map.refresh() }
        } label: {
          Text("Try again", tableName: "MindMaps", comment: "Retries")
        }
        .buttonStyle(.bordered)
      }
    case .idle, .loading:
      ProgressView()
    }
  }
}

/// The map in words: its central idea, then each branch with its points.
private struct MindMapOutlineView: View {
  let outline: ChapterMindMap.Outline

  var body: some View {
    List {
      Section {
        Text(outline.centralIdea)
          .font(.headline)

        if let summary = outline.summary, !summary.isEmpty {
          Text("In short: \(summary)", tableName: "MindMaps", comment: "The map's summary")
            .foregroundStyle(.secondary)
        }
      }

      ForEach(outline.branches, id: \.self) { branch in
        Section {
          Text(branch.explanation)

          ForEach(branch.points, id: \.self) { point in
            HStack(alignment: .firstTextBaseline, spacing: 8) {
              Image(systemName: "circle.fill")
                .font(.system(.caption2))
                .imageScale(.small)
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
              Text(point)
            }
            .font(.subheadline)
          }
        } header: {
          Text(branch.title)
        }
      }
    }
  }
}

/// A scroll view that tells when it lays out, so its picture fits the space it finally has.
final class FittingScrollView: UIScrollView {
  var onLayout: ((UIScrollView) -> Void)?

  override func layoutSubviews() {
    super.layoutSubviews()
    onLayout?(self)
  }
}

/// A picture the system zooms: pinch, double-tap and drag in a `UIScrollView`, fitted to the screen
/// at first. VoiceOver reads the map's title.
private struct ZoomableRemoteImage: View {
  @State private var image: UIImage?
  @State private var failed = false

  let url: URL
  let title: String

  var body: some View {
    Group {
      if let image {
        ZoomableImage(image: image)
          .accessibilityElement()
          .accessibilityLabel(
            Text(
              "Mind map of \(title)", tableName: "MindMaps",
              comment: "Spoken label of a map's picture")
          )
          .accessibilityAddTraits(.isImage)
      } else if failed {
        ContentUnavailableView {
          Label {
            Text(
              "We couldn't reach the server.", tableName: "MindMaps",
              comment: "A map that failed to load")
          } icon: {
            Image(systemName: "wifi.exclamationmark")
          }
        }
      } else {
        ProgressView()
      }
    }
    .task(id: url) {
      do {
        let (data, _) = try await URLSession.shared.data(from: url)
        image = UIImage(data: data)
        failed = image == nil
      } catch {
        failed = !(error is CancellationError)
      }
    }
  }
}

private struct ZoomableImage: UIViewRepresentable {
  let image: UIImage

  func makeUIView(context: Context) -> FittingScrollView {
    let scrollView = FittingScrollView()
    scrollView.delegate = context.coordinator
    scrollView.showsHorizontalScrollIndicator = false
    scrollView.showsVerticalScrollIndicator = false
    scrollView.contentInsetAdjustmentBehavior = .never
    scrollView.backgroundColor = .systemBackground

    let imageView = UIImageView(image: image)
    imageView.contentMode = .scaleAspectFit
    scrollView.addSubview(imageView)
    context.coordinator.imageView = imageView

    // The size is only known once the view lays out, and it changes with rotation, unfolding and
    // window resizing.
    scrollView.onLayout = { [weak coordinator = context.coordinator] scrollView in
      coordinator?.fit(in: scrollView)
    }

    let doubleTap = UITapGestureRecognizer(
      target: context.coordinator, action: #selector(Coordinator.toggleZoom(_:)))
    doubleTap.numberOfTapsRequired = 2
    scrollView.addGestureRecognizer(doubleTap)
    return scrollView
  }

  /// A ready map's picture may be redrawn once; the new one fits the space again.
  func updateUIView(_ scrollView: FittingScrollView, context: Context) {
    guard let imageView = context.coordinator.imageView, imageView.image !== image else {
      return
    }

    imageView.image = image
    context.coordinator.refit(in: scrollView)
  }

  func makeCoordinator() -> Coordinator {
    Coordinator()
  }

  @MainActor
  final class Coordinator: NSObject, UIScrollViewDelegate {
    weak var imageView: UIImageView?
    private var fittedSize: CGSize = .zero

    func viewForZooming(in scrollView: UIScrollView) -> UIView? {
      imageView
    }

    func scrollViewDidZoom(_ scrollView: UIScrollView) {
      center(in: scrollView)
    }

    /// Fits a new picture, whatever the learner's zoom on the last one.
    func refit(in scrollView: UIScrollView) {
      fittedSize = .zero
      fit(in: scrollView)
    }

    /// Fits the picture to the space the first time and whenever the space changes (rotation,
    /// unfolding, a resized window), keeping the learner's zoom otherwise.
    func fit(in scrollView: UIScrollView) {
      guard let imageView, let image = imageView.image, scrollView.bounds.size != fittedSize,
        scrollView.bounds.width > 0, image.size.width > 0
      else {
        return
      }

      fittedSize = scrollView.bounds.size
      let scale = min(
        scrollView.bounds.width / image.size.width, scrollView.bounds.height / image.size.height)
      scrollView.zoomScale = 1
      imageView.frame = CGRect(
        origin: .zero,
        size: CGSize(width: image.size.width * scale, height: image.size.height * scale))
      scrollView.contentSize = imageView.frame.size
      scrollView.minimumZoomScale = 1
      scrollView.maximumZoomScale = max(4, 1 / scale)
      center(in: scrollView)
    }

    @objc func toggleZoom(_ gesture: UITapGestureRecognizer) {
      guard let scrollView = gesture.view as? UIScrollView else {
        return
      }

      if scrollView.zoomScale > scrollView.minimumZoomScale {
        scrollView.setZoomScale(scrollView.minimumZoomScale, animated: true)
      } else {
        let point = gesture.location(in: imageView)
        let scale = min(scrollView.maximumZoomScale, 3)
        let size = CGSize(
          width: scrollView.bounds.width / scale, height: scrollView.bounds.height / scale)
        scrollView.zoom(
          to: CGRect(
            origin: CGPoint(x: point.x - size.width / 2, y: point.y - size.height / 2), size: size),
          animated: true)
      }
    }

    private func center(in scrollView: UIScrollView) {
      let horizontal = max(0, (scrollView.bounds.width - scrollView.contentSize.width) / 2)
      let vertical = max(0, (scrollView.bounds.height - scrollView.contentSize.height) / 2)
      scrollView.contentInset = UIEdgeInsets(
        top: vertical, left: horizontal, bottom: vertical, right: horizontal)
    }
  }
}
