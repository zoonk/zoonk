import SwiftUI

enum CoursesScope: Hashable {
  case all
  case mine
}

struct CoursesView: View {
  @Binding var scope: CoursesScope
  @State private var allCoursesSearch = ""
  @State private var myCoursesSearch = ""

  let onCreateCourse: () -> Void
  let onSignIn: () -> Void

  var body: some View {
    VStack(spacing: 0) {
      Picker(
        selection: $scope,
        label: Text(
          "Course collection",
          tableName: "Courses",
          comment: "Accessibility label for switching between all courses and My Courses.")
      ) {
        Text(
          "All Courses",
          tableName: "Courses",
          comment: "Segment that shows the public course catalog."
        )
        .tag(CoursesScope.all)

        Text(
          "My Courses",
          tableName: "Courses",
          comment: "Segment that shows the signed-in learner's enrolled courses."
        )
        .tag(CoursesScope.mine)
      }
      .pickerStyle(.segmented)
      .frame(maxWidth: 420)
      .padding(.horizontal, 16)
      .padding(.vertical, 8)

      selectedCourses
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .background(Color(uiColor: .systemBackground))
    .searchable(
      text: searchText,
      placement: .navigationBarDrawer(displayMode: .always),
      prompt: searchPrompt
    )
    .navigationDestination(for: CourseDestination.self) { destination in
      destinationView(destination)
        .navigationTitle(destination.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: destination.showsCompactHeader ? .title : nil)
    }
  }

  private var selectedCourses: some View {
    TabView(selection: $scope) {
      AllCoursesView(
        isSelected: scope == .all,
        searchText: allCoursesSearch,
        onCreateCourse: onCreateCourse
      )
      .tag(CoursesScope.all)

      MyCoursesView(
        isSelected: scope == .mine,
        query: myCoursesSearch,
        onCreateCourse: onCreateCourse,
        onSignIn: onSignIn
      )
      .tag(CoursesScope.mine)
    }
    .tabViewStyle(.page(indexDisplayMode: .never))
  }

  private var searchText: Binding<String> {
    scope == .all ? $allCoursesSearch : $myCoursesSearch
  }

  private var searchPrompt: Text {
    switch scope {
    case .all:
      Text(
        "Search all courses", tableName: "Courses",
        comment: "Searches the public catalog, including chapters.")
    case .mine:
      Text(
        "Search my courses", tableName: "Courses",
        comment: "Searches only the learner's enrolled courses.")
    }
  }

  @ViewBuilder
  private func destinationView(_ destination: CourseDestination) -> some View {
    switch destination {
    case .course(let course):
      CourseView(course: course)
    case .chapter(let chapter):
      ChapterView(chapter: chapter)
    case .lesson(let lesson):
      LessonPlaceholderView(lesson: lesson)
    }
  }
}
