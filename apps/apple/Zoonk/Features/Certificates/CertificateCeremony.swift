import SwiftUI

/// The award moment: the certificates a result earned, the newest on top. Continue marks them
/// shown, so they stop coming back with results. A locked one, earned without Plus, shows its card
/// and the Plus notice instead of its picture, name and sharing.
struct CertificateCeremony: View {
  @Environment(CertificatesStore.self) private var store
  @Environment(SessionStore.self) private var session
  @Environment(\.legibilityWeight) private var legibilityWeight
  @State private var isEditingName = false
  @State private var nameDraft = ""
  @State private var isLinkedInShown = false
  @State private var isOpened = false

  /// Oldest first, never empty.
  let certificates: [CertificateFacts]
  /// Leaves without marking them shown, so they play again after the next task.
  let onSeePlus: () -> Void
  let onClose: () -> Void

  private var top: CertificateFacts {
    certificates[certificates.count - 1]
  }

  /// The live profile name: a new one shows at once, before the pictures are drawn again.
  private var name: String {
    session.account?.user.name.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }

  var body: some View {
    let certificate = store.certificate(code: top.code)?.issued

    PaneSplit {
      stage
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .scenePadding()
    } secondary: {
      CenteredScroll {
        VStack(spacing: 0) {
          words
          learnerPart(certificate)
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
          learnerPart(certificate)
        }
        .frame(maxWidth: 600)
        .scenePadding()
      }
      .safeAreaBar(edge: .bottom) { continueBar.keepsOffFold() }
    }
    .landsActsOnInput()
    .celebratesOnce(id: top.code)
    .loads(store.list, refreshable: false)
    .sheet(isPresented: $isOpened) {
      CertificateSheet(code: top.code)
        .zoonkStyles()
    }
    .sheet(isPresented: $isLinkedInShown) {
      if let certificate {
        CertificateLinkedInSheet(certificate: certificate)
          .zoonkStyles()
      }
    }
  }

  /// The newest certificate in front; earlier ones peek out behind it, up and to the right.
  private var stage: some View {
    ZStack {
      ForEach(Array(certificates.dropLast().enumerated()), id: \.element.id) { index, facts in
        let depth = CGFloat(certificates.count - 1 - index)

        StagePicture(facts: facts)
          .offset(x: 14 * depth, y: -14 * depth)
          .opacity(0.6)
          .accessibilityHidden(true)
      }

      Group {
        if top.locked {
          LockedCertificateCard(facts: top)
        } else {
          Button {
            isOpened = true
          } label: {
            StagePicture(facts: top)
          }
          .buttonStyle(.plain)
          .accessibilityLabel(top.spokenTitle)
          .accessibilityAddTraits(.isImage)
        }
      }
      .settles(from: 0.92)
      .overlay {
        GeometryReader { proxy in
          // About where the route ends on the certificate.
          CelebrationBurst()
            .position(x: proxy.size.width * 0.92, y: proxy.size.height * 0.76)
        }
      }
    }
    .padding(.top, certificates.count > 1 ? 14 : 0)
    .padding(.trailing, certificates.count > 1 ? 14 : 0)
  }

  private var words: some View {
    VStack(spacing: 8) {
      Text(title)
        .typeStyle(.heroTitle)
        .multilineTextAlignment(.center)
        .accessibilityAddTraits(.isHeader)

      // The Plus notice says how to get a locked one.
      if !top.locked {
        Text(line)
          .typeStyle(.reading)
          .foregroundStyle(.mutedForeground)
          .multilineTextAlignment(.center)
      }
    }
    .frame(maxWidth: .infinity)
  }

  @ViewBuilder
  private func learnerPart(_ certificate: Certificate?) -> some View {
    if top.locked {
      CertificatePlusNotice(seePlus: onSeePlus)
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
        "On your certificate: \(Text(name).typeWeight(.semibold, legibility: legibilityWeight).foregroundStyle(Color(.foreground)))",
        tableName: "Certificates", comment: "The name printed on the certificate just earned"
      )
      .foregroundStyle(.mutedForeground)

      Button {
        nameDraft = name
        isEditingName = true
      } label: {
        Text("Change", tableName: "Certificates", comment: "Changes the name on the certificates")
          .underline()
      }
      .buttonStyle(.borderless)
      .foregroundStyle(Color(.foreground))
    }
    .typeStyle(.body)
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
      .buttonStyle(.outline)
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
    .typeStyle(.note)
    .foregroundStyle(.mutedForeground)
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

    guard let level = top.levelName else {
      return String(
        localized: "Course complete!", table: "Certificates",
        comment: "Title when the learner finished a whole plan's course")
    }

    return String(
      localized: "\(level.keepingLevelTogether) complete!", table: "Certificates",
      comment: "Title when the learner finished a course's level, such as Beginner")
  }

  private var line: String {
    if certificates.count > 1 {
      let names = certificates.map(\.name).formatted(.list(type: .and))

      return String(
        localized: "Your \(names) certificates are ready.", table: "Certificates",
        comment: "Under the title when several certificates were earned; the list of their names")
    }

    return String(
      localized: "Your certificate for \(top.name) is ready.", table: "Certificates",
      comment:
        "Under the title when a course certificate was earned; the course or its level, such as Python · Beginner"
    )
  }

  private func close() {
    store.closeMoments(certificates.map(\.code))
    onClose()
  }
}

/// What a locked certificate says wherever it shows; the list's one notice covers all of them. See
/// Plus opens Plus unless `seePlus` leaves the screen first.
struct CertificatePlusNotice: View {
  var isList = false
  var seePlus: (() -> Void)?

  var body: some View {
    PlusNotice(
      title: isList
        ? Text(
          "Certificates come with Plus", tableName: "Certificates",
          comment: "Title of the notice at the top of the learner's certificates without Plus")
        : Text(
          "Get your certificate with Plus", tableName: "Certificates",
          comment: "Title of the notice on a certificate the learner earned without Plus"),
      description: Text(
        "Plus gives you a certificate for every level you finish, to print and share. Certificates you get stay yours if Plus ends.",
        tableName: "Certificates",
        comment: "What Plus does for certificates, on one the learner earned without Plus"),
      seePlus: seePlus)
  }
}

/// A picture appears once the learner's list has the certificate; a locked one shows its card.
private struct StagePicture: View {
  @Environment(CertificatesStore.self) private var store

  let facts: CertificateFacts

  var body: some View {
    if facts.locked {
      LockedCertificateCard(facts: facts)
    } else {
      CertificatePicture(url: store.certificate(code: facts.code)?.issued?.pictures.screen)
    }
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
