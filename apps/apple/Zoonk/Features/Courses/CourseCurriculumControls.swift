import SwiftUI

struct CourseCurriculumControls: View {
  let detail: CourseDetail
  @Binding var showsFullCourse: Bool
  @Binding var level: String

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .firstTextBaseline) {
        Text(title)
          .font(.headline)
          .accessibilityAddTraits(.isHeader)
        Spacer(minLength: 12)
        if !detail.availableLevels.isEmpty {
          Button {
            showsFullCourse.toggle()
          } label: {
            Text(
              showsFullCourse
                ? backTitle
                : LocalizedStringResource(
                  "Full course", table: "Courses", comment: "Shows the entire course curriculum")
            )
            .font(.subheadline)
          }
          .frame(minHeight: 44)
        }
      }
      if showsFullCourse && detail.availableLevels.count > 1 {
        Picker(selection: $level) {
          Text(
            "All levels", tableName: "Courses", comment: "Shows chapters across every course level"
          ).tag("all")
          ForEach(detail.availableLevels, id: \.self) { value in
            Text(courseLevelTitle(value)).tag(value)
          }
        } label: {
          Text(
            "Course level", tableName: "Courses", comment: "Picker label for browsing course levels"
          )
        }
        .pickerStyle(.menu)
      }
    }
  }

  private var backTitle: LocalizedStringResource {
    detail.learningPath?.hasPlan == true
      ? LocalizedStringResource(
        "Your path", table: "Courses", comment: "Returns to the saved learning path")
      : LocalizedStringResource(
        "Starting chapters", table: "Courses",
        comment: "Returns to the introductory chapter preview")
  }

  private var title: LocalizedStringResource {
    if showsFullCourse {
      return LocalizedStringResource(
        "Full course", table: "Courses", comment: "Heading for the entire course curriculum")
    }
    if detail.learningPath?.depth == "focused" {
      return LocalizedStringResource(
        "Your learning path", table: "Courses",
        comment: "Heading for chapters selected for the learner's goal")
    }
    return courseLevelTitle(detail.selectedChapters.first?.level ?? "")
  }
}

struct CourseWebLearningLink: View {
  let course: Course
  let isResuming: Bool

  var body: some View {
    Link(destination: destination) {
      Label {
        Text(
          isResuming
            ? LocalizedStringResource(
              "Continue on web", table: "Courses",
              comment: "Opens the website to resume an updated learning path")
            : LocalizedStringResource(
              "Start on web", table: "Courses", comment: "Opens the website for guided course setup"
            ))
      } icon: {
        Image(systemName: "arrow.up.right")
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.borderedProminent)
    .controlSize(.large)
  }

  private var destination: URL {
    var url = courseWebURL(course)
    if !isResuming { url.append(component: "start") }
    return url
  }
}

func courseWebURL(_ course: Course) -> URL {
  var url = URL(string: "https://www.zoonk.com")!
  for component in [course.language, "b", course.resolvedBrandSlug, "c", course.slug] {
    url.append(component: component)
  }
  return url
}
