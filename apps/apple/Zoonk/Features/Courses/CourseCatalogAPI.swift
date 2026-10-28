import Foundation
import OpenAPIRuntime

protocol CourseCatalogAPIClient: Sendable {
  func countCourses(language: String) async throws -> CourseCategoryCounts
  func listCourses(query: CourseCatalogQuery) async throws -> CourseCatalogPage
  func getCourse(id: String) async throws -> Course
  func getChapter(_ key: CatalogChapterKey) async throws -> CourseChapter
  func listCourseChapters(courseID: String) async throws -> [CourseChapter]
  func listChapterLessons(_ key: CatalogChapterKey) async throws -> [CourseLesson]
  func searchCatalog(query: CatalogSearchQuery) async throws -> CatalogSearchResults
}

struct CourseCatalogAPI: CourseCatalogAPIClient, @unchecked Sendable {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  func countCourses(language: String) async throws -> CourseCategoryCounts {
    try await clients.perform(token: nil) { client in
      let output = try await client.listCourseCategoryCounts(
        .init(query: .init(language: language)))

      switch output {
      case .ok(let response):
        let payload = try response.body.json

        return CourseCategoryCounts(
          counts: Dictionary(
            payload.categories.compactMap { item in
              CourseCategory(rawValue: item.category.rawValue).map { ($0, item.courseCount) }
            },
            uniquingKeysWith: +),
          total: payload.total)
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func listCourses(query: CourseCatalogQuery) async throws -> CourseCatalogPage {
    try await clients.perform(token: nil) { client in
      let output = try await client.listCourses(
        .init(
          query: .init(
            category: query.category.map(makeGeneratedCourseCategory),
            cursor: query.cursor,
            language: query.language,
            limit: query.limit)))

      switch output {
      case .ok(let response):
        return makeCourseCatalogPage(try response.body.json)
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func getCourse(id: String) async throws -> Course {
    try await clients.perform(token: nil) { client in
      let output = try await client.getCourse(.init(path: .init(courseId: id)))

      switch output {
      case .ok(let response):
        return makeCourse(try response.body.json)
      case .notFound:
        throw APIError.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  /// Reads the chapter as the given course places it. A course that doesn't place the chapter is
  /// not found.
  func getChapter(_ key: CatalogChapterKey) async throws -> CourseChapter {
    try await clients.perform(token: nil) { client in
      let output = try await client.getChapter(
        .init(path: .init(chapterId: key.chapterID), query: .init(courseId: key.courseID)))

      switch output {
      case .ok(let response):
        return makeCourseChapter(try response.body.json)
      case .notFound:
        throw APIError.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func listCourseChapters(courseID: String) async throws -> [CourseChapter] {
    try await clients.perform(token: nil) { client in
      let output = try await client.listCourseChapters(
        .init(path: .init(courseId: courseID)))

      switch output {
      case .ok(let response):
        return try response.body.json.data.map(makeCourseChapter)
      case .notFound:
        throw APIError.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func listChapterLessons(_ key: CatalogChapterKey) async throws -> [CourseLesson] {
    try await clients.perform(token: nil) { client in
      let output = try await client.listChapterLessons(
        .init(path: .init(chapterId: key.chapterID), query: .init(courseId: key.courseID)))

      switch output {
      case .ok(let response):
        return try response.body.json.data.map(makeCourseLesson)
      case .notFound:
        throw APIError.notFound
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }

  func searchCatalog(query: CatalogSearchQuery) async throws -> CatalogSearchResults {
    try await clients.perform(token: nil) { client in
      let output = try await client.searchCatalog(
        .init(query: .init(language: query.language, query: query.query)))

      switch output {
      case .ok(let response):
        return makeCatalogSearchResults(try response.body.json)
      case .badRequest, .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }
}

private func makeGeneratedCourseCategory(
  _ category: CourseCategory
) -> Operations.ListCourses.Input.Query.CategoryPayload {
  switch category {
  case .arts: .arts
  case .business: .business
  case .communication: .communication
  case .culture: .culture
  case .economics: .economics
  case .engineering: .engineering
  case .exams: .exams
  case .geography: .geography
  case .health: .health
  case .history: .history
  case .languages: .languages
  case .law: .law
  case .math: .math
  case .science: .science
  case .society: .society
  case .tech: .tech
  }
}

private func makeCourseCatalogPage(
  _ payload: Operations.ListCourses.Output.Ok.Body.JsonPayload
) -> CourseCatalogPage {
  CourseCatalogPage(
    courses: payload.data.map(makeCourseSummary),
    hasMore: payload.pagination.hasMore,
    nextCursor: payload.pagination.nextCursor)
}

private func makeCourseSummary(
  _ payload: Components.Schemas.CourseResult
) -> CourseSummary {
  CourseSummary(
    description: payload.description,
    estimatedMinutes: payload.estimatedMinutes,
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    language: payload.language,
    languageFlag: payload.languageFlag,
    lessonCount: payload.lessonCount,
    organization: makeCourseOrganization(payload.organization),
    slug: payload.slug,
    subject: payload.subject.flatMap { CourseCategory(rawValue: $0.rawValue) },
    targetLanguage: payload.targetLanguage,
    title: payload.title)
}

private func makeCourse(
  _ payload: Components.Schemas.CourseResource
) -> Course {
  Course(
    categories: payload.categories.map(makeCourseCategory),
    description: payload.description,
    examplePlan: payload.examplePlan.map { makeCoursePlanExample($0.value1) },
    generationStatus: makeCatalogGenerationStatus(payload.generationStatus),
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    isExam: payload.format == .exam,
    landingPage: payload.landingPage.map {
      CourseLandingPage(
        audience: $0.value1.audience, outcomes: $0.value1.outcomes,
        valueProposition: $0.value1.valueProposition)
    },
    language: payload.language,
    languageFlag: payload.languageFlag,
    organization: payload.organization.map { makeCourseOrganization($0.value1) },
    slug: payload.slug,
    targetLanguage: payload.targetLanguage,
    title: payload.title)
}

/// Maps every generated category explicitly, so regenerating the spec with a new category fails the
/// build until the app can title and draw it, instead of failing the course at runtime.
private func makeCourseCategory(
  _ payload: Components.Schemas.CourseResource.CategoriesPayloadPayload
) -> CourseCategory {
  switch payload {
  case .arts: .arts
  case .business: .business
  case .communication: .communication
  case .culture: .culture
  case .economics: .economics
  case .engineering: .engineering
  case .exams: .exams
  case .geography: .geography
  case .health: .health
  case .history: .history
  case .languages: .languages
  case .law: .law
  case .math: .math
  case .science: .science
  case .society: .society
  case .tech: .tech
  }
}

/// Generation states share one set of values across resources. A value the app doesn't know yet
/// shows the content that exists, like a finished course.
private func makeCatalogGenerationStatus<Payload: RawRepresentable>(
  _ payload: Payload
) -> CatalogGenerationStatus where Payload.RawValue == String {
  CatalogGenerationStatus(rawValue: payload.rawValue) ?? .completed
}

func makeCourseOrganization(
  _ payload: Components.Schemas.OrganizationSummary
) -> CourseOrganization {
  CourseOrganization(
    id: payload.id,
    logoURL: payload.logo.flatMap(URL.init(string:)),
    name: payload.name,
    slug: payload.slug)
}

private func makeCourseChapter(
  _ payload: Components.Schemas.CourseChapter
) -> CourseChapter {
  CourseChapter(
    courseID: payload.courseId,
    description: payload.description,
    generationStatus: makeCatalogGenerationStatus(payload.generationStatus),
    id: payload.id,
    language: payload.language,
    lessonCount: payload.lessonCount,
    lessons: payload.lessons.map {
      CourseOutlineLesson(estimatedMinutes: $0.estimatedMinutes, id: $0.id, title: $0.title)
    },
    level: makeCourseLevel(payload.level),
    objectives: payload.objectives,
    position: payload.position,
    slug: payload.slug,
    title: payload.title)
}

private func makeCourseChapter(
  _ payload: Components.Schemas.ChapterResource
) -> CourseChapter {
  CourseChapter(
    courseID: payload.courseId,
    description: payload.description,
    generationStatus: makeCatalogGenerationStatus(payload.generationStatus),
    id: payload.id,
    language: payload.language,
    lessonCount: nil,
    lessons: [],
    level: makeCourseLevel(payload.level),
    objectives: payload.objectives,
    position: payload.position,
    slug: payload.slug,
    title: payload.title)
}

private func makeCourseLesson(
  _ payload: Components.Schemas.LessonResource
) -> CourseLesson {
  CourseLesson(
    chapterID: payload.chapterId,
    courseID: payload.courseId,
    description: payload.description,
    estimatedMinutes: payload.estimatedMinutes,
    generationStatus: makeCatalogGenerationStatus(payload.generationStatus),
    id: payload.id,
    language: payload.language,
    position: payload.position,
    slug: payload.slug,
    title: payload.title)
}

/// Both chapter resources declare the same level values inline, so they map by raw value. A level the
/// app doesn't know yet joins the overview band instead of hiding the chapter.
private func makeCourseLevel<Payload: RawRepresentable>(
  _ payload: Payload
) -> CourseLevel where Payload.RawValue == String {
  CourseLevel(rawValue: payload.rawValue) ?? .overview
}

private func makeCatalogSearchResults(
  _ payload: Components.Schemas.CatalogSearchResponse
) -> CatalogSearchResults {
  CatalogSearchResults(
    chapters: payload.chapters.map(makeCatalogChapterSearchResult),
    courses: payload.courses.map(makeCatalogCourseSearchResult))
}

private func makeCatalogChapterSearchResult(
  _ payload: Components.Schemas.CatalogSearchResponse.ChaptersPayloadPayload
) -> CatalogChapterSearchResult {
  CatalogChapterSearchResult(
    courseID: payload.courseId,
    courseSlug: payload.courseSlug,
    courseTitle: payload.courseTitle,
    description: payload.description,
    id: payload.id,
    language: payload.language,
    organizationSlug: payload.organizationSlug,
    slug: payload.slug,
    title: payload.title)
}

private func makeCatalogCourseSearchResult(
  _ payload: Components.Schemas.CatalogSearchResponse.CoursesPayloadPayload
) -> CatalogCourseSearchResult {
  CatalogCourseSearchResult(
    description: payload.description,
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    language: payload.language,
    organizationSlug: payload.organizationSlug,
    slug: payload.slug,
    title: payload.title)
}

private func makeCoursePlanExample(
  _ payload: Components.Schemas.CoursePlanExample
) -> CoursePlanExample {
  CoursePlanExample(
    exam: payload.exam.map {
      CoursePlanExample.Exam(days: $0.days, daysLeft: $0.daysLeft, estimated: $0.estimated)
    },
    pace: payload.pace.flatMap { pace in
      makeCoursePlanEstimate(pace.estimate).map {
        CoursePlanExample.Pace(estimate: $0, minutes: pace.minutes)
      }
    })
}

/// The estimate's two shapes: to the course's end, or against a date by the exam's areas.
private func makeCoursePlanEstimate(
  _ payload: Components.Schemas.CoursePlanEstimate
) -> CoursePlanEstimate? {
  if let toEnd = payload.value1 {
    return makeCoursePlanEstimate(
      numbers: toEnd.numbers,
      reach: .toEnd(
        weeks: toEnd.weeks,
        endDate: toEnd.endDate,
        firstDay: toEnd.firstDay.map {
          CoursePlanEstimate.FirstDayLesson(
            chapterID: $0.chapterId, dayMinutes: $0.dayMinutes, id: $0.lessonId, title: $0.title)
        }),
      chapters: toEnd.chapters.map {
        CoursePlanEstimate.ChapterPlace(
          area: nil, chapterID: $0.chapterId, endWeek: $0.endWeek, lessonsInPlan: nil,
          studyOrder: nil, week: $0.week,
          workKinds: Set(
            $0.workKinds.compactMap { CoursePlanEstimate.WorkKind(rawValue: $0.rawValue) }))
      },
      unwrittenLessonMinutes: toEnd.workload.unwrittenLessonMinutes)
  }

  guard let byDate = payload.value2 else {
    return nil
  }

  return makeCoursePlanEstimate(
    numbers: byDate.numbers,
    reach: .byDate(
      fittingLessons: byDate.fittingLessons,
      publishedLessons: byDate.publishedContent.lessons,
      areas: byDate.areas.map {
        CoursePlanEstimate.Area(
          fitting: $0.fitting, name: $0.area, plannedMinutes: $0.plannedMinutes,
          quickLessons: $0.quickLessons, total: $0.total, unwrittenMinutes: $0.unwrittenMinutes)
      }),
    chapters: byDate.chapters.map {
      CoursePlanEstimate.ChapterPlace(
        area: $0.area, chapterID: $0.chapterId, endWeek: $0.endWeek,
        lessonsInPlan: $0.lessonsInPlan, studyOrder: $0.studyOrder, week: $0.week,
        workKinds: Set(
          $0.workKinds.compactMap { CoursePlanEstimate.WorkKind(rawValue: $0.rawValue) }))
    },
    unwrittenLessonMinutes: byDate.workload.unwrittenLessonMinutes)
}

private func makeCoursePlanEstimate(
  numbers: Components.Schemas.PlanNumbers,
  reach: CoursePlanEstimate.Reach,
  chapters: [CoursePlanEstimate.ChapterPlace],
  unwrittenLessonMinutes: Double
) -> CoursePlanEstimate {
  CoursePlanEstimate(
    reach: reach,
    chapters: chapters,
    afterDeadlineMinutes: numbers.afterDeadlineMinutes,
    beforeDeadlineMinutes: numbers.beforeDeadlineMinutes,
    coverage: numbers.coverage.map {
      CoursePlanEstimate.Coverage(coveredShare: $0.coveredShare, measuresGoal: $0.measure == .goal)
    },
    fromDate: numbers.context.fromDate,
    scheduledMinutes: numbers.scheduledMinutes,
    unwrittenLessonMinutes: unwrittenLessonMinutes,
    workload: CoursePlanEstimate.Workload(
      checkpointMinutes: numbers.workload.checkpointMinutes,
      lessonMinutes: numbers.workload.lessonMinutes,
      practiceMinutes: numbers.workload.practiceMinutes,
      unwrittenLessonMinutes: numbers.workload.unwrittenLessonMinutes))
}
