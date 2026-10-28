import SwiftUI

/// A course's page in the catalog (main's `LibraryCoursePage`), written for someone who doesn't
/// know Zoonk yet: the course and its ways in, its example plan, who it's for and what it makes
/// them able to do, the full outline with each chapter's place in that plan, and the way in again.
/// The Plan's "See the full course" and Search open it too.
struct CourseView: View {
  @Environment(CourseCatalogStore.self) private var catalog
  @State private var isFeedbackPresented = false

  let course: CourseReference

  var body: some View {
    Group {
      switch catalog.course(id: course.id).state {
      case .idle, .loading:
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .accessibilityLabel(
            Text(
              "Loading course", tableName: "Courses",
              comment: "Accessibility status while a course loads."))
      case .loaded(let detail):
        CourseLandingList(detail: detail)
      case .empty:
        CourseDetailEmptyView()
      case .failed(let failure):
        CatalogFailureRecoveryView(context: .course, failure: failure) {
          await catalog.course(id: course.id).refresh()
        }
      }
    }
    .loads(catalog.course(id: course.id))
    .toolbar {
      CatalogOptionsMenu(
        label: LocalizedStringResource(
          "Course options", table: "Courses", comment: "The course page's menu of options"),
        showFeedback: { isFeedbackPresented = true })
    }
    .sheet(isPresented: $isFeedbackPresented) {
      FeedbackSheet(
        api: FeedbackAPI.live(),
        context: FeedbackContext(contentID: course.id, contentKind: .course))
    }
  }
}

private struct CourseLandingList: View {
  @Environment(CourseCatalogStore.self) private var catalog

  let detail: CourseDetail

  var body: some View {
    let exam = UpcomingExam(course: detail.course)
    let query = CoursePlanExampleQuery(course: detail.course, exam: exam)

    if let query {
      let plan = catalog.examplePlan(query)

      list(exam: exam, estimate: plan.value, minutes: query.dailyMinutes)
        .loads(plan, refreshable: false)
    } else {
      list(exam: exam, estimate: nil, minutes: nil)
    }
  }

  private func list(exam: UpcomingExam?, estimate: CoursePlanEstimate?, minutes: Int?) -> some View
  {
    let estimate = estimate?.hasStudyToShow == true ? estimate : nil

    return List {
      CourseHeroSection(detail: detail, exam: exam)

      if let estimate, let minutes {
        CoursePlanSections(
          chapters: detail.chapters, estimate: estimate, exam: exam, isExam: detail.course.isExam,
          minutes: minutes)
      }

      CourseFitSections(landingPage: detail.course.landingPage)

      CourseOutlineSections(
        detail: detail, estimate: estimate, exam: exam, lead: outlineLead, minutes: minutes)

      CourseClosingSection(courseID: detail.course.id)
    }
    .catalogReadableWidth()
  }

  /// The course's description over the outline, when the hero led with its promise instead.
  private var outlineLead: String? {
    detail.course.landingPage == nil ? nil : catalogText(detail.course.description)
  }
}

/// The course: its mark, its subject (and an exam course's next sitting) over its name, what it
/// makes someone able to do, what Zoonk does with it in one line and the ways in.
private struct CourseHeroSection: View {
  let detail: CourseDetail
  let exam: UpcomingExam?

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 12) {
        CourseMark(detail.course)

        if detail.course.subject != nil || exam != nil {
          HStack(spacing: 8) {
            if let subject = detail.course.subject {
              CourseSubjectLabel(subject: subject)
            }

            if let exam {
              CourseExamEyebrow(exam: exam)
            }
          }
        }

        Text(detail.course.title)
          .font(.largeTitle.bold())
          .accessibilityAddTraits(.isHeader)

        if let promise {
          Text(promise)
            .font(.title3)
            .foregroundStyle(.secondary)
        }

        PlanLine(startsHere: false)

        CatalogStartActions(courseID: detail.course.id, tryLessonID: detail.tryLessonID)
          .padding(.top, 4)
      }
      .listRowBackground(Color.clear)
      .listRowInsets(EdgeInsets())
    }
  }

  /// The page's promise in the course's own words, or its description before they're written.
  private var promise: String? {
    catalogText(detail.course.landingPage?.valueProposition)
      ?? catalogText(detail.course.description)
  }
}

/// An exam course's next sitting, "Exam on Nov 8 and Nov 15 · 26 days left"; "Exam around…" while
/// its days are estimated from past editions.
private struct CourseExamEyebrow: View {
  let exam: UpcomingExam

  var body: some View {
    Group {
      if exam.estimated {
        Text(
          "Exam around \(dates) · \(daysLeft)", tableName: "Courses",
          comment: "An exam course's estimated next sitting: its days, then how long until it")
      } else {
        Text(
          "Exam on \(dates) · \(daysLeft)", tableName: "Courses",
          comment: "An exam course's next sitting: its days, then how long until it")
      }
    }
    .font(.footnote.monospacedDigit())
    .foregroundStyle(.secondary)
  }

