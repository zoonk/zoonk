import SwiftUI
import UIKit

/// The learner's own certificate: its picture, then what they can do with it. A locked one shows
/// its card, its facts and the Plus notice.
struct CertificateScreen: View {
  @Environment(CertificatesStore.self) private var store

  let code: String

  var body: some View {
    Group {
      switch store.certificate(code: code) {
      case .issued(let certificate):
        CertificateDetail(certificate: certificate)
      case .locked(let facts):
        LockedCertificateDetail(facts: facts)
      // One just earned joins the list when it's read again.
      case nil where store.list.isRefreshing:
        ProgressView()
      case nil:
        SettingsLoadingState(state: store.list.state) {
          Task { await store.list.refresh() }
        }
      }
    }
    .navigationTitle(
      Text("Certificate", tableName: "Certificates", comment: "Title of one certificate's page")
    )
    .toolbarTitleDisplayMode(.inline)
    .loads(store.list)
  }
}

/// A certificate opened outside the list, over the screen that opened it.
struct CertificateSheet: View {
  @Environment(\.dismiss) private var dismiss

  let code: String

  var body: some View {
    NavigationStack {
      CertificateScreen(code: code)
        .toolbar {
          ToolbarItem(placement: .topBarLeading) {
            Button(role: .close, action: dismiss.callAsFunction)
          }
        }
    }
  }
}

private struct CertificateDetail: View {
  @Environment(SessionStore.self) private var session
  @State private var isZoomed = false
  @State private var isLinkedInShown = false
  @State private var isEditingName = false
  @State private var nameDraft = ""
  @State private var printAnchor = PrintAnchor()
  @State private var printing: Task<Void, Never>?
  @State private var printFailed = false
  @State private var linkCopied = false

  let certificate: Certificate

  /// The live profile name: a rename shows here before the certificate is read again.
  private var name: String {
    session.account?.user.name.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }

  /// Sharing, printing and saving wait for the name that goes on the certificate.
  private var isReady: Bool {
    !name.isEmpty
  }

  /// A rename waits for the pictures drawn with the new name; pull to refresh reads them again.
  private var picturesAreCurrent: Bool {
    certificate.facts.recipientName == name
  }

  var body: some View {
    ZoonkList {
      Section {
        Button {
          isZoomed = true
        } label: {
          CertificatePicture(url: certificate.pictures.screen)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(certificate.facts.spokenTitle)
        .accessibilityAddTraits(.isImage)
        .listRowSeparator(.hidden)
      }

      if name.isEmpty {
        Section {
          CertificateNameEditor(name: $nameDraft, current: "") {}
        }
      } else {
        actions
      }

      if isReady {
        nameSection
      } else {
        Section {
        } footer: {
          SectionFooter { linkNote }
        }
      }
    }
    .toolbar {
      if isReady {
        ToolbarItem(placement: .primaryAction) {
          shareLink
        }
      }
    }
    .fullScreenCover(isPresented: $isZoomed) {
      CertificateZoom(certificate: certificate)
    }
    .sheet(isPresented: $isLinkedInShown) {
      CertificateLinkedInSheet(certificate: certificate)
    }
    .onDisappear { printing?.cancel() }
    .sensoryFeedback(.success, trigger: linkCopied) { _, copied in copied }
    .task(id: linkCopied) {
      guard linkCopied else {
        return
      }

      try? await Task.sleep(for: .seconds(2))
      linkCopied = false
    }
  }

  private var shareLink: some View {
    ShareLink(
      item: certificate.post,
      subject: Text(certificate.facts.name),
      message: Text(certificate.shareMessage),
      preview: SharePreview(certificate.facts.name, image: certificate.post)
    ) {
      Label {
        Text("Share", tableName: "Certificates", comment: "Shares a certificate")
      } icon: {
        Image(systemName: "square.and.arrow.up")
      }
    }
    .disabled(!picturesAreCurrent)
  }

  private var actions: some View {
    Section {
      Button(action: printCertificate) {
        HStack {
          Label {
            Text("Print", tableName: "Certificates", comment: "Prints a certificate")
          } icon: {
            Image(systemName: "printer")
          }

          if printing != nil {
            Spacer()
            ProgressView()
          }
        }
        .background { PrintAnchorView(anchor: printAnchor) }
      }
      .disabled(printing != nil || !picturesAreCurrent)

      ShareLink(
        item: certificate.document,
        preview: SharePreview(certificate.fileName, image: certificate.document)
      ) {
        Label {
          Text(
            "Save certificate", tableName: "Certificates",
            comment: "Saves the certificate's picture to Photos or Files")
        } icon: {
          Image(systemName: "square.and.arrow.down")
        }
      }
      .disabled(!picturesAreCurrent)

      Button {
        isLinkedInShown = true
      } label: {
        Label {
          Text(
            "Add to LinkedIn", tableName: "Certificates", comment: "Adds a certificate to LinkedIn")
        } icon: {
          Image(systemName: "arrow.up.right")
        }
      }

      Button {
        UIPasteboard.general.string = certificate.url.absoluteString
        linkCopied = true
        announcePolitely(String(localized: Self.linkCopiedLine))
      } label: {
        if linkCopied {
          Label {
            Text(Self.linkCopiedLine)
          } icon: {
            Image(systemName: "checkmark")
          }
        } else {
          Label {
            Text("Copy link", tableName: "Certificates", comment: "Copies a certificate's link")
          } icon: {
            Image(systemName: "link")
          }
        }
      }
    } footer: {
      if printFailed {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't work. Try again in a moment.", table: "Certificates",
            comment: "Loading a certificate to print failed"))
      }
    }
    .foregroundStyle(Color(.foreground))
  }

  private var nameSection: some View {
    Section {
      if isEditingName {
        CertificateNameEditor(name: $nameDraft, current: name) {
          isEditingName = false
        }
      } else {
        Button {
          nameDraft = name
          isEditingName = true
        } label: {
          LabeledContent {
            HStack(spacing: 12) {
              Text(name)
                .foregroundStyle(.mutedForeground)

              Text(
                "Change", tableName: "Certificates", comment: "Changes the name on the certificates"
              )
              .underline()
              .foregroundStyle(Color(.foreground))
            }
          } label: {
            Text(
              "Name", tableName: "Certificates",
              comment: "Labels the learner's full name, as their certificates print it"
            )
            .foregroundStyle(Color(.foreground))
          }
        }
      }
    } footer: {
      SectionFooter { linkNote }
    }
  }

  private var linkNote: Text {
    Text(
      "Anyone with the link can see this certificate. Its page doesn't show up in search.",
      tableName: "Certificates", comment: "Who can see a certificate's page")
  }

  private static var linkCopiedLine: LocalizedStringResource {
    LocalizedStringResource(
      "Link copied", table: "Certificates", comment: "A certificate's link was copied")
  }

  private func printCertificate() {
    let identity = session.authenticatedSession
    printFailed = false

    printing = Task {
      defer { printing = nil }

      do {
        let data = try await certificate.document.data()

        guard !Task.isCancelled, session.authenticatedSession == identity else {
          return
        }

        CertificatePrinting.print(data, jobName: certificate.fileName, from: printAnchor.view)
      } catch {
        printFailed = !Task.isCancelled
      }
    }
  }
}

