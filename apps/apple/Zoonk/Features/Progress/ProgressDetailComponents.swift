import SwiftUI

struct ProgressDetailLoadStateView<Value, Content>: View
where Value: Equatable & Sendable, Content: View {
  let state: ProgressLoadState<Value>
  let emptyTitle: LocalizedStringResource
  let emptyDescription: LocalizedStringResource
  let systemImage: String
  let retry: @MainActor () async -> Void
  @ViewBuilder let content: (Value) -> Content

  var body: some View {
    switch state {
    case .idle, .loading:
      ProgressDetailLoadingView(systemImage: systemImage)
    case .loaded(let value):
      content(value)
    case .empty:
      ProgressDetailUnavailableView(
        title: emptyTitle,
        description: emptyDescription,
        systemImage: systemImage)
    case .failed(let failure):
      ProgressDetailFailureView(failure: failure, retry: retry)
    }
  }
}

struct ProgressDetailPage<Content: View>: View {
  @ViewBuilder let content: Content

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 24) {
        content
      }
      .frame(maxWidth: 760, alignment: .leading)
      .padding(.horizontal, 20)
      .padding(.vertical, 24)
      .frame(maxWidth: .infinity)
    }
    .background(Color(uiColor: .systemGroupedBackground))
    .scrollBounceBehavior(.basedOnSize)
  }
}

struct ProgressDetailHero: View {
  let title: Text
  let value: Text
  let description: Text
  let systemImage: String
  let tint: Color

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Label {
        title
          .font(.headline)
          .foregroundStyle(.secondary)
      } icon: {
        Image(systemName: systemImage)
          .foregroundStyle(tint)
      }

      value
        .font(.system(.largeTitle, design: .rounded, weight: .bold))
        .contentTransition(.numericText())
        .monospacedDigit()

      description
        .font(.body)
        .foregroundStyle(.secondary)
    }
    .accessibilityElement(children: .combine)
  }
}

struct ProgressDetailSection<Content: View>: View {
  let title: Text
  let subtitle: Text?
  @ViewBuilder let content: Content

  init(title: Text, subtitle: Text? = nil, @ViewBuilder content: () -> Content) {
    self.title = title
    self.subtitle = subtitle
    self.content = content()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      VStack(alignment: .leading, spacing: 4) {
        title
          .font(.title3.bold())

        if let subtitle {
          subtitle
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
      }

      content
    }
    .padding(18)
    .background(.background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
  }
}

struct ProgressDetailMetricGrid<Content: View>: View {
  @ViewBuilder let content: Content

  init(@ViewBuilder content: () -> Content) {
    self.content = content()
  }

  var body: some View {
    LazyVGrid(
      columns: [GridItem(.adaptive(minimum: 160, maximum: 360), spacing: 12)],
      alignment: .leading,
      spacing: 12
    ) {
      content
    }
  }
}

struct ProgressDetailMetric: View {
  let label: Text
  let value: Text
  let systemImage: String
  let tint: Color

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Label {
        label
          .font(.subheadline)
          .foregroundStyle(.secondary)
      } icon: {
        Image(systemName: systemImage)
          .foregroundStyle(tint)
      }

      Spacer(minLength: 10)

      value
        .font(.title2.bold())
        .monospacedDigit()
    }
    .padding(16)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    .accessibilityElement(children: .combine)
  }
}

struct ProgressDetailExplanation: View {
  let title: Text
  let description: Text
  let systemImage: String
  let tint: Color

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Divider()

      Label {
        title
          .font(.headline)
      } icon: {
        Image(systemName: systemImage)
          .foregroundStyle(tint)
      }
      .padding(.top, 8)

      description
        .foregroundStyle(.secondary)
    }
  }
}

struct ProgressDetailNoChartData: View {
  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Not enough data yet",
          tableName: "Progress",
          comment: "Title shown when a progress chart has no recorded data")
      } icon: {
        Image(systemName: "chart.xyaxis.line")
      }
    } description: {
      Text(
        "Keep learning to see your trend here.",
        tableName: "Progress",
        comment: "Guidance shown when a progress chart has no recorded data")
    }
  }
}

private struct ProgressDetailLoadingView: View {
  let systemImage: String

  var body: some View {
    ProgressDetailPage {
      ProgressDetailHero(
        title: Text(verbatim: "Loading"),
        value: Text(verbatim: "88%"),
        description: Text(verbatim: "Your progress will appear here."),
        systemImage: systemImage,
        tint: .secondary)

      ProgressDetailSection(title: Text(verbatim: "Progress over time")) {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .fill(.quaternary)
          .frame(height: 220)
      }

      ProgressDetailMetricGrid {
        ProgressDetailMetric(
          label: Text(verbatim: "Progress"),
          value: Text(verbatim: "88"),
          systemImage: "chart.bar",
          tint: .secondary)
        ProgressDetailMetric(
          label: Text(verbatim: "Learning"),
          value: Text(verbatim: "24"),
          systemImage: "book.closed",
          tint: .secondary)
      }
    }
    .redacted(reason: .placeholder)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      Text(
        "Loading progress",
        tableName: "Progress",
        comment: "Accessibility label for a loading progress detail screen"))
  }
}

private struct ProgressDetailUnavailableView: View {
  let title: LocalizedStringResource
  let description: LocalizedStringResource
  let systemImage: String

  var body: some View {
    ContentUnavailableView {
      Label(title, systemImage: systemImage)
    } description: {
      Text(description)
    }
  }
}

private struct ProgressDetailFailureView: View {
  let failure: ProgressFailure
  let retry: @MainActor () async -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        failureTitle
      } icon: {
        Image(systemName: failure == .network ? "wifi.exclamationmark" : "exclamationmark.triangle")
      }
    } description: {
      failureDescription
    } actions: {
      Button {
        Task {
          await retry()
        }
      } label: {
        Text(
          "Try again",
          tableName: "Progress",
          comment: "Retries loading a progress detail screen")
      }
      .buttonStyle(.borderedProminent)
    }
  }

  private var failureTitle: Text {
    switch failure {
    case .network:
      Text(
        "You're offline",
        tableName: "Progress",
        comment: "Title shown when progress cannot load without a network connection")
    case .unavailable:
      Text(
        "Progress unavailable",
        tableName: "Progress",
        comment: "Title shown when progress cannot load because of a service error")
    }
  }

  private var failureDescription: Text {
    switch failure {
    case .network:
      Text(
        "Check your connection and try again.",
        tableName: "Progress",
        comment: "Recovery guidance for a progress network error")
    case .unavailable:
      Text(
        "We couldn't load this progress right now. Try again in a moment.",
        tableName: "Progress",
        comment: "Recovery guidance for a progress service error")
    }
  }
}
