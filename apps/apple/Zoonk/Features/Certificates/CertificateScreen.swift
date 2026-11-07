import SwiftUI
import UIKit

/// The learner's own certificate, as main's page: what it says, what they can do with it, its
/// picture, its details, what it means and what it covers. A locked one leads with the Plus notice,
/// then its card and facts.
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
      CertificateHeading(facts: certificate.facts, isIssued: true)

      if name.isEmpty {
        Section {
          CertificateNameEditor(name: $nameDraft, current: "") {}
        }
      } else {
        actions
      }

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

      CertificateDetails(facts: certificate.facts) {
        if isReady {
          nameRow
        }
      } link: {
        linkRow
      } footer: {
        SectionFooter { linkNote }
      }

      CertificateMeaning(facts: certificate.facts)
      CertificateCovered(facts: certificate.facts)
    }
    .barTitleAfterHero(certificate.facts.name)
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

  /// Main's owner actions: Share leads, Print and saving side by side, then LinkedIn. Saving opens
  /// the share sheet with the print picture, so it takes the platform's word rather than main's
  /// "Download".
  private var actions: some View {
    Section {
      VStack(spacing: 8) {
        shareLink
          .buttonStyle(.mainAction)

        // Not a `ButtonRow`, whose buttons take their own width side by side: these share it.
        AccessibilityStack(spacing: 8) {
          BusyButton(isBusy: printing != nil, icon: .print, action: printCertificate) {
            Text("Print", tableName: "Certificates", comment: "Prints a certificate")
              .background { PrintAnchorView(anchor: printAnchor) }
          }
          .disabled(!picturesAreCurrent)

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
        }
      }
      .buttonStyle(.outline)
      .buttonSizing(.flexible)
      .controlSize(.large)
      .listRowSeparator(.hidden)
    } footer: {
      if printFailed {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't work. Try again in a moment.", table: "Certificates",
            comment: "Loading a certificate to print failed"))
      }
    }
  }

  @ViewBuilder private var nameRow: some View {
    if isEditingName {
      CertificateNameEditor(name: $nameDraft, current: name) {
        isEditingName = false
      }
    } else {
      Button {
        nameDraft = name
        isEditingName = true
      } label: {
        CertificateDetailRow(
          label: Text(
            "Name", tableName: "Certificates",
            comment: "Labels the learner's full name, as their certificates print it")
        ) {
          // Stacked, the name keeps its lines together and Change goes under it.
          AccessibilityStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(name)
              .typeWeight(.medium)

            Text(
              "Change", tableName: "Certificates", comment: "Changes the name on the certificates"
            )
            .underline()
            .typeWeight(.semibold)
          }
        }
      }
    }
  }

  /// Main's link row: the page's address, which "Copy" copies.
  private var linkRow: some View {
    Button {
      UIPasteboard.general.string = certificate.url.absoluteString
      linkCopied = true
      announcePolitely(String(localized: Self.linkCopiedLine))
    } label: {
      CertificateDetailRow(
        label: Text(
          "Link", tableName: "Certificates", comment: "Labels a certificate's web address")
      ) {
        AccessibilityStack(alignment: .firstTextBaseline, spacing: 8) {
          Text(verbatim: certificate.shownURL)
            .typeStyle(.data)

          Group {
            if linkCopied {
              Text(Self.linkCopiedLine)
            } else {
              Text("Copy", tableName: "Certificates", comment: "Copies a certificate's link")
                .underline()
            }
          }
          .typeStyle(.note.weight(.semibold))
        }
      }
    }
    .accessibilityLabel(
      linkCopied
        ? Text(Self.linkCopiedLine)
        : Text("Copy link", tableName: "Certificates", comment: "Copies a certificate's link"))
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
      CertificateHeading(facts: facts, isIssued: false)

      Section {
        CertificatePlusNotice()
      }

      Section {
        LockedCertificateCard(facts: facts)
          .listRowSeparator(.hidden)
      }

      CertificateDetails(facts: facts) {
        EmptyView()
      } link: {
        EmptyView()
      } footer: {
        EmptyView()
      }

      CertificateMeaning(facts: facts)
      CertificateCovered(facts: facts)
    }
    .barTitleAfterHero(facts.name)
  }
}

