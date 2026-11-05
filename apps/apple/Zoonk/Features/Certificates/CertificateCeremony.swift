import SwiftUI

/// The award moment: the certificates a result earned, the newest on top. Closing it marks them
/// shown, so they stop coming back with results.
struct CertificateCeremony: View {
  @Environment(CertificatesStore.self) private var store
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @State private var isEditingName = false
  @State private var nameDraft = ""
  @State private var isLinkedInShown = false
  @State private var isOpened = false
  @State private var isSigningUp = false

  /// Oldest first, never empty.
  let certificates: [CertificateFacts]
  let onClose: () -> Void

  private var top: CertificateFacts {
    certificates[certificates.count - 1]
  }

  private var isGuest: Bool {
    learner.summary.value?.identity.isAnonymous == true
  }

  /// The live profile name: a new one shows at once, before the pictures are drawn again.
  private var name: String {
    session.account?.user.name.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }

  var body: some View {
    let certificate = store.certificate(code: top.code)

    PaneSplit {
      stage
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .scenePadding()
    } secondary: {
      CenteredScroll {
        VStack(spacing: 0) {
          words
          learnerPart(certificate.value)
        }
        .scenePadding()
      }
      .safeAreaBar(edge: .bottom) { continueBar }
    } single: {
      CenteredScroll {
        VStack(spacing: 0) {
          stage
            .padding(.bottom, 32)
          words
          learnerPart(certificate.value)
        }
        .frame(maxWidth: 600)
        .scenePadding()
      }
      .safeAreaBar(edge: .bottom) { continueBar.keepsOffFold() }
    }
    .landsActsOnInput()
    .celebratesOnce(id: top.code)
    .sheet(isPresented: $isOpened) {
      CertificateSheet(code: top.code)
        .accessibilitySizeStyles()
    }
    .sheet(isPresented: $isLinkedInShown) {
      if let value = certificate.value {
        CertificateLinkedInSheet(certificate: value)
          .accessibilitySizeStyles()
      }
    }
    .sheet(isPresented: $isSigningUp) {
      AccountSheet(signsIn: true)
        .accessibilitySizeStyles()
    }
  }

  /// The newest certificate in front; earlier ones peek out behind it, up and to the right.
  private var stage: some View {
    ZStack {
      ForEach(Array(certificates.dropLast().enumerated()), id: \.element.id) { index, facts in
        let depth = CGFloat(certificates.count - 1 - index)

        StagePicture(code: facts.code)
          .offset(x: 14 * depth, y: -14 * depth)
          .opacity(0.6)
          .accessibilityHidden(true)
      }

      Button {
        isOpened = true
      } label: {
        StagePicture(code: top.code)
      }
      .buttonStyle(.plain)
      .settles(from: 0.92)
      .overlay {
        GeometryReader { proxy in
          // About where the route ends on the certificate.
          CelebrationBurst()
            .position(x: proxy.size.width * 0.92, y: proxy.size.height * 0.76)
        }
      }
      .accessibilityLabel(top.spokenTitle)
      .accessibilityAddTraits(.isImage)
    }
    .padding(.top, certificates.count > 1 ? 14 : 0)
    .padding(.trailing, certificates.count > 1 ? 14 : 0)
  }

