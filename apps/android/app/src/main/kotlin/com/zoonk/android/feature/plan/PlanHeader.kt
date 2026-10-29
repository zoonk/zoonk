package com.zoonk.android.feature.plan

import android.content.Intent
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.navigation.AppLink
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.api.models.GoalUpdateInput
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.datetime.toJavaLocalDate
import java.time.temporal.ChronoUnit

/** Main's `PlanHeader`: the goal and the days left above the title, the plan's actions beside it. */
@Composable
internal fun PlanHeader(
    page: PlanPageState,
    links: PlanLinks,
    resumeChangesPlan: Boolean,
    isSaving: Boolean,
    onSetStatus: (GoalUpdateInput.Status) -> Unit,
    modifier: Modifier = Modifier,
    adjust: (@Composable () -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        PlanEyebrow(page)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PlanTitle(Modifier.weight(1f))
            adjust?.invoke()
            PlanMenu(page, links, resumeChangesPlan, isSaving, onSetStatus)
        }
    }
}

@Composable
private fun PlanEyebrow(page: PlanPageState) {
    val target = page.plan.schedule.targetDate
    val days = target?.let { ChronoUnit.DAYS.between(page.today, it.toJavaLocalDate()).toInt() }
    val left =
        when {
            days == null || days < 0 -> {
                null
            }

            days == 0 -> {
                PlanDateWords(stringResource(R.string.plan_day_is_here), stringResource(R.string.plan_day_is_here))
            }

            page.plan.schedule.targetDateEstimated -> {
                PlanDateWords(
                    pluralStringResource(R.plurals.plan_days_left_estimate, days, days),
                    pluralStringResource(R.plurals.plan_days_left_estimate_spoken, days, days),
                )
            }

            else -> {
                pluralStringResource(R.plurals.plan_days_left, days, days).let { PlanDateWords(it, it) }
            }
        }
    val text = left?.let { stringResource(R.string.plan_eyebrow, page.goal.title, it.text) } ?: page.goal.title
    val spoken = left?.let { stringResource(R.string.plan_eyebrow, page.goal.title, it.spoken) } ?: page.goal.title

    Text(
        text = text,
        modifier = Modifier.semantics { contentDescription = spoken },
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

/** Main's "…" menu: other places the plan leads, sharing it, and the goal's status. */
@Composable
private fun PlanMenu(
    page: PlanPageState,
    links: PlanLinks,
    resumeChangesPlan: Boolean,
    isSaving: Boolean,
    onSetStatus: (GoalUpdateInput.Status) -> Unit,
) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    var dialog by rememberSaveable { mutableStateOf<GoalDialog?>(null) }
    val context = LocalContext.current
    val shareTitle = stringResource(R.string.plan_share)
    val shareUrl = sharePlanUrl(page, currentLocale().language)
    val partialCourse = page.plan.course?.takeIf { it.planChapterCount in 1 until it.chapterCount && it.brandSlug != null }
    val buddy = page.summary.buddy

    IconButton(onClick = { expanded = true }) {
        Icon(painterResource(R.drawable.ic_more_vert), contentDescription = stringResource(R.string.plan_options))
    }

    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
        fun close(action: () -> Unit): () -> Unit =
            {
                expanded = false
                action()
            }

        if (links.hasExam) MenuItem(R.drawable.ic_school, stringResource(R.string.plan_about_exam), close(links::exam))
        partialCourse?.let { course ->
            MenuItem(
                R.drawable.ic_local_library,
                stringResource(R.string.plan_full_course),
                close { links.course(course.courseId.toString()) },
            )
        }
        if (links.hasExam || partialCourse != null) HorizontalDivider()

        MenuItem(
            R.drawable.ic_share,
            shareTitle,
            close {
                val send =
                    Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TITLE, page.goal.title)
                        putExtra(Intent.EXTRA_TEXT, shareUrl)
                    }
                context.startActivity(Intent.createChooser(send, shareTitle))
            },
        )
        MenuItem(
            R.drawable.ic_contact_support,
            stringResource(R.string.plan_talk_to, buddyName(BuddyKind.of(buddy.kind.value), buddy.name)),
            close(links::buddy),
        )

        if (page.goal.status != LearnerSummaryGoal.Status.COMPLETED) {
            HorizontalDivider()
            if (page.isPaused) {
                MenuItem(
                    R.drawable.ic_play_arrow,
                    stringResource(R.string.plan_resume_goal),
                    close { if (resumeChangesPlan) dialog = GoalDialog.Resume else onSetStatus(GoalUpdateInput.Status.ACTIVE) },
                    enabled = !isSaving,
                )
            } else {
                MenuItem(
                    R.drawable.ic_pause,
                    stringResource(R.string.plan_pause_goal),
                    close { onSetStatus(GoalUpdateInput.Status.PAUSED) },
                    enabled = !isSaving,
                )
            }
        } else {
            HorizontalDivider()
        }
        MenuItem(
            R.drawable.ic_archive,
            stringResource(R.string.plan_archive_goal),
            close { dialog = GoalDialog.Archive },
            enabled = !isSaving,
        )
    }

    when (dialog) {
        GoalDialog.Archive -> {
            GoalStatusDialog(
                title = stringResource(R.string.plan_archive_title, page.goal.title),
                text = stringResource(R.string.plan_archive_description),
                confirm = stringResource(R.string.plan_archive),
                onConfirm = {
                    dialog = null
                    onSetStatus(GoalUpdateInput.Status.ARCHIVED)
                },
                onDismiss = { dialog = null },
            )
        }

        GoalDialog.Resume -> {
            GoalStatusDialog(
                title = stringResource(R.string.plan_resume_title, page.goal.title),
                text = stringResource(R.string.plan_resume_effect),
                confirm = stringResource(R.string.plan_resume),
                onConfirm = {
                    dialog = null
                    onSetStatus(GoalUpdateInput.Status.ACTIVE)
                },
                onDismiss = { dialog = null },
            )
        }

        null -> {}
    }
}

private enum class GoalDialog { Archive, Resume }

@Composable
private fun MenuItem(
    @DrawableRes icon: Int,
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
) {
    DropdownMenuItem(
        text = { Text(text) },
        onClick = onClick,
        enabled = enabled,
        leadingIcon = { Icon(painterResource(icon), contentDescription = null) },
    )
}

@Composable
private fun GoalStatusDialog(
    title: String,
    text: String,
    confirm: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(text) },
        confirmButton = { TextButton(onClick = onConfirm) { Text(confirm) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.plan_cancel)) } },
    )
}

/** Whoever opens the link sees only the subject and the plan's shape (main's `/plan-link/{planId}`). */
private fun sharePlanUrl(
    page: PlanPageState,
    language: String,
): String = AppLink.pageUrl("/plan-link/${page.plan.planId}", language)
