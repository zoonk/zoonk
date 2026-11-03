import SwiftUI

/// Every certificate the learner earned, newest first, in one list.
struct CertificatesScreen: View {
  @Environment(AppRouter.self) private var router
  @Environment(CertificatesStore.self) private var store
  @ScaledMetric(relativeTo: .body) private var pictureWidth = 84.0

  let open: (_ code: String) -> Void

  var body: some View {
    Group {
      switch store.list.state {
      case .loaded(let certificates):
        List {
          Section {
            ForEach(certificates) { certificate in
              row(certificate)
            }
          } footer: {
            Text(
              "Print, download or share your certificates anytime.", tableName: "Certificates",
              comment: "Under the learner's certificates")
          }
        }
      case .empty:
        ContentUnavailableView {
          Label {
            Text(
              "No certificates yet", tableName: "Certificates",
              comment: "Title when the learner has no certificate")
          } icon: {
            Image(systemName: "rosette")
          }
        } description: {
          Text(
            "Finish a course or a language level and its certificate shows up here, free to print and share. A placement test's result shows up here too.",
            tableName: "Certificates", comment: "How the learner earns certificates")
        } actions: {
          Button {
            router.sheet = nil
            router.showRoot(of: .today)
          } label: {
            Text(
              "Continue learning", tableName: "Certificates",
              comment: "Goes to Today from the empty certificates page")
          }
          .buttonStyle(.mainAction)
        }
        .lonePage()
      case .failed(let error):
        PracticeLoadFailureView(error: error) {
          Task { await store.list.refresh() }
        }
      case .idle, .loading:
        ProgressView()
          .lonePage()
      }
    }
    .navigationTitle(
      Text(
        "Certificates", tableName: "Certificates", comment: "Title of the learner's certificates")
    )
    .loads(store.list)
  }

  private func row(_ certificate: Certificate) -> some View {
    Button {
      open(certificate.id)
    } label: {
      HStack(spacing: 12) {
        CertificatePicture(url: certificate.pictures.screen, size: .thumbnail)
          .frame(width: pictureWidth)
          .accessibilityHidden(true)

        VStack(alignment: .leading, spacing: 2) {
          Text(certificate.facts.name)
            .foregroundStyle(.primary)

          Text(certificate.facts.summary)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .disclosureChevron()
    }
  }
}