/// Main's `CertificateIntro`: an issued one claims it's verified and when it was issued; a locked
/// one isn't issued yet, so it claims neither.
private struct CertificateHeading: View {
  let facts: CertificateFacts
  let isIssued: Bool

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 10) {
        if isIssued {
          Label {
            Text(
              "Verified certificate · issued by Zoonk", tableName: "Certificates",
              comment: "Over an issued certificate's heading: Zoonk vouches for it")
          } icon: {
            Image(systemName: "checkmark.seal")
              .foregroundStyle(.success)
          }
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }

        Text(facts.sentence)
          .typeStyle(.heroTitle)
          .foregroundStyle(Color(.foreground))
          .accessibilityAddTraits(.isHeader)
          .heroTitle()

        if isIssued {
          Text(
            "Certificate of completion, issued on \(facts.completedOnLong).",
            tableName: "Certificates",
            comment:
              "Under an issued certificate's heading; the argument is a date like October 28, 2026"
          )
          .typeStyle(.lead)
          .foregroundStyle(.mutedForeground)
        }
      }
      .padding(.bottom, 8)
      .listRowSeparator(.hidden)
    }
  }
}

/// Main's `CertificateDetails`: everything the certificate says, as text. The owner's name leads
/// and its link ends an issued one.
private struct CertificateDetails<Name: View, Link: View, Footer: View>: View {
  let facts: CertificateFacts
  @ViewBuilder let name: Name
  @ViewBuilder let link: Link
  @ViewBuilder let footer: Footer

  var body: some View {
    Section {
      name

      if let level = facts.courseLevel {
        CertificateDetailRow(
          label: Text("Level", tableName: "Certificates", comment: "A course certificate's level")
        ) {
          Text(level.localizedTitle)
            .typeWeight(.medium)
        }
      }

      if facts.kind == .languageLevel {
        ForEach(facts.skillLevels ?? [], id: \.skill) { level in
          CertificateDetailRow(label: Text(languageSkillName(level.skill)), isData: true) {
            Text(verbatim: level.label)
          }
        }
      }

      CertificateDetailRow(
        label: Text(
          "Completed", tableName: "Certificates", comment: "When a certificate was earned"),
        isData: true
      ) {
        Text(facts.completedOnDay)
      }

      if let lessons = facts.lessonsStudied, lessons > 0 {
        CertificateDetailRow(
          label: Text(
            "Lessons studied", tableName: "Certificates",
            comment: "How many lessons a certificate's learner studied"),
          isData: true
        ) {
          Text(lessons, format: .number)
        }
      }

      if let lessons = facts.lessonsTestedOut, lessons > 0 {
        CertificateDetailRow(
          label: Text(
            "Passed by test", tableName: "Certificates",
            comment: "How many of a certificate's lessons the learner passed by a test"),
          isData: true
        ) {
          Text(lessons, format: .number)
        }
      }

      if let minutes = facts.minutes, minutes > 0 {
        CertificateDetailRow(
          label: Text(
            "Study time", tableName: "Certificates",
            comment: "About how long a certificate's lessons took to study"),
          isData: true
        ) {
          Text(
            "about \(studyDuration(minutes: roundStudyMinutes(minutes)))",
            tableName: "Certificates",
            comment: "An approximate study time, such as \"about 41 hr\"")
        }
      }

      if !facts.locked {
        CertificateDetailRow(
          label: Text(
            "Certificate ID", tableName: "Certificates",
            comment: "Labels a certificate's code, which anyone can check"),
          isData: true
        ) {
          Text(verbatim: facts.groupedCode)
        }
      }

      link
    } header: {
      SectionTitle(
        Text("Details", tableName: "Certificates", comment: "Heading over a certificate's facts"))
    } footer: {
      footer
    }
  }
}

/// Main's `DetailRow`: a quiet label, and the value in ink, mono for numbers and dates.
private struct CertificateDetailRow<Value: View>: View {
  let label: Text
  var isData = false
  @ViewBuilder let value: Value

  var body: some View {
    LabeledContent {
      value
        .typeStyle(isData ? .data : .note)
        .foregroundStyle(Color(.foreground))
        .multilineTextAlignment(.trailing)
    } label: {
      label
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }
  }
}

