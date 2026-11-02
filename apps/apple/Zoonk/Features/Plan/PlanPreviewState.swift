import Foundation

/// Main's `resolvePlanPreview`: a plan still being built, or a change without its effect, failed to
/// preview; only `unchanged` says the plan stays as it is.
enum PlanPreviewState: Equatable {
  case changes(PlanChangePreview)
  case checking
  case failed
  case unchanged

  init(_ preview: PlanChangePreview?) {
    guard let preview, preview.ready else {
      self = .failed
      return
    }

    if preview.unchanged {
      self = .unchanged
    } else if preview.effect == nil {
      self = .failed
    } else {
      self = .changes(preview)
    }
  }

  var canSave: Bool {
    switch self {
    case .changes, .unchanged: true
    case .checking, .failed: false
    }
  }
}
