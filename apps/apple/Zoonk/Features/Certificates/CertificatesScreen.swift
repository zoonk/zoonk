import SwiftUI

/// Every certificate the learner earned, newest first, in one list.
struct CertificatesScreen: View {
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
        EmptyCertificates()
      case .idle, .loading, .failed:
        SettingsLoadingState(state: store.list.state) {
          Task { await store.list.refresh() }
        }
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

/// Main's empty page: how certificates are earned, then each goal that can still earn one. The
/// goals arrive after the page, so they join its list below what's already there.
private struct EmptyCertificates: View {
  @Environment(AppRouter.self) private var router
  @Environment(CertificatesStore.self) private var store

  var body: some View {
    List {
      Section {
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
      }
      .listRowBackground(Color.clear)

      if let upNext = store.upNext.value {
        Section {
          ForEach(upNext) { goal in
            UpNextRow(goal: goal)
          }
        } header: {
          Text(
            "Up next", tableName: "Certificates",
            comment: "Heading over the learner's goals that can still earn a certificate")
        }
      }
    }
    // The list too, so pull to refresh also brings back goals that failed to load.
    .loads(store.list, store.upNext)
  }
}

private struct UpNextRow: View {
  let goal: CertificateUpNext

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      VStack(alignment: .leading, spacing: 2) {
        Text(goal.title)

        Group {
          if goal.progress == nil {
            Text(
              "Comes when every skill you practice reaches the next level",
              tableName: "Certificates",
              comment: "Under a language goal on the empty certificates page: when it earns one")
          } else {
            Text(
              "Your certificate comes when you finish the plan", tableName: "Certificates",
              comment: "Under a course goal on the empty certificates page: when it earns one")
          }
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }

      if let progress = goal.progress {
        HStack(spacing: 8) {
          ProgressView(value: progress)
            .tint(.success)
            .accessibilityHidden(true)

          Text(wholePercent(progress * 100))
            .font(.subheadline)
            .monospacedDigit()
        }
      }
    }
    .accessibilityElement(children: .combine)
  }
}
