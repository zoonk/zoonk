import SwiftUI

enum CatalogFailureContext {
  case catalog
  case chapter
  case course
}

struct CatalogFailureRecoveryView: View {
  let context: CatalogFailureContext
  let failure: CourseCatalogFailure
  let retry: @MainActor () async -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        title
      } icon: {
        Image(systemName: failure == .network ? "wifi.exclamationmark" : "exclamationmark.triangle")
      }
    } description: {
      description
    } actions: {
      Button {
        Task {
          await retry()
        }
      } label: {
        Text(
          "Try again",
          tableName: "Courses",
          comment: "Retries loading catalog content after a failure.")
      }
      .buttonStyle(.borderedProminent)
    }
    .frame(maxWidth: .infinity, minHeight: 360)
  }

  @ViewBuilder
  private var title: some View {
    if failure == .network {
      Text(
        "You're offline",
        tableName: "Courses",
        comment: "Title when catalog content cannot load because the device is offline.")
    } else {
      unavailableTitle
    }
  }

  @ViewBuilder
  private var unavailableTitle: some View {
    switch context {
    case .catalog:
      Text(
        "Courses are unavailable",
        tableName: "Courses",
        comment: "Title when the public course catalog cannot be loaded.")
    case .course:
      if failure == .notFound {
        Text(
          "Course not found",
          tableName: "Courses",
          comment: "Title when a course cannot be found.")
      } else {
        Text(
          "Course unavailable",
          tableName: "Courses",
          comment: "Title when a course cannot be loaded.")
      }
    case .chapter:
      if failure == .notFound {
        Text(
          "Chapter not found",
          tableName: "Courses",
          comment: "Title when a chapter cannot be found.")
      } else {
        Text(
          "Chapter unavailable",
          tableName: "Courses",
          comment: "Title when a chapter cannot be loaded.")
      }
    }
  }

  @ViewBuilder
  private var description: some View {
    if failure == .network {
      Text(
        "Check your connection and try again.",
        tableName: "Courses",
        comment: "Recovery guidance for an offline catalog request.")
    } else if failure == .notFound {
      Text(
        "This content may have moved or is no longer available.",
        tableName: "Courses",
        comment: "Guidance when a course or chapter cannot be found.")
    } else {
      Text(
        "Please try again in a moment.",
        tableName: "Courses",
        comment: "Recovery guidance when catalog content is temporarily unavailable.")
    }
  }
}