/// Main's `CertificateMeaning`: how Zoonk decided to issue this kind of certificate, and what it
/// isn't.
private struct CertificateMeaning: View {
  /// Main's `BAND_ABOVE`: a level is finished when every counted skill reaches the band above it.
  private static let bandAbove = ["A1": "A2", "A2": "B1", "B1": "B2", "B2": "C1", "C1": "C2"]

  /// Main's `leading-relaxed` paragraphs at 15pt.
  private static let paragraphStyle = TypeStyle(
    size: 15, relativeTo: .subheadline, weight: .regular, lineHeight: 1.625)

  @ScaledMetric(relativeTo: .subheadline) private var paragraphSpacing = 10.0

  let facts: CertificateFacts

  private var paragraphs: [String] {
    let nameNote = String(
      localized:
        "The name is the one the learner gave their Zoonk account; Zoonk doesn't check IDs.",
      table: "Certificates",
      comment: "Ends a certificate's explanation: the name on it is the one the learner gave")

    if facts.kind == .languageLevel {
      let band = facts.level.flatMap { Self.bandAbove[$0] } ?? ""

      return [
        String(
          localized:
            "Zoonk measures each skill (reading, listening, speaking, writing) from the learner's answers in lessons and practice. A level is complete when every skill those answers have raised reaches the next level, so this certificate was issued when each of them reached \(band).",
          table: "Certificates",
          comment:
            "How a language level certificate is earned; the argument is a CEFR band, such as B2"),
        String(
          localized:
            "Levels are aligned with the CEFR, the Common European Framework of Reference for Languages. This is not an official exam result.",
          table: "Certificates",
          comment: "What a language certificate's level is, before the note about its name")
          + " " + nameNote,
      ]
    }

    let issued =
      facts.courseLevel == nil
      ? String(
        localized:
          "Zoonk issues this certificate when a learner finishes every lesson of a course's plan, by studying it or passing its test, and wins every challenge in it.",
        table: "Certificates", comment: "How a certificate for a course's whole plan is earned")
      : String(
        localized:
          "Zoonk issues this certificate when a learner finishes every chapter of a course's level, studying each lesson or passing its test, and wins every challenge in it.",
        table: "Certificates", comment: "How a certificate for a course's level is earned")

    return [
      issued,
      String(
        localized: "It's a record of completion on Zoonk, not academic credit.",
        table: "Certificates",
        comment: "What a course certificate is, before the note about its name")
        + " " + nameNote,
    ]
  }

  // The title scrolls with its paragraphs, as main's: a plain list pins a section's header, and
  // at the largest sizes this one would cover a third of the screen.
  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: paragraphSpacing) {
        Text(
          "What this certificate means", tableName: "Certificates",
          comment: "Heading over how Zoonk issues a certificate and what it isn't"
        )
        .typeStyle(.section)
        .foregroundStyle(Color(.foreground))
        .accessibilityAddTraits(.isHeader)

        ForEach(paragraphs, id: \.self) { paragraph in
          Text(verbatim: paragraph)
            .typeStyle(Self.paragraphStyle)
            .foregroundStyle(.mutedForeground)
        }
      }
      .listRowSeparator(.hidden)
    }
  }
}

/// Main's `CertificateCovered`: a course's chapters, or what a language level's learner can do.
private struct CertificateCovered: View {
  let facts: CertificateFacts

  var body: some View {
    let lines = facts.kind == .course ? facts.topics : facts.canDo

    if !lines.isEmpty {
      Section {
        ForEach(lines, id: \.self) { line in
          MarkedRow {
            StatusMark(status: .done)
          } content: {
            Text(line)
          } end: {
            EmptyView()
          }
        }
      } header: {
        SectionTitle(
          facts.kind == .course
            ? Text(
              "Topics covered", tableName: "Certificates",
              comment: "Heading over the chapters a course certificate covers")
            : Text(
              "Can do", tableName: "Certificates",
              comment: "Heading over what a language certificate's learner can do")
        ) {
          if facts.kind == .course {
            Text(lines.count, format: .number)
          }
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
