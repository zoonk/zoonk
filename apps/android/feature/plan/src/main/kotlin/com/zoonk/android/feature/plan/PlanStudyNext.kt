package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.catalog.courseLevelName
import com.zoonk.android.feature.subscription.ButtonPlusMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.PendingLabel
import com.zoonk.android.ui.components.Suggestion
import com.zoonk.android.ui.components.SuggestionAction
import com.zoonk.android.ui.components.SuggestionActions
import com.zoonk.android.ui.components.SuggestionDescription
import com.zoonk.android.ui.components.SuggestionHeader
import com.zoonk.android.ui.components.SuggestionMark
import com.zoonk.android.ui.components.SuggestionSaveError
import com.zoonk.android.ui.components.bleed
import com.zoonk.api.models.PlanCertificates
import com.zoonk.api.models.StudyNext

/**
 * Main's `StudyNextSuggestion`: the plan's certificates, the next level, which starts a goal from
 * the tap, and related courses.
 */
@Composable
internal fun StudyNextSuggestion(
    next: StudyNext,
    slot: Slot,
) {
    val title = stringResource(R.string.plan_finished_title)
    val host = slot.host
    val start = host.nextLevel
    val starting = start == NextLevelStart.Starting || start == NextLevelStart.Started
    val certificates = host.certificates?.takeIf { it.earned.isNotEmpty() || it.unclaimed.isNotEmpty() }

    Suggestion(label = title, summary = title, layout = slot.layout, mark = SuggestionMark.Done) {
        SuggestionHeader(title)
        if (next.nextLevel != null || next.related.isNotEmpty()) SuggestionDescription(stringResource(R.string.plan_study_next))
        if (certificates != null || next.nextLevel != null) {
            SuggestionActions {
                certificates?.let {
                    SuggestionAction(
                        onClick = host.onCertificate,
                        enabled = !host.claimingCertificate,
                        secondary = next.nextLevel != null,
                    ) {
                        PendingLabel(host.claimingCertificate, it.actionLabel())
                        if (it.unclaimed.isEmpty() && it.earned.any { earned -> earned.locked }) ButtonPlusMark()
                    }
                }
                next.nextLevel?.let { level ->
                    SuggestionAction(onClick = host.onContinue, enabled = !starting) {
                        PendingLabel(starting, stringResource(R.string.plan_continue_at, courseLevelName(level.level.value)))
                    }
                }
            }
            if (start == NextLevelStart.Failed || host.claimFailed) SuggestionSaveError()
        }
        if (next.related.isNotEmpty()) {
            val links = slot.links.closing(close)
            Column(Modifier.bleed(LIST_ITEM_INSET)) {
                next.related.forEach { course ->
                    ListRow(
                        headline = { Text(course.title) },
                        onClick = { links.course(course.courseId.toString()) },
                        leading = { Icon(painterResource(R.drawable.ic_library_books), contentDescription = null) },
                    )
                }
            }
        }
    }
}

/** Get the ones not written yet first; then open the one, or the Certificates page for several. */
@Composable
private fun PlanCertificates.actionLabel(): String =
    stringResource(
        when {
            unclaimed.isNotEmpty() -> R.string.certificates_get
            earned.size == 1 -> R.string.certificates_view
            else -> R.string.certificates_view_several
        },
    )

/**
 * Main's `CourseCompleteSuggestion`: a unit finished without the write that awards it, such as an
 * exam's course before its exam-day mocks, gets its certificate before the plan's end. "Beginner
 * complete" when the claim would certify that one level, else "Course complete".
 */
@Composable
internal fun CourseCompleteSuggestion(slot: Slot) {
    val host = slot.host
    val level =
        host.certificates
            ?.unclaimed
            ?.singleOrNull()
            ?.courseLevel
    val title =
        level?.let { stringResource(R.string.plan_level_complete, courseLevelName(it.value)) }
            ?: stringResource(R.string.plan_course_complete)
    val claim =
        @Composable {
            SuggestionAction(onClick = host.onCertificate, enabled = !host.claimingCertificate) {
                PendingLabel(host.claimingCertificate, stringResource(R.string.certificates_get))
            }
        }

    Suggestion(
        label = title,
        summary = title,
        layout = slot.layout,
        mark = SuggestionMark.Done,
        failed = host.claimFailed,
        lineAction = claim,
    ) {
        SuggestionHeader(title)
        SuggestionActions { claim() }
        if (host.claimFailed) SuggestionSaveError()
    }
}
