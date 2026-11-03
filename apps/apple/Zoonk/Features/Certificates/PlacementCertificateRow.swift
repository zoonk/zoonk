import SwiftUI

/// A placement result is a starting point, not an achievement: the level test's result says it in
/// a row instead of the award moment.
struct PlacementCertificateRow: View {
  @Environment(CertificatesStore.self) private var store
  @Environment(LearnerSummaryStore.self) private var learner
  @ScaledMetric(relativeTo: .body) private var pictureWidth = 84.0
  @State private var opened: OpenedCertificate?

  let facts: CertificateFacts

  var body: some View {
    let certificate = store.certificate(code: facts.code)

    Button {
      opened = OpenedCertificate(code: facts.code)
    } label: {
      HStack(spacing: 12) {
        CertificatePicture(url: certificate.value?.pictures.screen, size: .thumbnail)
          .frame(width: pictureWidth)
          .accessibilityHidden(true)

        VStack(alignment: .leading, spacing: 2) {
          Text(placementResult(facts))
            .font(.headline)
            .foregroundStyle(.primary)

          Group {
            if learner.summary.value?.identity.isAnonymous == true {
              Text(
                "Create a free account to keep it and share it.", tableName: "Certificates",
                comment: "What a guest does to keep a certificate and share it")
            } else {
              Text(
                "Saved in your certificates. Share it anytime.", tableName: "Certificates",
                comment: "Under a placement result on the level test's last screen")
            }
          }
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .disclosureChevron()
    }
    .loads(certificate, refreshable: false)
    .sheet(item: $opened) { opened in
      CertificateSheet(code: opened.code)
        .accessibilitySizeStyles()
    }
  }
}