  private var words: some View {
    VStack(spacing: 8) {
      Text(title)
        .font(.largeTitle.bold())
        .multilineTextAlignment(.center)
        .accessibilityAddTraits(.isHeader)

      Text(line)
        .font(.title3)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
  }

  @ViewBuilder
  private func learnerPart(_ certificate: Certificate?) -> some View {
    if isGuest {
      VStack(spacing: 22) {
        Text(
          "Create a free account to keep your certificate and put your name on it.",
          tableName: "Certificates", comment: "What a guest who earned a certificate can do"
        )
        .font(.subheadline)
        .multilineTextAlignment(.center)

        Button {
          isSigningUp = true
        } label: {
          Text(
            "Create a free account", tableName: "Certificates",
            comment: "Opens sign-up for a guest with a certificate"
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .controlSize(.large)
      }
      .padding(.top, 18)
    } else if name.isEmpty || isEditingName {
      CertificateNameEditor(name: $nameDraft, current: name) {
        isEditingName = false
      }
      .padding(.top, 18)
    } else {
      VStack(spacing: 0) {
        nameRow
        actions(certificate)
          .padding(.top, 22)
        savedLine
          .padding(.top, 14)
      }
      .padding(.top, 18)
    }
  }

  private var nameRow: some View {
    HStack(spacing: 8) {
      Text(
        "On your certificate: \(Text(name).bold().foregroundStyle(.primary))",
        tableName: "Certificates", comment: "The name printed on the certificate just earned"
      )
      .foregroundStyle(.secondary)

      Button {
        nameDraft = name
        isEditingName = true
      } label: {
        Text("Change", tableName: "Certificates", comment: "Changes the name on the certificates")
          .underline()
      }
      .buttonStyle(.borderless)
      .foregroundStyle(.primary)
    }
    .font(.subheadline)
    .multilineTextAlignment(.center)
  }

  private func actions(_ certificate: Certificate?) -> some View {
    AccessibilityStack(spacing: 12, stackedSpacing: 12) {
      Group {
        // A rename waits for the pictures drawn with the new name.
        if let certificate, certificate.facts.recipientName == name {
          ShareLink(
            item: certificate.post,
            subject: Text(certificate.facts.name),
            message: Text(certificate.shareMessage),
            preview: SharePreview(certificate.facts.name, image: certificate.post)
          ) {
            shareLabel
          }
        } else {
          Button {
          } label: {
            shareLabel
          }
          .disabled(true)
        }

        Button {
          isLinkedInShown = true
        } label: {
          Label {
            Text(
              "Add to LinkedIn", tableName: "Certificates",
              comment: "Adds a certificate to LinkedIn")
          } icon: {
            Image(systemName: "arrow.up.right")
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .disabled(certificate == nil)
      }
      .buttonStyle(.bordered)
      .controlSize(.large)
    }
    // Both as tall as the one whose label wraps.
    .fixedSize(horizontal: false, vertical: true)
  }

  private var shareLabel: some View {
    Label {
      Text("Share", tableName: "Certificates", comment: "Shares a certificate")
    } icon: {
      Image(systemName: "square.and.arrow.up")
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var savedLine: some View {
    Group {
      if certificates.count > 1 {
        Text(
          "They're saved in Certificates.", tableName: "Certificates",
          comment: "Where the certificates just earned are kept")
      } else {
        Text(
          "It's saved in Certificates.", tableName: "Certificates",
          comment: "Where the certificate just earned is kept")
      }
    }
    .font(.footnote)
    .foregroundStyle(.secondary)
  }

  private var continueBar: some View {
    Button(action: close) {
      Text("Continue", tableName: "Certificates", comment: "Closes the certificate's award moment")
        .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
    .keyboardShortcut(.defaultAction)
    .scenePadding()
  }

  private var title: String {
    if certificates.count > 1 {
      return String(
        localized: "\(certificates.count) certificates earned", table: "Certificates",
        comment: "Title when one result earned several certificates")
    }

    switch top.kind {
    case .course:
      return String(
        localized: "Course complete!", table: "Certificates",
        comment: "Title when the learner finished a course")
    case .languageLevel:
      return String(
        localized: "\(top.level ?? "") complete!", table: "Certificates",
        comment: "Title when the learner finished a CEFR language level, such as B1")
    }
  }

  private var line: String {
    if certificates.count > 1 {
      let names = certificates.map(\.name).formatted(.list(type: .and))

      return String(
        localized: "Your \(names) certificates are ready.", table: "Certificates",
        comment: "Under the title when several certificates were earned; the list of their names")
    }

    if top.kind == .course {
      return String(
        localized: "Your certificate for \(top.title ?? "") is ready.", table: "Certificates",
        comment: "Under the title when a course certificate was earned; the course")
    }

    return String(
      localized: "Your \(top.languageName) \(top.level ?? "") certificate is ready.",
      table: "Certificates",
      comment:
        "Under the title when a language certificate was earned: the language, then the level")
  }

  private func close() {
    for facts in certificates {
      Task { await store.markShown(facts.code) }
    }

    onClose()
  }
}

/// Each picture loads its certificate's links first.
private struct StagePicture: View {
  @Environment(CertificatesStore.self) private var store

  let code: String

  var body: some View {
    let certificate = store.certificate(code: code)

    CertificatePicture(url: certificate.value?.pictures.screen)
      .loads(certificate, refreshable: false)
  }
}

/// Lands with the certificate, once.
private struct CelebrationBurst: View {
  @Environment(\.celebrates) private var celebrates
  @State private var hasLanded = false

  var body: some View {
    ZStack {
      if celebrates {
        Burst(color: .success, delay: .beat)
      }
    }
    .sensoryFeedback(.success, trigger: hasLanded)
    .task {
      guard celebrates else {
        return
      }

      try? await Task.sleep(for: .seconds(.beat))
      hasLanded = true
    }
  }
}

/// Centered while it fits, scrolling once it doesn't (a long name editor, a large text size).
private struct CenteredScroll<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    GeometryReader { proxy in
      ScrollView {
        content
          .frame(maxWidth: .infinity, minHeight: proxy.size.height)
      }
      .scrollBounceBehavior(.basedOnSize)
    }
  }
}
