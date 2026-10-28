import SwiftUI

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
  @Environment(LearnerSummaryStore.self) private var learner

  let detail: CourseDetail

  var body: some View {
    PaneSplit {
      List {
        pitch
      }
    } secondary: {
      List {
        contents
      }
    } single: {
      List {
        pitch
        contents
      }
    }
  }

  @ViewBuilder
  private var pitch: some View {
    let example = detail.course.examplePlan

    if let edition = detail.course.edition(in: catalog.language) {
      EditionNotice(edition: edition)
    }

    CourseHeroSection(detail: detail, exam: example?.exam, follows: follows)

    if let pace = example?.pace {
      CoursePlanSections(
        chapters: detail.chapters, estimate: pace.estimate, exam: example?.exam,
        isExam: detail.course.isExam, minutes: pace.minutes)
    }
  }

  @ViewBuilder
  private var contents: some View {
    let example = detail.course.examplePlan

    CourseFitSections(landingPage: detail.course.landingPage)

    CourseOutlineSections(
      detail: detail, estimate: example?.pace?.estimate, exam: example?.exam,
      lead: outlineLead, minutes: example?.pace?.minutes)

    CourseClosingSection(courseID: detail.course.id, follows: follows)
  }

  private var follows: Bool {
    learner.summary.value?.followsCourse(detail.course.id) ?? false
  }

  private var outlineLead: String? {
    detail.course.landingPage == nil ? nil : catalogText(detail.course.description)
  }
}

extension LearnerSummary {
  /// Its page offers "Continue your plan" then, since starting it again would only lead back to
  /// that goal.
  func followsCourse(_ courseID: String) -> Bool {
    goals.contains { goal in
      goal.courseID == courseID && goal.status == .active && goal.kind != .explain
    }
  }
}

private struct EditionNotice: View {
  let edition: CourseEdition

  var body: some View {
    Section {
      NavigationLink(
        value: CourseDestination.course(CourseReference(id: edition.id, title: edition.title))
      ) {
        Label {
          Text(
            "This course is also available in your language.", tableName: "Courses",
            comment: "Links a course page in another language to its edition in the reader's")
        } icon: {
          Image(systemName: "translate")
        }
      }
    }
  }
}

private struct CourseHeroSection: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  let detail: CourseDetail
  let exam: CoursePlanExample.Exam?
  let follows: Bool

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 12) {
        CourseMark(detail.course)

        if detail.course.subject != nil || exam != nil {
          let layout =
            dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 6))
            : AnyLayout(HStackLayout(spacing: 8))

          layout {
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
          .fixedSize(horizontal: false, vertical: true)
          .accessibilityAddTraits(.isHeader)

        if let promise {
          Text(promise)
            .font(.title3)
            .foregroundStyle(.secondary)
        }

        PlanLine(startsHere: false)

        CatalogStartActions(
          courseID: detail.course.id, continues: follows, tryLessonID: detail.tryLessonID
        )
        .padding(.top, 4)
      }
      .listRowBackground(Color.clear)
    }
  }

  private var promise: String? {
    catalogText(detail.course.landingPage?.valueProposition)
      ?? catalogText(detail.course.description)
  }
}

private struct CourseExamEyebrow: View {
  let exam: CoursePlanExample.Exam

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

/// Read at UTC midnight, so no time zone moves it to another day.
func catalogDay(_ isoDate: String) -> String? {
  let style = Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day()

  guard let date = try? style.parse(isoDate) else {
    return nil
  }

  var format = Date.FormatStyle.dateTime.month(.abbreviated).day()
  format.timeZone = .gmt
  return date.formatted(format)
}

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

private struct CourseClosingSection: View {
  let courseID: String
  let follows: Bool

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Group {
          if follows {
            Text(
              "Your plan follows this course", tableName: "Courses",
              comment: "A course page's last call for a learner whose goal follows the course")
          } else {
            Text(
              "Start today, at your level", tableName: "Courses",
              comment: "A course page's last call")
          }
        }
        .font(.title2.weight(.semibold))
        .accessibilityAddTraits(.isHeader)

        if !follows {
          Text(
            "A few quick questions, then your plan and your first lesson.", tableName: "Courses",
            comment: "Under a course page's last call"
          )
          .foregroundStyle(.secondary)
        }

        CatalogStartActions(courseID: courseID, continues: follows, tryLessonID: nil)
          .padding(.top, 8)
      }
      .listRowBackground(Color.clear)
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
