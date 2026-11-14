package com.zoonk.android.feature.plan

import android.content.Intent
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.feedback.FeedbackSheet
import com.zoonk.android.feature.feedback.ReportProblemItem
import com.zoonk.android.navigation.AppLink
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.OptionsButton
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.datetime.toJavaLocalDate
import java.time.temporal.ChronoUnit

@Composable
internal fun PlanHeader(
    page: PlanPageState,
    links: PlanLinks,
    resume: Resume,
    isSaving: Boolean,
    onSetStatus: (LearnerSummaryGoal.Status) -> Unit,
    modifier: Modifier = Modifier,
    rename: GoalRename? = null,
    report: FeedbackSheet? = null,
    onAdjust: (() -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        PageTitleRow(stringResource(R.string.plan_title), verticalAlignment = Alignment.CenterVertically) {
            onAdjust?.let {
                OutlinedButton(
                    onClick = it,
                    Modifier.weight(1f, fill = false),
                    size = ButtonSize.Small,
                ) { Text(stringResource(R.string.plan_adjust_plan)) }
            }
            PlanMenu(page, links, resume, isSaving, onSetStatus, rename, report)
        }
        PlanSubtitle(page)
    }
}

/** The goal and its days left, the page's one line under its title. */
@Composable
private fun PlanSubtitle(page: PlanPageState) {
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
    val text = left?.let { stringResource(R.string.plan_eyebrow, page.goal.displayName, it.text) } ?: page.goal.displayName
    val spoken = left?.let { stringResource(R.string.plan_eyebrow, page.goal.displayName, it.spoken) } ?: page.goal.displayName

    Text(
        text,
        Modifier.semantics { contentDescription = spoken },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun PlanMenu(
    page: PlanPageState,
    links: PlanLinks,
    resume: Resume,
    isSaving: Boolean,
    onSetStatus: (LearnerSummaryGoal.Status) -> Unit,
    rename: GoalRename?,
    report: FeedbackSheet?,
) {
    GoalMenu(page.goal, resume, isSaving, onSetStatus, rename) { closing ->
        PlanItems(page, links, report, closing)
        HorizontalDivider()
    }
}

/**
 * The goal's own actions (rename, pause or resume, archive), which the Plan offers before its plan
 * shows too: a goal still in setup holds one of the free plan's goals until it's paused or archived.
 * [planItems] come first; `closing` wraps an item's action so it closes the menu.
 */
@Composable
internal fun GoalMenu(
    goal: LearnerSummaryGoal,
    resume: Resume,
    isSaving: Boolean,
    onSetStatus: (LearnerSummaryGoal.Status) -> Unit,
    rename: GoalRename?,
    planItems: @Composable (closing: (() -> Unit) -> () -> Unit) -> Unit = {},
) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    var dialog by rememberSaveable { mutableStateOf<GoalDialog?>(null) }
    val closing: (() -> Unit) -> () -> Unit = { action ->
        {
            expanded = false
            action()
        }
    }

    Box {
        OptionsButton(onClick = { expanded = true }, contentDescription = stringResource(R.string.plan_options))
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            planItems(closing)
            GoalItems(
                goal = goal,
                resume = resume,
                isSaving = isSaving,
                onSetStatus = onSetStatus,
                onRename = rename?.takeIf { goal.kind != LearnerSummaryGoal.Kind.EXPLAIN }?.onOpen,
                closing = closing,
                onDialog = { dialog = it },
            )
        }
    }

    dialog?.let { GoalStatusDialog(it, goal, onSetStatus, onDismiss = { dialog = null }) }
    rename?.dialog?.let { RenameGoalDialog(goal.displayName, it, rename) }
}

internal class GoalRename(
    val dialog: RenameDialog?,
    val onOpen: () -> Unit,
    val onClose: () -> Unit,
    val onSave: (String) -> Unit,
)

@Composable
private fun RenameGoalDialog(
    displayName: String,
    dialog: RenameDialog,
    rename: GoalRename,
) {
    var name by rememberSaveable { mutableStateOf(displayName) }
    val trimmed = name.trim()
    val save = { if (trimmed.isNotEmpty() && !dialog.saving) rename.onSave(trimmed) }

    AlertDialog(
        onDismissRequest = rename.onClose,
        title = { Text(stringResource(R.string.plan_rename_goal)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(stringResource(R.string.plan_rename_description))
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it.take(MAX_GOAL_NAME_LENGTH) },
                    modifier = Modifier.fillMaxWidth(),
                    label = stringResource(R.string.plan_rename_label),
                    supportingText = if (dialog.failed) ({ Text(stringResource(R.string.plan_save_failed)) }) else null,
                    isError = dialog.failed,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { save() }),
                    singleLine = true,
                )
            }
        },
        confirmButton = {
            TextButton(onClick = save, enabled = trimmed.isNotEmpty() && !dialog.saving) {
                Text(stringResource(R.string.plan_save))
            }
        },
        dismissButton = { TextButton(onClick = rename.onClose, enabled = !dialog.saving) { Text(stringResource(R.string.plan_cancel)) } },
    )
}

