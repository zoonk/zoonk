import { type TrackResource } from "@zoonk/core/courses/tracks";

/** Native clients receive ISO timestamps while Core keeps semantic Date values. */
export function toTrackResponse(track: TrackResource) {
  return {
    courses: track.courses,
    createdAt: track.createdAt.toISOString(),
    id: track.id,
    nextTarget: track.nextTarget,
    pendingCourses: track.pendingCourses,
    progress: track.progress,
    title: track.title,
    updatedAt: track.updatedAt.toISOString(),
  };
}
