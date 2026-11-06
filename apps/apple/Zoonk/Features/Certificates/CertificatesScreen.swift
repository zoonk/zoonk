import SwiftUI

/// Every certificate the learner earned, newest first, in one list. Without Plus, one notice says
/// what Plus does for them, and the locked ones carry its mark.
struct CertificatesScreen: View {
  @Environment(CertificatesStore.self) private var store
  @ScaledMetric(relativeTo: .body) private var pictureWidth = 72.0

  let open: (_ code: String) -> Void

  var body: some View {
    Group {
      switch store.list.state {
      case .loaded(let certificates):
        ZoonkList {
          CertificatesHeader(count: certificates.count)
          CertificatesPlusSection()

          Section {
            ForEach(certificates) { certificate in
              row(certificate)
            }
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
    .navigationTitle(CertificatesHeader.title)
    .barTitleAfterHero(
      String(
        localized: "Certificates", table: "Certificates",
        comment: "Title of the learner's certificates")
    )
    .loads(store.list)
  }

  private func row(_ certificate: OwnedCertificate) -> some View {
    Button {
      open(certificate.id)
    } label: {
      ListRow(
        Text(certificate.facts.name), description: Text(certificate.facts.summary),
        alignment: .center
      ) {
        Group {
          switch certificate {
          case .issued(let issued):
            CertificatePicture(url: issued.pictures.screen, size: .thumbnail)
          case .locked(let facts):
            LockedCertificateCard(facts: facts, size: .thumbnail)
          }
        }
        .frame(width: pictureWidth)
        .accessibilityHidden(true)
      } trailing: {
        if certificate.facts.locked {
          PlusMark()
        }
      }
      .disclosureChevron()
    }
  }
}

/// The sidebar's Certificates on iPad, where a certificate opens on the tab's own stack rather than
/// the account sheet's.
struct CertificatesTabScreen: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    CertificatesScreen { code in
      router.open(.certificate(code: code))
    }
  }
}

/// Main's `CertificatesHeader`: how many there are, the page's title and what earns a certificate.
private struct CertificatesHeader: View {
  static let title = Text(
    "Certificates", tableName: "Certificates", comment: "Title of the learner's certificates")

  /// Nil while there are none.
  var count: Int?

  var body: some View {
    Section {
      PageHeader(
        Self.title,
        eyebrow: count.map {
          Text(
            "\($0) certificates", tableName: "Certificates",
            comment: "Over the learner's certificates: how many they have")
        },
        supporting: Text(
          "A certificate for every level and plan you finish.", tableName: "Certificates",
          comment: "Under the learner's certificates: what earns one")
      )
      .eyebrowAsWritten()
    }
  }
}

/// While the learner isn't on Plus, in the empty state too.
private struct CertificatesPlusSection: View {
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    if let tier = learner.summary.value?.tier, tier != .plus {
      Section {
        CertificatePlusNotice(isList: true)
      }
    }
  }
}

/// Main's empty page: a placeholder certificate, how certificates are earned, then each goal that
/// can still earn one. The goals arrive after the page, so they join its list below what's there.
private struct EmptyCertificates: View {
  @Environment(AppRouter.self) private var router
  @Environment(CertificatesStore.self) private var store

  var body: some View {
    ZoonkList {
      CertificatesHeader()
      CertificatesPlusSection()

      Section {
        VStack(alignment: .leading, spacing: 6) {
          GhostCertificate()
            .frame(maxWidth: 416)
            .padding(.bottom, 18)

          Text(
            "No certificates yet", tableName: "Certificates",
            comment: "Title when the learner has no certificate"
          )
          .typeStyle(.reading.weight(.semibold))
          .foregroundStyle(Color(.foreground))
          .accessibilityAddTraits(.isHeader)

          Text(
            "Your certificates show up here when you finish a level or a plan.",
            tableName: "Certificates", comment: "How the learner earns certificates"
          )
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)

          Button {
            router.sheet = nil
            router.showRoot(of: .today)
          } label: {
            Text(
              "Continue learning", tableName: "Certificates",
              comment: "Goes to Today from the empty certificates page")
          }
          .buttonStyle(.mainAction)
          .controlSize(.large)
          .padding(.top, 14)
        }
        .listRowSeparator(.hidden)
      }

      if let upNext = store.upNext.value, !upNext.isEmpty {
        Section {
          ForEach(upNext) { goal in
            UpNextRow(goal: goal)
          }
        } header: {
          SectionTitle(
            Text(
              "Up next", tableName: "Certificates",
              comment: "Heading over the learner's goals that can still earn a certificate"))
        }
      }
    }
    // The list too, so pull to refresh also brings back goals that failed to load.
    .loads(store.list, store.upNext)
  }
}

/// Main's `GhostCertificate`: shapes that stand for a certificate without saying one, so nothing
/// reads as a real one.
private struct GhostCertificate: View {
  private static let bars: [(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat)] = [
    (0.07, 0.10, 0.16, 0.05),
    (0.07, 0.30, 0.28, 0.04),
    (0.07, 0.38, 0.52, 0.10),
    (0.07, 0.53, 0.40, 0.06),
    (0.07, 0.84, 0.46, 0.05),
    (0.83, 0.82, 0.10, 0.14),
  ]

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)

    Canvas { context, size in
      func bar(_ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ height: CGFloat) -> Path {
        Path(
          roundedRect: CGRect(
            x: x * size.width, y: y * size.height, width: width * size.width,
            height: height * size.height),
          cornerRadius: 4, style: .continuous)
      }

      for shown in Self.bars {
        context.fill(
          bar(shown.x, shown.y, shown.width, shown.height), with: .color(.surface3))
      }

      context.fill(bar(0.07, 0.76, 0.86, 0.02), with: .color(.input))
    }
    .aspectRatio(CertificateFacts.aspectRatio, contentMode: .fit)
    .background(Color(.ground), in: shape)
    .overlay(shape.strokeBorder(.input, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
    .accessibilityHidden(true)
  }
}

/// Main's `UpNextRow`: the goal, when it earns its certificate, and how much of its plan is done.
private struct UpNextRow: View {
  let goal: CertificateUpNext

  @ScaledMetric(relativeTo: .caption) private var meterWidth = 64.0

  var body: some View {
    ListRow(Text(goal.title), description: description) {
      GoalMark(
        title: goal.title, flag: goal.targetLanguage.flatMap(languageFlagCode).flatMap(flagEmoji))
    } trailing: {
      if let progress = goal.progress {
        HStack(spacing: 8) {
          Meter(value: progress)
            .frame(width: meterWidth)
            .accessibilityHidden(true)

          Text(wholePercent(progress * 100))
            .foregroundStyle(Color(.foreground))
        }
      }
    }
    .accessibilityElement(children: .combine)
  }

  private var description: Text {
    goal.progress == nil
      ? Text(
        "Comes when every skill you practice reaches the next level", tableName: "Certificates",
        comment: "Under a language goal on the empty certificates page: when it earns one")
      : Text(
        "Your certificate comes when you finish the plan", tableName: "Certificates",
        comment: "Under a course goal on the empty certificates page: when it earns one")
  }
}