/** Core's `MAX_TITLE_LENGTH`, which bounds a goal's name. */
private const val MAX_GOAL_NAME_LENGTH = 120

@Composable
private fun PlanItems(
    page: PlanPageState,
    links: PlanLinks,
    report: FeedbackSheet?,
    closing: (() -> Unit) -> () -> Unit,
) {
    val context = LocalContext.current
    val shareTitle = stringResource(R.string.plan_share)
    val shareUrl = sharePlanUrl(page, currentLocale().language)
    val libraryCourse = page.libraryCourse
    val buddy = page.summary.buddy

    if (links.hasExam) MenuItem(R.drawable.ic_school, stringResource(R.string.plan_about_exam), closing(links::exam))
    libraryCourse?.let { course ->
        MenuItem(
            R.drawable.ic_local_library,
            stringResource(R.string.plan_full_course),
            closing { links.course(course.courseId.toString()) },
        )
    }
    if (links.hasExam || libraryCourse != null) HorizontalDivider()

    MenuItem(
        R.drawable.ic_share,
        shareTitle,
        closing {
            val send =
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TITLE, page.goal.displayName)
                    putExtra(Intent.EXTRA_TEXT, shareUrl)
                }
            context.startActivity(Intent.createChooser(send, shareTitle))
        },
    )
    MenuItem(
        R.drawable.ic_contact_support,
        stringResource(R.string.plan_talk_to, buddyName(BuddyKind.of(buddy.kind.value), buddy.name)),
        closing(links::buddy),
    )
    report?.let { ReportProblemItem(it, onClick = closing {}) }
}

@Composable
private fun GoalItems(
    goal: LearnerSummaryGoal,
    resume: Resume,
    isSaving: Boolean,
    onSetStatus: (LearnerSummaryGoal.Status) -> Unit,
    onRename: (() -> Unit)?,
    closing: (() -> Unit) -> () -> Unit,
    onDialog: (GoalDialog) -> Unit,
) {
    onRename?.let { MenuItem(R.drawable.ic_edit, stringResource(R.string.plan_rename_goal), closing(it)) }
    if (goal.status != LearnerSummaryGoal.Status.COMPLETED) {
        if (goal.status == LearnerSummaryGoal.Status.PAUSED) {
            MenuItem(
                R.drawable.ic_play_arrow,
                stringResource(R.string.plan_resume_goal),
                closing { if (resume == Resume.Confirm) onDialog(GoalDialog.Resume) else onSetStatus(LearnerSummaryGoal.Status.ACTIVE) },
                enabled = !isSaving && resume != Resume.Pending,
            )
        } else {
            MenuItem(
                R.drawable.ic_pause,
                stringResource(R.string.plan_pause_goal),
                closing { onSetStatus(LearnerSummaryGoal.Status.PAUSED) },
                enabled = !isSaving,
            )
        }
    }
    MenuItem(
        R.drawable.ic_archive,
        stringResource(R.string.plan_archive_goal),
        closing { onDialog(GoalDialog.Archive) },
        enabled = !isSaving,
    )
}

private enum class GoalDialog { Archive, Resume }

@Composable
private fun GoalStatusDialog(
    dialog: GoalDialog,
    goal: LearnerSummaryGoal,
    onSetStatus: (LearnerSummaryGoal.Status) -> Unit,
    onDismiss: () -> Unit,
) {
    val archive = dialog == GoalDialog.Archive
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(if (archive) R.string.plan_archive_title else R.string.plan_resume_title, goal.displayName)) },
        text = { Text(stringResource(if (archive) R.string.plan_archive_description else R.string.plan_resume_effect)) },
        confirmButton = {
            TextButton(
                onClick = {
                    onDismiss()
                    onSetStatus(if (archive) LearnerSummaryGoal.Status.ARCHIVED else LearnerSummaryGoal.Status.ACTIVE)
                },
            ) { Text(stringResource(if (archive) R.string.plan_archive else R.string.plan_resume)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.plan_cancel)) } },
    )
}

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

/** Whoever opens the link sees only the subject and the plan's shape (main's `/plan-link/{planId}`). */
private fun sharePlanUrl(
    page: PlanPageState,
    language: String,
): String = AppLink.pageUrl("/plan-link/${page.plan.planId}", language)
