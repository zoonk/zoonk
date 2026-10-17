import Foundation
import XCTest

/// Keeps a pending page visible during pull-to-refresh, including a production-sized page on iPad.
func courseCatalogPaginationUITestSnapshotJSON(pageSize: Int) throws -> String {
  var snapshot = try XCTUnwrap(
    try JSONSerialization.jsonObject(with: Data(courseCatalogUITestSnapshotJSON.utf8))
      as? [String: Any])
  let templates = try XCTUnwrap(snapshot["courses"] as? [[String: Any]])
  let template = try XCTUnwrap(templates.first)
  let courses = (1...pageSize).map { index in
    var course = template
    course["id"] = "enrolled-course-\(index)"
    course["slug"] = "enrolled-course-\(index)"
    course["title"] = String(format: "Enrolled Course %02d", index)
    return course
  }
  snapshot["courses"] = courses
  snapshot["enrolledCourseIDs"] = courses.compactMap { $0["id"] as? String }
  snapshot["holdsFirstMyCoursesPagination"] = true
  snapshot["myCoursesPageSize"] = pageSize
  let data = try JSONSerialization.data(withJSONObject: snapshot)
  return String(decoding: data, as: UTF8.self)
}

let courseCatalogUITestSnapshotJSON =
  #"""
  {
    "completedLessonIDs": ["lesson-meet-roots"],
    "enrolledCourseIDs": ["course-plants", "course-oceans"],
    "personalCourses": [
      {
        "description": "Keep private observations and experiments together.",
        "id": "course-field-notes",
        "imageURL": null,
        "language": "en",
        "organization": null,
        "slug": "my-backyard-field-notes",
        "title": "My Backyard Field Notes"
      }
    ],
    "courses": [
      {
        "categories": ["science"],
        "description": "Discover how roots, stems, and leaves work together to help a plant thrive.",
        "generationStatus": "completed",
        "id": "course-plants",
        "imageURL": null,
        "language": "en",
        "organization": {
          "id": "organization-ai",
          "logoURL": null,
          "name": "Zoonk AI",
          "slug": "ai"
        },
        "slug": "how-plants-grow",
        "targetLanguage": null,
        "title": "How Plants Grow"
      },
      {
        "categories": ["science"],
        "description": "Explore ocean habitats from sunlit shores to the deep sea.",
        "generationStatus": "completed",
        "id": "course-oceans",
        "imageURL": null,
        "language": "en",
        "organization": {
          "id": "organization-zoonk",
          "logoURL": null,
          "name": "Zoonk",
          "slug": "zoonk"
        },
        "slug": "ocean-worlds",
        "targetLanguage": null,
        "title": "Ocean Worlds"
      },
      {
        "categories": ["math"],
        "description": "Build confidence with the numbers and patterns you meet every day.",
        "generationStatus": "completed",
        "id": "course-numbers",
        "imageURL": null,
        "language": "en",
        "organization": {
          "id": "organization-zoonk",
          "logoURL": null,
          "name": "Zoonk",
          "slug": "zoonk"
        },
        "slug": "everyday-numbers",
        "targetLanguage": null,
        "title": "Everyday Numbers"
      },
      {
        "categories": ["science"],
        "description": "Find planets and constellations with your own eyes.",
        "generationStatus": "running",
        "id": "course-night-sky",
        "imageURL": null,
        "language": "en",
        "organization": {
          "id": "organization-ai",
          "logoURL": null,
          "name": "Zoonk AI",
          "slug": "ai"
        },
        "slug": "night-sky-basics",
        "targetLanguage": null,
        "title": "Night Sky Basics"
      },
      {
        "categories": [],
        "description": "Keep private observations and experiments together.",
        "generationStatus": "completed",
        "id": "course-field-notes",
        "imageURL": null,
        "language": "en",
        "organization": null,
        "slug": "my-backyard-field-notes",
        "targetLanguage": null,
        "title": "My Backyard Field Notes"
      }
    ],
    "chapters": [
      {
        "courseID": "course-plants",
        "description": "See how plants anchor themselves and carry water from the soil.",
        "generationStatus": "completed",
        "id": "chapter-roots",
        "language": "en",
        "lessonCount": 2,
        "level": "beginner",
        "position": 0,
        "slug": "roots-and-water",
        "title": "Roots and Water"
      },
      {
        "courseID": "course-plants",
        "description": "Learn how leaves turn light into the energy a plant needs.",
        "generationStatus": "completed",
        "id": "chapter-leaves",
        "language": "en",
        "lessonCount": 1,
        "level": "intermediate",
        "position": 1,
        "slug": "leaves-and-light",
        "title": "Leaves and Light"
      },
      {
        "courseID": "course-field-notes",
        "description": "Notice which birds visit the garden and when.",
        "generationStatus": "completed",
        "id": "chapter-birds",
        "language": "en",
        "lessonCount": 0,
        "level": "overview",
        "position": 0,
        "slug": "backyard-birds",
        "title": "Backyard Birds"
      }
    ],
    "lessons": [
      {
        "chapterID": "chapter-roots",
        "courseID": "course-plants",
        "description": "Meet the root structures that hold a plant in place.",
        "id": "lesson-meet-roots",
        "language": "en",
        "position": 0,
        "slug": "meet-the-roots",
        "title": "Meet the Roots"
      },
      {
        "chapterID": "chapter-roots",
        "courseID": "course-plants",
        "description": "Trace water as it moves from the soil through a plant.",
        "id": "lesson-follow-water",
        "language": "en",
        "position": 1,
        "slug": "follow-the-water",
        "title": "Follow the Water"
      },
      {
        "chapterID": "chapter-leaves",
        "courseID": "course-plants",
        "description": "Explore how leaves capture sunlight.",
        "id": "lesson-capture-light",
        "language": "en",
        "position": 0,
        "slug": "capture-the-light",
        "title": "Capture the Light"
      }
    ]
  }
  """#
