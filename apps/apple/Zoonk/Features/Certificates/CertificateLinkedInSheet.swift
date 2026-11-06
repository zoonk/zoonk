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
          Text(
            "LinkedIn opens its form to add a license or certification. Copy each field into it.",
            tableName: "Certificates", comment: "How adding a certificate to LinkedIn works"
          )
          .foregroundStyle(.mutedForeground)
          .listRowSeparator(.hidden)
        }

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
        }

        Section {
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
            .frame(maxWidth: .infinity)
          }
          .buttonStyle(.mainAction)
          .controlSize(.large)
          .listRowInsets(EdgeInsets())
          .listRowBackground(Color.clear)
        }
      }
      .navigationTitle(
        Text(
          "Add to your LinkedIn profile", tableName: "Certificates",
          comment: "Title of the sheet that adds a certificate to LinkedIn")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button(role: .close, action: dismiss.callAsFunction)
        }
      }
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
        Button {
          UIPasteboard.general.string = value
          copied = value
          announcePolitely(String(localized: Self.copiedLine))
        } label: {
          if copied == value {
            Label {
              Text(Self.copiedLine)
            } icon: {
              Image(systemName: "checkmark")
            }
          } else {
            Label {
              Text(
                "Copy", tableName: "Certificates", comment: "Copies one field for LinkedIn's form")
            } icon: {
              Image(systemName: "doc.on.doc")
            }
          }
        }
        .buttonStyle(.outline)
        .controlSize(.small)
        .accessibilityValue(label)
      }
    }
    .alignmentGuide(.listRowSeparatorLeading) { _ in 0 }
  }

  private static var copiedLine: LocalizedStringResource {
    LocalizedStringResource("Copied", table: "Certificates", comment: "A field was just copied")
  }
}
