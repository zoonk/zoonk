package com.zoonk.android.feature.onboarding.course

import com.zoonk.api.models.CourseResource
import com.zoonk.api.models.CourseResourceEditionsInner

/** Which course a start in the app's language uses, as core's `resolveCourseStartLanguage` decides. */
internal sealed interface CourseStartLanguage {
    data object Same : CourseStartLanguage

    /** The course's version in the app's language. */
    data class Edition(
        val edition: CourseResourceEditionsInner,
    ) : CourseStartLanguage

    /** No version in the app's language: the plan is written in it from the course's subject. */
    data class LearnerLanguage(
        val language: String,
    ) : CourseStartLanguage
}

internal fun CourseResource.startLanguage(language: String): CourseStartLanguage {
    if (baseLanguage(this.language) == language) return CourseStartLanguage.Same
    val matches = editions.filter { baseLanguage(it.language) == language }
    return matches.singleOrNull()?.let(CourseStartLanguage::Edition) ?: CourseStartLanguage.LearnerLanguage(language)
}

/** The course the start uses: its version in the app's language when there is one. */
internal fun CourseResource.startCourseId(language: String): String =
    (startLanguage(language) as? CourseStartLanguage.Edition)?.edition?.id?.toString() ?: id.toString()

private fun baseLanguage(tag: String) = tag.lowercase().substringBefore('-').substringBefore('_')
