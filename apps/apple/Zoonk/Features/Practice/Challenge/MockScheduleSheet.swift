import SwiftUI

struct MockScheduleLink: View {
  @Environment(AppRouter.self) private var router

  let planItemId: String
  let today: String
  var open: (() -> Void)?

  var body: some View {
    Button {
      if let open {
        open()
      } else {
        router.present(.mockSchedule(planItemId: planItemId, today: today))
      }
    } label: {
      Text("Change schedule", tableName: "Today")
    }
    .buttonStyle(.borderless)
  }
}

struct MockScheduleSheet: View {
  @Environment(PracticeStore.self) private var practice
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss
  @State private var dates: Resource<[String]>?
  @State private var selectedDate: String?
  @State private var request = VisitRequest<Bool>()
  let planItemId: String
  let today: String

  var body: some View {
    NavigationStack {
      ZoonkList {
        if let dates {
          switch dates.state {
          case .loaded(let choices):
            ForEach(choices, id: \.self) { date in
              Button {
                save(date)
              } label: {
                Text(verbatim: PlanDate.weekdayDay(date, today: today))
                  .frame(maxWidth: .infinity, alignment: .leading)
                  .contentShape(.rect)
                  .coveredBySpinner(request.isRunning && selectedDate == date, alignment: .trailing)
              }
            }
          case .failed, .empty:
            Button {
              request.run {
                await dates.refresh()
                return nil
              }
            } label: {
              Text("Try again", tableName: "Plan")
            }
          case .idle, .loading: ProgressView()
          }
        }
      }
      .bottomBar {
        if let dates, case .loaded = dates.state {
          VStack {
            if request.outcome == false { FailureLine(message: TodayMainAction.saveFailure) }
            BusyButton(isBusy: request.isRunning && selectedDate == nil) {
              save(nil)
            } label: {
              Text("Skip this mock exam", tableName: "Today")
            }
            .buttonStyle(.outline)
          }
        }
      }
      .disabled(request.isRunning)
      .navigationTitle(Text("Change mock exam date", tableName: "Today"))
      .toolbarTitleDisplayMode(.inline)
      .sheetClose(isDisabled: request.isRunning) { dismiss() }
    }
    .interactiveDismissDisabled(request.isRunning)
    .onAppear {
      if dates == nil { dates = practice.mockScheduleDates(itemId: planItemId) }
    }
    .loads(dates.map { [$0] } ?? [], refreshable: false)
    .onDisappear { request.leave() }
    .presentationDetents([.medium, .large])
  }

  private func save(_ date: String?) {
    selectedDate = date
    request.run {
      let saved = await practice.changeMockSchedule(itemId: planItemId, date: date)
      if saved == false { await dates?.refresh() }
      return saved
    } then: { saved in
      if saved == true {
        dismiss()
        router.showRoot(of: .today)
      }
    }
  }
}

struct MockScheduleNotice: View {
  @Environment(PracticeStore.self) private var practice
  @State private var request = VisitRequest<Bool>()
  let today: String

  var body: some View {
    Group {
      if let change = practice.mockScheduleNotice {
        VStack(alignment: .leading) {
          HStack {
            if let day = change.date {
              Text("Moved to \(PlanDate.weekdayDay(day, today: today))", tableName: "Today")
            } else {
              Text("Mock exam skipped", tableName: "Today")
            }
            Spacer()
            BusyButton(isBusy: request.isRunning) {
              request.run { await practice.undoMockSchedule(change) }
            } label: {
              Text("Undo", tableName: "Plan")
            }
            .buttonStyle(.outline)
            Button(role: .close) { practice.dismissMockScheduleNotice(change) }
              .buttonStyle(.borderless)
          }
          if request.outcome == false { FailureLine(message: TodayMainAction.saveFailure) }
        }
      }
    }
    .onDisappear { request.leave() }
  }
}
