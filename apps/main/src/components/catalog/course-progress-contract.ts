/**
 * What `GET /api/learner/courses/{courseId}/progress` answers for a catalog page's own bits:
 * whether a goal of the learner's follows the course and whether they're partway through the
 * page's lesson. A visitor's page shows neither.
 */
export type CourseProgress = { followsCourse: boolean; lessonStarted: boolean };
