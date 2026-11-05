import SwiftUI
import UIKit

final class FittingScrollView: UIScrollView {
  var onLayout: ((UIScrollView) -> Void)?

  override func layoutSubviews() {
    super.layoutSubviews()
    onLayout?(self)
  }
}

struct ZoomableImage: UIViewRepresentable {
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

  /// A picture replaced, such as a mind map drawn again, fits the space again.
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

    func refit(in scrollView: UIScrollView) {
      fittedSize = .zero
      fit(in: scrollView)
    }

    /// Keeps the learner's zoom unless the space changed.
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
