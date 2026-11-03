package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
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
import com.zoonk.api.models.StudyNext
import com.zoonk.api.models.StudyNextNextLevel

/**
 * Main's `StudyNextSuggestion`: the course's certificate, the next level, which starts a goal from
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
    val certificate = host.certificate

    Suggestion(label = title, summary = title, layout = slot.layout, mark = SuggestionMark.Done) {
        SuggestionHeader(title)
        if (next.nextLevel != null || next.related.isNotEmpty()) SuggestionDescription(stringResource(R.string.plan_study_next))
        if (certificate != null || next.nextLevel != null) {
            SuggestionActions {
                certificate?.let {
                    val label = if (it.code == null) R.string.certificates_get else R.string.certificates_view
                    SuggestionAction(
                        onClick = host.onCertificate,
                        enabled = !host.claimingCertificate,
                        secondary = next.nextLevel != null,
                    ) {
                        PendingLabel(host.claimingCertificate, stringResource(label))
                    }
                }
                next.nextLevel?.let { level ->
                    SuggestionAction(onClick = host.onContinue, enabled = !starting) {
                        PendingLabel(starting, stringResource(R.string.plan_continue_at, levelName(level.level)))
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

@Composable
private fun levelName(level: StudyNextNextLevel.Level): String =
    stringResource(
        when (level) {
            StudyNextNextLevel.Level.OVERVIEW -> R.string.catalog_level_overview
            StudyNextNextLevel.Level.BEGINNER -> R.string.catalog_level_beginner
            StudyNextNextLevel.Level.INTERMEDIATE -> R.string.catalog_level_intermediate
            StudyNextNextLevel.Level.ADVANCED -> R.string.catalog_level_advanced
        },
    )