/// What the certificate says, without the picture, code or link that make it a credential.
private struct LockedCertificateDetail: View {
  let facts: CertificateFacts

  var body: some View {
    ZoonkList {
      Section {
        LockedCertificateCard(facts: facts)
          .listRowSeparator(.hidden)
      }

      Section {
        CertificatePlusNotice(isInset: true)
      }

      Section {
        LabeledContent {
          Text(facts.completedOnDay)
            .foregroundStyle(.mutedForeground)
        } label: {
          Text("Completed", tableName: "Certificates", comment: "When a certificate was earned")
        }

        if let lessons = facts.lessonsStudied, lessons > 0 {
          LabeledContent {
            Text(lessons, format: .number)
              .foregroundStyle(.mutedForeground)
          } label: {
            Text(
              "Lessons studied", tableName: "Certificates",
              comment: "How many lessons a certificate's learner studied")
          }
        }

        if let lessons = facts.lessonsTestedOut, lessons > 0 {
          LabeledContent {
            Text(lessons, format: .number)
              .foregroundStyle(.mutedForeground)
          } label: {
            Text(
              "Passed by test", tableName: "Certificates",
              comment: "How many of a certificate's lessons the learner passed by a test")
          }
        }

        if let minutes = facts.minutes, minutes > 0 {
          LabeledContent {
            Text(studyTime(minutes))
              .foregroundStyle(.mutedForeground)
          } label: {
            Text(
              "Study time", tableName: "Certificates",
              comment: "About how long a certificate's lessons took to study")
          }
        }
      }

      if !facts.topics.isEmpty || !facts.canDo.isEmpty {
        Section {
          ForEach(facts.kind == .course ? facts.topics : facts.canDo, id: \.self) { line in
            Text(line)
          }
        } header: {
          SectionTitle(
            facts.kind == .course
              ? Text(
                "Topics covered", tableName: "Certificates",
                comment: "Heading over the chapters a course certificate covers")
              : Text(
                "Can do", tableName: "Certificates",
                comment: "Heading over what a language certificate's learner can do"))
        }
      }
    }
  }
}

private struct CertificateZoom: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.imageLoader) private var images
  @State private var image: UIImage?

  let certificate: Certificate

  var body: some View {
    NavigationStack {
      Group {
        if let image {
          ZoomableImage(image: image)
            .accessibilityElement()
            .accessibilityLabel(certificate.facts.spokenTitle)
            .accessibilityAddTraits(.isImage)
        } else {
          ProgressView()
        }
      }
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button(role: .close, action: dismiss.callAsFunction)
        }
      }
    }
    .task {
      image = await images?.image(
        for: certificate.pictures.screen, token: nil,
        maxPixelSize: CertificatePicture.Size.page.rawValue)
    }
  }
}

struct OpenedCertificate: Identifiable {
  let code: String

  var id: String { code }
}
