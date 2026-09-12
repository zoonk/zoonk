import SwiftUI

struct ChapterOptionalPractice: View {
  let detail: ChapterDetail
  let course: Course
  let chapter: CourseChapter

  var body: some View {
    if !sources.isEmpty || !reviews.isEmpty {
      DisclosureGroup {
        ForEach(sources) { lesson in
          Link(destination: practiceURL(lesson)) {
            VStack(alignment: .leading, spacing: 4) {
              Text(lesson.displayTitle()).foregroundStyle(.primary)
              Label {
                Text(
                  "Practice on web", tableName: "Courses",
                  comment: "Opens optional practice for this teaching lesson on the website")
              } icon: {
                Image(systemName: "arrow.up.right")
              }
              .font(.subheadline)
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
          }
        }
        ForEach(reviews) { lesson in
          Link(
            destination: chapterURL.appending(component: "l").appending(component: lesson.slug)
          ) {
            Label {
              reviewTitle(lesson)
            } icon: {
              Image(systemName: "arrow.up.right")
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .multilineTextAlignment(.leading)
          }
        }
      } label: {
        Text(
          "Optional practice", tableName: "Courses",
          comment: "Collapsed section for optional checks and scenarios")
      }
    }
  }

  private var sources: [CourseLesson] {
    detail.primaryLessons.filter { detail.optionalActivities?.sourceIDs.contains($0.id) == true }
  }

  private var reviews: [CourseLesson] {
    detail.optionalActivities?.reviews ?? []
  }

  private func reviewTitle(_ lesson: CourseLesson) -> Text {
    if catalogText(lesson.title) == nil, reviews.count > 1,
      let index = reviews.firstIndex(where: { $0.id == lesson.id })
    {
      return Text(
        "Review \(index + 1)", tableName: "Courses",
        comment: "Distinguishes optional reviews when a chapter has more than one without a title")
    }
    return Text(lesson.displayTitle())
  }

  private var chapterURL: URL {
    courseWebURL(course).appending(component: "ch").appending(component: chapter.slug)
  }

  private func practiceURL(_ lesson: CourseLesson) -> URL {
    var components = URLComponents(url: chapterURL, resolvingAgainstBaseURL: false)!
    components.fragment = "optional-\(lesson.id)"
    return components.url!
  }
}
