import SwiftUI
import UIKit

/// The learner's own certificate: its picture, then what they can do with it.
struct CertificateScreen: View {
  @Environment(CertificatesStore.self) private var store

  let code: String

  var body: some View {
    let certificate = store.certificate(code: code)

    Group {
      switch certificate.state {
      case .loaded(let value):
        CertificateDetail(certificate: value)
      case .idle, .loading, .failed, .empty:
        SettingsLoadingState(state: certificate.state) {
          Task { await certificate.refresh() }
        }
      }
    }
    .navigationTitle(
      Text("Certificate", tableName: "Certificates", comment: "Title of one certificate's page")
    )
    .toolbarTitleDisplayMode(.inline)
    .loads(certificate)
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
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @State private var isZoomed = false
  @State private var isLinkedInShown = false
  @State private var isSigningUp = false
  @State private var isEditingName = false
  @State private var nameDraft = ""
  @State private var printAnchor = PrintAnchor()
  @State private var printing: Task<Void, Never>?
  @State private var printFailed = false
  @State private var linkCopied = false

  let certificate: Certificate

  private var isGuest: Bool {
    learner.summary.value?.identity.isAnonymous == true
  }

  /// The live profile name: a rename shows here before the certificate is read again.
  private var name: String {
    session.account?.user.name.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }

  /// Sharing, printing and saving wait for the name that goes on the certificate.
  private var isReady: Bool {
    !isGuest && !name.isEmpty
  }

  /// A rename waits for the pictures drawn with the new name; pull to refresh reads them again.
  private var picturesAreCurrent: Bool {
    certificate.facts.recipientName == name
  }

  var body: some View {
    List {
      // A header, since a row clips the picture to the list's rounded cells.
      Section {
      } header: {
        Button {
          isZoomed = true
        } label: {
          CertificatePicture(url: certificate.pictures.screen)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(certificate.facts.spokenTitle)
        .accessibilityAddTraits(.isImage)
        .listRowInsets(EdgeInsets())
      }

      if isGuest {
        guestSection
      } else if name.isEmpty {
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
          linkNote
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
    .sheet(isPresented: $isSigningUp) {
      AccountSheet(signsIn: true)
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
      } label: {
        if linkCopied {
          Label {
            Text(
              "Link copied", tableName: "Certificates", comment: "A certificate's link was copied")
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
        Text(
          "That didn't work. Try again in a moment.", tableName: "Certificates",
          comment: "Loading a certificate to print failed"
        )
        .foregroundStyle(.destructive)
      }
    }
    .foregroundStyle(.primary)
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

              Text(
                "Change", tableName: "Certificates", comment: "Changes the name on the certificates"
              )
              .underline()
              .foregroundStyle(.primary)
            }
          } label: {
            Text(
              "Name", tableName: "Certificates",
              comment: "Labels the learner's full name, as their certificates print it"
            )
            .foregroundStyle(.primary)
          }
        }
      }
    } footer: {
      linkNote
    }
  }

  private var guestSection: some View {
    Section {
      Text(
        "Create a free account to keep it and share it.", tableName: "Certificates",
        comment: "What a guest does to keep a certificate and share it")

      Button {
        isSigningUp = true
      } label: {
        Text(
          "Create a free account", tableName: "Certificates",
          comment: "Opens sign-up for a guest with a certificate")
      }
    }
  }

  private var linkNote: Text {
    Text(
      "Anyone with the link can see this certificate. Its page doesn't show up in search.",
      tableName: "Certificates", comment: "Who can see a certificate's page")
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
