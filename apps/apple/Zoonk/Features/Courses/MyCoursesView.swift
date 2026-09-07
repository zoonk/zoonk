import SwiftUI

struct MyCoursesView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(MyCoursesStore.self) private var myCourses
  @Environment(SessionStore.self) private var session

  var isSelected = true
  var query = ""
  let onCreateCourse: () -> Void
  let onSignIn: () -> Void

  var body: some View {
    Group {
      switch session.state {
      case .restoring:
        loadingCourses
      case .signedOut:
        MyCoursesSignInView(onSignIn: onSignIn)
      case .signedIn:
        signedInCourses
      case .unavailable:
        MyCoursesAccountUnavailableView()
      }
    }
    .contentMargins(.top, 16, for: .scrollContent)
    .task(id: session.authenticatedSession) {
      guard isSelected else { return }
      await myCourses.loadCoursesIfNeeded(query: query)
    }
    .task(id: isSelected ? query : nil) {
      guard isSelected else { return }
      if catalogText(query) != nil {
        do {
          try await Task.sleep(for: .milliseconds(250))
        } catch {
          return
        }
      }
      guard !Task.isCancelled else { return }
      await myCourses.loadCoursesIfNeeded(query: query)
    }
  }

  private var loadingCourses: some View {
    ScrollView {
      CourseCatalogLoadingGrid()
        .frame(maxWidth: 1_180, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.bottom, horizontalSizeClass == .regular ? 32 : 20)
        .frame(maxWidth: .infinity)
    }
    .scrollBounceBehavior(.basedOnSize)
  }

  private var signedInCourses: some View {
    ScrollView {
      signedInContent
        .frame(maxWidth: 1_180, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.bottom, horizontalSizeClass == .regular ? 32 : 20)
        .frame(maxWidth: .infinity)
    }
    .scrollBounceBehavior(.basedOnSize)
    .refreshable {
      await myCourses.loadCourses(query: query, force: true)
    }
  }

  @ViewBuilder
  private var signedInContent: some View {
    switch myCourses.coursesState {
    case .idle, .loading:
      CourseCatalogLoadingGrid()
    case .loaded(let page):
      MyCoursesGrid(page: page)
    case .empty:
      if let query = catalogText(query) {
        ContentUnavailableView.search(text: query)
      } else {
        MyCoursesEmptyView(onCreateCourse: onCreateCourse)
      }
    case .failed(let failure):
      MyCoursesFailureRecoveryView(failure: failure) {
        await myCourses.loadCourses(query: query, force: true)
      }
    }
  }
}

private struct MyCoursesSignInView: View {
  let onSignIn: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Log in to track your courses",
          tableName: "Courses",
          comment: "Title inviting signed-out learners to log in to use My Courses.")
      } icon: {
        Image(systemName: "person.crop.circle.badge.checkmark")
      }
    } description: {
      Text(
        "Keep your courses and progress in one place by logging in to your account.",
        tableName: "Courses",
        comment: "Explains why signing in is useful on the My Courses screen.")
    } actions: {
      Button(action: onSignIn) {
        Text(
          "Log in",
          tableName: "Courses",
          comment: "Opens the native account sheet from My Courses.")
      }
      .buttonStyle(.bordered)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

private struct MyCoursesAccountUnavailableView: View {
  @Environment(SessionStore.self) private var session

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Account unavailable",
          tableName: "Courses",
          comment: "Title when My Courses cannot determine the signed-in account.")
      } icon: {
        Image(systemName: "wifi.exclamationmark")
      }
    } description: {
      Text(
        "Zoonk couldn't load your account. Check your connection and try again.",
        tableName: "Courses",
        comment: "Guidance when account restoration fails on My Courses.")
    } actions: {
      Button {
        Task {
          await session.retryRestore()
        }
      } label: {
        Text(
          "Try again",
          tableName: "Courses",
          comment: "Retries account restoration from My Courses.")
      }
      .buttonStyle(.bordered)
      .disabled(session.isWorking)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

private struct MyCoursesEmptyView: View {
  let onCreateCourse: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "No courses yet",
          tableName: "Courses",
          comment: "Title when the signed-in learner has not enrolled in any courses.")
      } icon: {
        Image(systemName: "books.vertical")
      }
    } description: {
      Text(
        "Start learning something new today.",
        tableName: "Courses",
        comment: "Guidance when the signed-in learner has no courses.")
    } actions: {
      Button(action: onCreateCourse) {
        Text(
          "Start a course",
          tableName: "Courses",
          comment: "Opens course creation from an empty My Courses list.")
      }
      .buttonStyle(.bordered)
    }
    .frame(maxWidth: .infinity, minHeight: 280)
  }
}

private struct MyCoursesFailureRecoveryView: View {
  let failure: MyCoursesFailure
  let retry: () async -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        failureTitle
      } icon: {
        Image(systemName: failure == .network ? "wifi.exclamationmark" : "exclamationmark.triangle")
      }
    } description: {
      Text(
        "Your courses are safe. Try loading them again.",
        tableName: "Courses",
        comment: "Reassures learners after My Courses fails to load.")
    } actions: {
      Button {
        Task {
          await retry()
        }
      } label: {
        Text(
          "Try again",
          tableName: "Courses",
          comment: "Retries loading My Courses after a failure.")
      }
      .buttonStyle(.bordered)
    }
    .frame(maxWidth: .infinity, minHeight: 280)
  }

  @ViewBuilder
  private var failureTitle: some View {
    switch failure {
    case .network:
      Text(
        "You're offline",
        tableName: "Courses",
        comment: "Title when My Courses cannot load without a network connection.")
    case .unavailable:
      Text(
        "Courses are unavailable",
        tableName: "Courses",
        comment: "Title when My Courses cannot be loaded from the service.")
    }
  }
}
