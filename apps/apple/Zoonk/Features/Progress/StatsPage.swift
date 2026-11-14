import SwiftUI

struct StatsPage<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 28) {
        content
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .scenePadding()
      .frame(maxWidth: 1_100)
      .frame(maxWidth: .infinity)
    }
    .background(Color(.systemBackground))
    .inspectsCharts()
  }
}

struct StatsContent<Value: Equatable & Sendable, Content: View>: View {
  let state: LoadState<Value>
  var hasNumbers: (Value) -> Bool = { _ in true }
  let retry: @MainActor () async -> Void
  @ViewBuilder let content: (Value) -> Content

  var body: some View {
    switch state {
    case .idle, .loading:
      StatsLoading()
    case .loaded(let value) where hasNumbers(value):
      StatsPage {
        content(value)
      }
    case .loaded, .empty:
      StatsEmpty()
    case .failed(let failure):
      StatsFailure(failure: failure, retry: retry)
    }
  }
}

struct StatsEmpty: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "No statistics yet", tableName: "Progress")
      } icon: {
        Image(systemName: "chart.bar")
      }
    } description: {
      Text(
        "They show up after your first lesson.", tableName: "Progress")
    } actions: {
      Button {
        router.showRoot(of: .today)
      } label: {
        Text(
          "Go to Today", tableName: "Progress"
        )
      }
      .buttonStyle(.mainAction)
    }
    .lonePage()
    .background(Color(.systemBackground))
  }
}

/// A spinner, never a skeleton.
struct StatsLoading: View {
  var body: some View {
    ProgressView()
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color(.systemBackground))
      .accessibilityLabel(
        Text(
          "Loading statistics", tableName: "Progress",
          comment: "Spoken while a Statistics page loads"))
  }
}

struct StatsFailure: View {
  let failure: APIError
  let retry: @MainActor () async -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "This page didn't load", tableName: "Progress")
      } icon: {
        Image(systemName: failure == .network ? "wifi.exclamationmark" : "exclamationmark.triangle")
      }
    } description: {
      Text(
        "Check your connection and try again.", tableName: "Progress")
    } actions: {
      Button {
        Task {
          await retry()
        }
      } label: {
        Text("Try again", tableName: "Progress", comment: "Retries loading a Statistics page")
      }
      .buttonStyle(.mainAction)
    }
    .lonePage()
    .background(Color(.systemBackground))
  }
}

struct StatsColumns<Content: View>: View {
  @ScaledMetric private var minimumWidth: Double
  @State private var width = 0.0
  @ViewBuilder let content: Content

  init(minimumWidth: Double, @ViewBuilder content: () -> Content) {
    _minimumWidth = ScaledMetric(wrappedValue: minimumWidth, relativeTo: .body)
    self.content = content()
  }

  var body: some View {
    let layout =
      width >= minimumWidth
      ? AnyLayout(HStackLayout(alignment: .top, spacing: 40))
      : AnyLayout(VStackLayout(alignment: .leading, spacing: 28))

    layout {
      content
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .onGeometryChange(for: Double.self) {
      $0.size.width
    } action: {
      width = $0
    }
  }
}

struct StatsBlock<Trailing: View, Content: View>: View {
  let title: Text
  let trailing: Trailing
  let content: Content

  init(title: Text, trailing: Trailing, @ViewBuilder content: () -> Content) {
    self.title = title
    self.trailing = trailing
    self.content = content()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .firstTextBaseline) {
        title
          .typeStyle(.body.weight(.semibold))
          .accessibilityAddTraits(.isHeader)

        Spacer(minLength: 12)

        trailing
      }

      content
    }
  }
}

extension StatsBlock where Trailing == EmptyView {
  init(title: Text, @ViewBuilder content: () -> Content) {
    self.init(title: title, trailing: EmptyView(), content: content)
  }
}
