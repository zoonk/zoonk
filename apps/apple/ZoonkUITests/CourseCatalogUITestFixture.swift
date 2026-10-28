import Foundation
import XCTest

let courseCatalogUITestSnapshotJSON =
  #"""
  {
    "courses": [
      {
        "categories": ["science"],
        "description": "Discover how roots, stems, and leaves work together to help a plant thrive.",
        "generationStatus": "completed",
        "id": "course-plants",
        "isExam": false,
        "imageURL": null,
        "landingPage": {
          "audience": ["Gardeners who want to know why"],
          "outcomes": ["Explain how water reaches a leaf"],
          "valueProposition": "Grow a plant from root to leaf."
        },
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
        "isExam": false,
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
        "isExam": false,
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
        "isExam": false,
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
        "isExam": false,
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
        "lessons": [
          { "estimatedMinutes": 6, "id": "lesson-meet-roots", "title": "Meet the Roots" },
          { "estimatedMinutes": 7, "id": "lesson-follow-water", "title": "Follow the Water" }
        ],
        "level": "beginner",
        "objectives": ["Explain how roots hold a plant in place"],
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
        "lessons": [
          { "estimatedMinutes": 5, "id": "lesson-capture-light", "title": "Capture the Light" }
        ],
        "level": "intermediate",
        "objectives": [],
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
        "lessons": [],
        "level": "overview",
        "objectives": [],
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
        "estimatedMinutes": 6,
        "id": "lesson-meet-roots",
        "language": "en",
        "position": 0,
        "slug": "meet-the-roots",
        "generationStatus": "completed",
        "title": "Meet the Roots"
      },
      {
        "chapterID": "chapter-roots",
        "courseID": "course-plants",
        "description": "Trace water as it moves from the soil through a plant.",
        "estimatedMinutes": 7,
        "id": "lesson-follow-water",
        "language": "en",
        "position": 1,
        "slug": "follow-the-water",
        "generationStatus": "completed",
        "title": "Follow the Water"
      },
      {
        "chapterID": "chapter-leaves",
        "courseID": "course-plants",
        "description": "Explore how leaves capture sunlight.",
        "estimatedMinutes": 5,
        "id": "lesson-capture-light",
        "language": "en",
        "position": 0,
        "slug": "capture-the-light",
        "generationStatus": "completed",
        "title": "Capture the Light"
      }
    ]
  }
  """#
