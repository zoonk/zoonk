import SwiftUI

@main
struct ZoonkApp: App {
  @State private var courseCatalog: CourseCatalogStore
  @State private var myCourses: MyCoursesStore
  @State private var plusAccess: PlusAccessStore
  @State private var progress: ProgressStore
  @State private var session: SessionStore
  @State private var subscriptions: AppStoreSubscriptionStore
  private let initiallyPresentsAccount: Bool
  private let privateImages: PrivateImageLoader

  init() {
    #if DEBUG
      if let configuration = UITestConfiguration.current {
        _courseCatalog = State(initialValue: configuration.courseCatalog)
        _myCourses = State(initialValue: configuration.myCourses)
        _plusAccess = State(initialValue: configuration.plusAccess)
        privateImages = .live()
        _progress = State(initialValue: configuration.progress)
        _session = State(initialValue: configuration.session)
        _subscriptions = State(initialValue: .live())
        initiallyPresentsAccount = configuration.initiallyPresentsAccount
        return
      }
    #endif

    let dependencies = AppDependencies.live()
    _courseCatalog = State(initialValue: dependencies.courseCatalogStore)
    _myCourses = State(initialValue: dependencies.myCoursesStore)
    _plusAccess = State(initialValue: dependencies.plusAccessStore)
    privateImages = dependencies.privateImageLoader
    _progress = State(initialValue: dependencies.progressStore)
    _session = State(initialValue: dependencies.sessionStore)
    _subscriptions = State(initialValue: dependencies.subscriptionStore)
    initiallyPresentsAccount = false
  }

  var body: some Scene {
    WindowGroup {
      AppView(initiallyPresentsAccount: initiallyPresentsAccount)
        .environment(courseCatalog)
        .environment(myCourses)
        .environment(plusAccess)
        .environment(progress)
        .environment(session)
        .environment(subscriptions)
        .environment(\.privateImageLoader, privateImages)
        .onOpenURL { url in
          session.handleGoogleSignInURL(url)
        }
    }
  }
}
