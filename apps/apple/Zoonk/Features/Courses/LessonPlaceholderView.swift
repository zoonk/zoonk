import SwiftUI

struct LessonPlaceholderView: View {
  let lesson: LessonReference

  var body: some View {
    VStack(spacing: 24) {
      VStack(spacing: 4) {
        Text(lesson.courseTitle)
        Text(lesson.chapterTitle)
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)
      .multilineTextAlignment(.center)

      Text(lesson.title)
        .font(.title.bold())
        .multilineTextAlignment(.center)
        .accessibilityAddTraits(.isHeader)

      ContentUnavailableView {
        Label {
          Text(
            "Lesson player coming soon",
            tableName: "Courses",
            comment:
              "Title on the temporary destination shown before the native lesson player is available."
          )
        } icon: {
          Image(systemName: "play.rectangle.on.rectangle")
        }
      } description: {
        Text(
          "You can keep exploring this course and return when the lesson player is ready.",
          tableName: "Courses",
          comment: "Guidance on the temporary lesson player destination.")
      }
    }
    .frame(maxWidth: 520)
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color(uiColor: .systemBackground))
  }
}