  private var dates: String {
    exam.days.compactMap(catalogDay).formatted(.list(type: .and))
  }

  private var daysLeft: String {
    if exam.daysLeft == 0 {
      return String(
        localized: "today", table: "Courses", comment: "An exam's sitting is today, after its days")
    }

    return exam.estimated
      ? String(
        localized: "about \(exam.daysLeft) days left", table: "Courses",
        comment: "How long until an exam's estimated sitting")
      : String(
        localized: "\(exam.daysLeft) days left", table: "Courses",
        comment: "How long until an exam's sitting")
  }
}

/// A calendar day as core sends it ("2026-11-08") written as its day and month, "Nov 8", read at
/// UTC midnight so no time zone moves it to another day.
func catalogDay(_ isoDate: String) -> String? {
  let style = Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day()

  guard let date = try? style.parse(isoDate) else {
    return nil
  }

  var format = Date.FormatStyle.dateTime.month(.abbreviated).day()
  format.timeZone = .gmt
  return date.formatted(format)
}

/// What Zoonk does with the page's course, in one line: a plan that starts at the reader's level,
/// or at the page's chapter (`startsHere`), and fits their schedule, after the Plan's map.
struct PlanLine: View {
  let startsHere: Bool

  var body: some View {
    Label {
      if startsHere {
        Text(
          "With Zoonk, your plan starts at this chapter and fits your schedule.",
          tableName: "Courses", comment: "On a chapter's page, what Zoonk does with it")
      } else {
        Text(
          "With Zoonk, your plan starts at your level and fits your schedule.",
          tableName: "Courses", comment: "On a course's page, what Zoonk does with it")
      }
    } icon: {
      Image(systemName: "map")
    }
    .font(.subheadline)
    .foregroundStyle(.secondary)
  }
}

/// Whether the course fits the reader, in its own words: who it's for, then what it makes them
/// able to do. Nothing before the course's details are written.
private struct CourseFitSections: View {
  let landingPage: CourseLandingPage?

  var body: some View {
    if let audience = landingPage?.audience, !audience.isEmpty {
      Section {
        ForEach(audience, id: \.self) { line in
          Text(line)
        }
      } header: {
        Text("Who it's for", tableName: "Courses", comment: "Header of who a course is for")
      }
    }

    if let outcomes = landingPage?.outcomes, !outcomes.isEmpty {
      Section {
        ForEach(outcomes, id: \.self) { line in
          CheckLine(text: line)
        }
      } header: {
        Text(
          "What you'll be able to do", tableName: "Courses",
          comment: "Header of what a course makes someone able to do")
      }
    }
  }
}

/// A line after a tick: what a course or a chapter makes someone able to do.
struct CheckLine: View {
  let text: String

  var body: some View {
    Label {
      Text(text)
    } icon: {
      Image(systemName: "checkmark")
        .foregroundStyle(.success)
    }
  }
}

/// The page's last word: the one way in again.
private struct CourseClosingSection: View {
  let courseID: String

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "Start today, at your level", tableName: "Courses", comment: "A course page's last call"
        )
        .font(.title2.weight(.semibold))
        .accessibilityAddTraits(.isHeader)

        Text(
          "A few quick questions, then your plan and your first lesson.", tableName: "Courses",
          comment: "Under a course page's last call"
        )
        .foregroundStyle(.secondary)

        CatalogStartActions(courseID: courseID, tryLessonID: nil)
          .padding(.top, 8)
      }
      .listRowBackground(Color.clear)
      .listRowInsets(EdgeInsets())
    }
  }
}

private struct CourseDetailEmptyView: View {
  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Course unavailable",
          tableName: "Courses",
          comment: "Title when a course cannot be loaded.")
      } icon: {
        Image(systemName: "book.closed")
      }
    } description: {
      Text(
        "Please return to the catalog and choose another course.",
        tableName: "Courses",
        comment: "Guidance when a course request returns no content.")
    }
  }
}

extension View {
  /// Keeps a course's or a chapter's page in a readable column on a wide screen, as main's pages
  /// keep their measure, while its background still fills the window.
  func catalogReadableWidth() -> some View {
    modifier(CatalogReadableWidth())
  }
}

private struct CatalogReadableWidth: ViewModifier {
  @ScaledMetric(relativeTo: .body) private var column = 720
  @State private var width: CGFloat = 0

  func body(content: Content) -> some View {
    content
      .safeAreaPadding(.horizontal, max((width - column) / 2, 0))
      .onGeometryChange(for: CGFloat.self, of: \.size.width) { width = $0 }
  }
}
