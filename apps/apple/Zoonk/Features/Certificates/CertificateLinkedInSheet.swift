import SwiftUI
import UIKit

/// LinkedIn's form doesn't fill itself from the link any more, so each field is here to copy.
struct CertificateLinkedInSheet: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.openURL) private var openURL
  @State private var copied: String?

  let certificate: Certificate

  var body: some View {
    NavigationStack {
      ZoonkList {
        Section {
          field(
            Text(
              LocalizedStringResource(
                "linkedInCertificationName", defaultValue: "Name", table: "Certificates",
                comment:
                  "LinkedIn's field for the certificate's name, labeled as in LinkedIn's \"Add license or certification\" form"
              )),
            value: certificate.facts.name)
          field(
            Text(
              "Issuing organization", tableName: "Certificates",
              comment: "LinkedIn's field for who issued the certificate"),
            value: "Zoonk")
          field(
            Text(
              "Issue date", tableName: "Certificates",
              comment: "LinkedIn's field for when it was issued"),
            value: certificate.facts.issueMonth, copies: false)
          field(
            Text(
              "Credential ID", tableName: "Certificates",
              comment: "LinkedIn's field for the certificate's code"),
            value: certificate.facts.groupedCode, isCode: true)
          field(
            Text(
              "Credential URL", tableName: "Certificates",
              comment: "LinkedIn's field for the certificate's link"),
            value: certificate.url.absoluteString, isCode: true)
        } header: {
          Text(
            "LinkedIn opens its form to add a license or certification. Copy each field into it.",
            tableName: "Certificates"
          )
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)
          .textCase(nil)
        }
      }
      .bottomBar {
        Button {
          openURL(certificate.linkedInURL)
        } label: {
          Label {
            Text(
              "Open LinkedIn", tableName: "Certificates",
              comment: "Opens LinkedIn's form to add a certification")
          } icon: {
            Image(systemName: "arrow.up.right")
          }
          .labelStyle(.trailingIcon)
        }
        .buttonStyle(.mainAction)
      }
      .navigationTitle(
        Text(
          "Add to your LinkedIn profile", tableName: "Certificates")
      )
      .toolbarTitleDisplayMode(.inline)
      .sheetClose(dismiss.callAsFunction)
      .sensoryFeedback(.success, trigger: copied) { _, copied in copied != nil }
      .task(id: copied) {
        // SwiftUI cancels this wait when another field is copied; clearing then hides its "Copied".
        guard copied != nil, (try? await Task.sleep(for: .seconds(2))) != nil else {
          return
        }

        copied = nil
      }
    }
  }

  private func field(_ label: Text, value: String, copies: Bool = true, isCode: Bool = false)
    -> some View
  {
    HStack {
      VStack(alignment: .leading, spacing: 2) {
        label
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)

        Text(value)
          .monospaced(isCode)
          .textSelection(.enabled)
      }
      .accessibilityElement(children: .combine)

      Spacer()

      if copies {
        CertificateCopyButton(isCopied: copied == value) {
          UIPasteboard.general.string = value
          copied = value
          announcePolitely(String(localized: CertificateCopyButton.copiedLine))
        }
        .accessibilityValue(label)
      }
    }
    .alignmentGuide(.listRowSeparatorLeading) { _ in 0 }
  }
}

/// Main's `CopyButton`, the one way a certificate's page and its LinkedIn fields copy a value.
struct CertificateCopyButton: View {
  let isCopied: Bool
  let action: () -> Void

  static var copiedLine: LocalizedStringResource {
    LocalizedStringResource("Copied", table: "Certificates", comment: "A field was just copied")
  }

  var body: some View {
    Button(action: action) {
      // One line, icon beside its word: a row's control stays as tall as the row's own text.
      HStack(spacing: 4) {
        Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
          .accessibilityHidden(true)

        if isCopied {
          Text(Self.copiedLine)
        } else {
          Text(
            "Copy", tableName: "Certificates", comment: "Copies one field for LinkedIn's form")
        }
      }
      .lineLimit(1)
    }
    .buttonStyle(.outline)
    .controlSize(.small)
    .fixedSize()
  }
}

/// Main's link address: one line whose start gives way first, so the certificate's code at its end
/// always shows whole.
struct CertificateAddress: View {
  let shown: String

  var body: some View {
    let codeStart = shown.lastIndex(of: "/").map { shown.index(after: $0) } ?? shown.startIndex

    HStack(spacing: 0) {
      Text(verbatim: String(shown[..<codeStart]))
        .truncationMode(.head)
      Text(verbatim: String(shown[codeStart...]))
        .fixedSize()
    }
    .lineLimit(1)
    .typeStyle(.data)
    .environment(\.layoutDirection, .leftToRight)
  }
}
