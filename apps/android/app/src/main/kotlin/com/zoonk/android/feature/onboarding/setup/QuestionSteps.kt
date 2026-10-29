package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.BuddyPicker
import com.zoonk.android.ui.components.GenerationFailureNotice
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.BuddyInput
import com.zoonk.api.models.ExamChoice
import com.zoonk.api.models.ExamChoicePick
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingAnswerInputOneOf
import com.zoonk.api.models.OnboardingAnswerInputOneOf1
import com.zoonk.api.models.OnboardingAnswerInputOneOf10
import com.zoonk.api.models.OnboardingAnswerInputOneOf2
import com.zoonk.api.models.OnboardingAnswerInputOneOf3
import com.zoonk.api.models.OnboardingAnswerInputOneOf4
import com.zoonk.api.models.OnboardingAnswerInputOneOf5
import com.zoonk.api.models.OnboardingAnswerInputOneOf6
import com.zoonk.api.models.OnboardingAnswerInputOneOf7
import com.zoonk.api.models.OnboardingExamDays
import com.zoonk.api.models.OnboardingExamSubjectsInner
import kotlinx.datetime.toJavaLocalDate
import kotlinx.datetime.toKotlinLocalDate
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.TimeZone

@Composable
internal fun ColumnScope.StepForm(
    title: String,
    pending: Boolean,
    onContinue: () -> Unit,
    description: String? = null,
    subject: String? = null,
    canContinue: Boolean = true,
    continueLabel: String? = null,
    onSkip: (() -> Unit)? = null,
    skipLabel: String? = null,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    StepHeading(title, description, subject)
    content()
    OnboardingActions {
        PlanStartNotice()
        Button(onClick = onContinue, enabled = canContinue && !pending, modifier = Modifier.fillMaxWidth()) {
            Text(continueLabel ?: stringResource(R.string.onboarding_continue))
        }
        if (onSkip != null) {
            TextButton(onClick = onSkip, enabled = !pending, modifier = Modifier.fillMaxWidth()) {
                Text(skipLabel ?: stringResource(R.string.onboarding_skip))
            }
        }
    }
}

/** The plan's run the questions stand on, so each question says when it stopped and offers its Try again. */
internal data class PlanStart(
    val run: GenerationRun,
    val onRetry: (() -> Unit)?,
)

internal val LocalPlanStart = compositionLocalOf<PlanStart?> { null }

@Composable
private fun PlanStartNotice() {
    val start = LocalPlanStart.current ?: return
    val failure =
        start.run.failure
            ?.takeIf { start.run.status == GenerationRun.Status.Failed && it != GenerationFailure.Connection }
            ?: return
    GenerationFailureNotice(
        failure = failure,
        onRetry = start.onRetry,
        title =
            stringResource(
                if (failure ==
                    GenerationFailure.NotStarted
                ) {
                    R.string.onboarding_plan_not_started
                } else {
                    R.string.onboarding_plan_stopped
                },
            ),
        description = stringResource(R.string.onboarding_plan_answers_saved),
    )
}

@Composable
internal fun StepHeading(
    title: String,
    description: String? = null,
    subject: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (subject != null) {
            Text(subject, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
        }
        OnboardingHeading(title, description)
    }
}

@Composable
internal fun ColumnScope.PurposeStep(
    subject: String,
    pending: Boolean,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    var purpose by rememberSaveable { mutableStateOf<OnboardingAnswerInputOneOf.Purpose?>(null) }
    val answer = { picked: OnboardingAnswerInputOneOf.Purpose ->
        onAnswer(
            OnboardingAnswerInput.OnboardingAnswerInputOneOfValue(
                OnboardingAnswerInputOneOf(picked, OnboardingAnswerInputOneOf.Question.PURPOSE),
            ),
        )
    }
    val choices =
        listOf(
            Choice(
                OnboardingAnswerInputOneOf.Purpose.OVERVIEW,
                stringResource(R.string.onboarding_purpose_overview),
                stringResource(R.string.onboarding_purpose_overview_description),
            ),
            Choice(
                OnboardingAnswerInputOneOf.Purpose.DEEP,
                stringResource(R.string.onboarding_purpose_deep),
                stringResource(R.string.onboarding_purpose_deep_description),
            ),
            Choice(
                OnboardingAnswerInputOneOf.Purpose.WORK,
                stringResource(R.string.onboarding_purpose_work),
                stringResource(R.string.onboarding_purpose_work_description),
            ),
            Choice(
                OnboardingAnswerInputOneOf.Purpose.CAREER_CHANGE,
                stringResource(R.string.onboarding_purpose_career_change),
                stringResource(R.string.onboarding_purpose_career_change_description),
            ),
            Choice(
                OnboardingAnswerInputOneOf.Purpose.REFRESH,
                stringResource(R.string.onboarding_purpose_refresh),
                stringResource(R.string.onboarding_purpose_refresh_description),
            ),
            Choice(
                OnboardingAnswerInputOneOf.Purpose.OTHER,
                stringResource(R.string.onboarding_purpose_other),
                stringResource(R.string.onboarding_purpose_other_description),
            ),
        )

    StepForm(
        title = stringResource(R.string.onboarding_purpose_title),
        description = stringResource(R.string.onboarding_purpose_description),
        subject = subject,
        canContinue = purpose != null,
        pending = pending,
        onContinue = { purpose?.let(answer) },
    ) {
        ChoiceList(
            choices = choices,
            value = purpose,
            label = stringResource(R.string.onboarding_purpose_label),
            onChange = { purpose = it },
            onPick = answer,
            readOnly = pending,
        )
    }
}

/** The quick test is the answer of a learner who isn't sure, and leaves their level to placement. */
internal sealed interface LevelChoice {
    data class Own(
        val level: OnboardingAnswerInputOneOf7.Level,
    ) : LevelChoice

    data object QuickTest : LevelChoice
}

@Composable
internal fun ColumnScope.LevelStep(
    subject: String,
    initial: LevelChoice?,
    pending: Boolean,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    var level by remember { mutableStateOf(initial) }
    val answer = { picked: LevelChoice ->
        onAnswer(
            OnboardingAnswerInput.OnboardingAnswerInputOneOf7Value(
                OnboardingAnswerInputOneOf7(OnboardingAnswerInputOneOf7.Question.LEVEL, level = (picked as? LevelChoice.Own)?.level),
            ),
        )
    }
    val choices: List<Choice<LevelChoice>> =
        listOf(
            Choice<LevelChoice>(
                LevelChoice.Own(OnboardingAnswerInputOneOf7.Level.NONE),
                stringResource(R.string.onboarding_level_none),
                stringResource(R.string.onboarding_level_none_description),
            ),
            Choice(
                LevelChoice.Own(OnboardingAnswerInputOneOf7.Level.BASIC),
                stringResource(R.string.onboarding_level_basic),
                stringResource(R.string.onboarding_level_basic_description),
            ),
            Choice(
                LevelChoice.Own(OnboardingAnswerInputOneOf7.Level.INTERMEDIATE),
                stringResource(R.string.onboarding_level_intermediate),
                stringResource(R.string.onboarding_level_intermediate_description),
            ),
            Choice(
                LevelChoice.Own(OnboardingAnswerInputOneOf7.Level.ADVANCED),
                stringResource(R.string.onboarding_level_advanced),
                stringResource(R.string.onboarding_level_advanced_description),
            ),
            Choice(
                LevelChoice.QuickTest,
                stringResource(R.string.onboarding_level_test),
                stringResource(R.string.onboarding_level_test_description, formatMinutes(QUICK_TEST_MINUTES, currentLocale())),
            ),
        )

    StepForm(
        title = stringResource(R.string.onboarding_level_title),
        description = stringResource(R.string.onboarding_level_description),
        subject = subject,
        canContinue = level != null,
        pending = pending,
        onContinue = { level?.let(answer) },
    ) {
        ChoiceList(
            choices,
            level,
            stringResource(R.string.onboarding_level_label),
            onChange = { level = it },
            onPick = answer,
            readOnly = pending,
        )
    }
}

@Composable
internal fun ColumnScope.SubjectsLevelStep(
    subject: String,
    subjects: List<OnboardingExamSubjectsInner>,
    initialKnown: List<String>,
    pending: Boolean,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    var known by rememberSaveable { mutableStateOf(initialKnown.filter { name -> subjects.any { it.name == name } }) }
    val label = stringResource(R.string.onboarding_subjects_label)

    StepForm(
        title = stringResource(R.string.onboarding_subjects_title),
        description = stringResource(R.string.onboarding_subjects_description),
        subject = subject,
        continueLabel = stringResource(if (known.isEmpty()) R.string.onboarding_subjects_none else R.string.onboarding_continue),
        skipLabel = stringResource(R.string.onboarding_subjects_from_scratch),
        pending = pending,
        onContinue = {
            onAnswer(
                OnboardingAnswerInput.OnboardingAnswerInputOneOf7Value(
                    OnboardingAnswerInputOneOf7(OnboardingAnswerInputOneOf7.Question.LEVEL, knownSubjects = known, level = null),
                ),
            )
        },
        onSkip = {
            onAnswer(
                OnboardingAnswerInput.OnboardingAnswerInputOneOf7Value(
                    OnboardingAnswerInputOneOf7(OnboardingAnswerInputOneOf7.Question.LEVEL, level = OnboardingAnswerInputOneOf7.Level.NONE),
                ),
            )
        },
    ) {
        OutlinedCard(Modifier.semantics { contentDescription = label }) {
            subjects.forEachIndexed { index, item ->
                if (index > 0) HorizontalDivider()
                val checked = item.name in known
                ListItem(
                    headlineContent = { Text(item.shortName ?: item.name) },
                    supportingContent = item.shortName?.takeIf { it != item.name }?.let { { Text(item.name) } },
                    trailingContent = { Checkbox(checked = checked, onCheckedChange = null) },
                    colors =
                        ListItemDefaults.colors(
                            containerColor = if (checked) MaterialTheme.zoonk.selectedTint else MaterialTheme.colorScheme.surface,
                        ),
                    modifier =
                        Modifier.toggleable(checked, enabled = !pending, role = Role.Checkbox) {
                            known = if (it) known + item.name else known - item.name
                        },
                )
            }
        }
    }
}

internal enum class TextQuestion { Reason, Admission, Position, Score }

@Composable
internal fun ColumnScope.TextStep(
    question: TextQuestion,
    subject: String,
    pending: Boolean,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    var value by rememberSaveable(question) { mutableStateOf("") }
    val answer = { text: String? ->
        onAnswer(
            if (question == TextQuestion.Reason) {
                OnboardingAnswerInput.OnboardingAnswerInputOneOf2Value(
                    OnboardingAnswerInputOneOf2(OnboardingAnswerInputOneOf2.Question.REASON, text),
                )
            } else {
                OnboardingAnswerInput.OnboardingAnswerInputOneOf3Value(
                    OnboardingAnswerInputOneOf3(OnboardingAnswerInputOneOf3.Question.TARGET, text),
                )
            },
        )
    }
    val (title, description, label, placeholder) =
        when (question) {
            TextQuestion.Reason -> {
                listOf(
                    R.string.onboarding_reason_title,
                    R.string.onboarding_reason_description,
                    R.string.onboarding_reason_label,
                    R.string.onboarding_reason_placeholder,
                )
            }

            TextQuestion.Admission -> {
                listOf(
                    R.string.onboarding_admission_title,
                    R.string.onboarding_target_description,
                    R.string.onboarding_target_label,
                    R.string.onboarding_admission_placeholder,
                )
            }

            TextQuestion.Position -> {
                listOf(
                    R.string.onboarding_position_title,
                    R.string.onboarding_position_description,
                    R.string.onboarding_position_label,
                    R.string.onboarding_position_placeholder,
                )
            }

            TextQuestion.Score -> {
                listOf(
                    R.string.onboarding_score_title,
                    R.string.onboarding_target_description,
                    R.string.onboarding_target_label,
                    R.string.onboarding_score_placeholder,
                )
            }
        }

    StepForm(
        title = stringResource(title),
        description = stringResource(description),
        subject = subject,
        canContinue = value.isNotBlank(),
        pending = pending,
        onContinue = { answer(value.trim()) },
        onSkip = { answer(null) },
    ) {
        AnswerField(stringResource(label), stringResource(placeholder), value, onValueChange = { value = it })
    }
}

@Composable
internal fun ColumnScope.FollowUpsStep(
    questions: List<String>,
    pending: Boolean,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    var answers by rememberSaveable(questions) { mutableStateOf(questions.map { "" }) }
    val send = { values: List<String?> ->
        onAnswer(
            OnboardingAnswerInput.OnboardingAnswerInputOneOf5Value(
                OnboardingAnswerInputOneOf5(values, OnboardingAnswerInputOneOf5.Question.FOLLOW_UPS),
            ),
        )
    }

    StepForm(
        title = stringResource(R.string.onboarding_follow_ups_title),
        description = stringResource(R.string.onboarding_follow_ups_description),
        pending = pending,
        onContinue = { send(answers.map { it.trim().ifEmpty { null } }) },
        onSkip = { send(questions.map { null }) },
    ) {
        questions.forEachIndexed { index, question ->
            AnswerField(
                label = question,
                placeholder = stringResource(R.string.onboarding_your_answer),
                value = answers.getOrElse(index) { "" },
                onValueChange = { typed -> answers = answers.mapIndexed { position, answer -> if (position == index) typed else answer } },
                focusFirst = index == 0,
            )
        }
    }
}

@Composable
internal fun ColumnScope.RoleStep(
    careerChange: Boolean,
    pending: Boolean,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    var role by rememberSaveable { mutableStateOf("") }
    var second by rememberSaveable { mutableStateOf("") }
    val answer = { text: String -> text.trim().ifEmpty { null } }

    StepForm(
        title = stringResource(if (careerChange) R.string.onboarding_role_career_title else R.string.onboarding_role_work_title),
        description =
            stringResource(
                if (careerChange) R.string.onboarding_role_career_description else R.string.onboarding_role_work_description,
            ),
        canContinue = (if (careerChange) second else role).isNotBlank(),
        pending = pending,
        onContinue = {
            onAnswer(
                OnboardingAnswerInput.OnboardingAnswerInputOneOf1Value(
                    if (careerChange) {
                        OnboardingAnswerInputOneOf1(
                            OnboardingAnswerInputOneOf1.Question.ROLE,
                            role = answer(role),
                            targetPosition = answer(second),
                        )
                    } else {
                        OnboardingAnswerInputOneOf1(OnboardingAnswerInputOneOf1.Question.ROLE, role = answer(role), tasks = answer(second))
                    },
                ),
            )
        },
        onSkip = {
            onAnswer(
                OnboardingAnswerInput.OnboardingAnswerInputOneOf1Value(
                    OnboardingAnswerInputOneOf1(OnboardingAnswerInputOneOf1.Question.ROLE),
                ),
            )
        },
    ) {
        if (careerChange) {
            AnswerField(
                stringResource(
                    R.string.onboarding_row_role_you_want,
                ),
                stringResource(R.string.onboarding_role_wanted_placeholder),
                second,
                {
                    second =
                        it
                },
            )
            AnswerField(
                stringResource(
                    R.string.onboarding_row_what_you_do,
                ),
                stringResource(R.string.onboarding_role_now_placeholder),
                role,
                {
                    role =
                        it
                },
                focusFirst = false,
            )
        } else {
            AnswerField(stringResource(R.string.onboarding_row_your_role), stringResource(R.string.onboarding_role_placeholder), role, {
                role =
                    it
            })
            AnswerField(
                stringResource(
                    R.string.onboarding_role_tasks,
                ),
                stringResource(R.string.onboarding_role_tasks_placeholder),
                second,
                {
                    second =
                        it
                },
                focusFirst = false,
            )
        }
    }
}

/** An exam's notice day is offered first; "Another date" picks the learner's own. */
@Composable
internal fun ColumnScope.DateStep(
    subject: String,
    exam: OnboardingExamDays?,
    initialDate: LocalDate?,
    pending: Boolean,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    val examDay = exam?.days?.firstOrNull()?.toJavaLocalDate()
    var otherDate by rememberSaveable { mutableStateOf(examDay == null || (initialDate != null && initialDate != examDay)) }
    val answer = { date: LocalDate? ->
        onAnswer(
            OnboardingAnswerInput.OnboardingAnswerInputOneOf4Value(
                OnboardingAnswerInputOneOf4(OnboardingAnswerInputOneOf4.Question.TARGET_DATE, date?.toKotlinLocalDate()),
            ),
        )
    }

    if (exam != null && examDay != null && !otherDate) {
        val locale = currentLocale()
        val second = exam.days.getOrNull(1)?.toJavaLocalDate()
        val ready = stringResource(if (second == null) R.string.onboarding_exam_ready else R.string.onboarding_exam_ready_first_day)
        StepForm(
            title =
                if (second == null) {
                    stringResource(R.string.onboarding_exam_on, formatDate(examDay, locale, DateStyle.Day))
                } else {
                    stringResource(
                        R.string.onboarding_exam_on_two,
                        formatDate(examDay, locale, DateStyle.Day),
                        formatDate(second, locale, DateStyle.Day),
                    )
                },
            description = if (exam.estimated) "$ready ${stringResource(R.string.onboarding_exam_expected)}" else ready,
            subject = subject,
            skipLabel = stringResource(R.string.onboarding_another_date),
            pending = pending,
            onContinue = { answer(examDay) },
            onSkip = { otherDate = true },
        )
        return
    }

    var date by rememberSaveable { mutableStateOf(initialDate?.toString()) }
    var picking by rememberSaveable { mutableStateOf(false) }
    val today = LocalDate.now()
    val picked = date?.let(LocalDate::parse)

    StepForm(
        title = stringResource(R.string.onboarding_date_title),
        description = stringResource(R.string.onboarding_date_description),
        subject = subject,
        canContinue = picked != null && picked > today,
        skipLabel = stringResource(R.string.onboarding_date_none),
        pending = pending,
        onContinue = { picked?.let(answer) },
        onSkip = { answer(null) },
    ) {
        OutlinedTextField(
            value = picked?.let { formatDate(it, currentLocale(), DateStyle.LongYear) }.orEmpty(),
            onValueChange = {},
            modifier = Modifier.fillMaxWidth(),
            readOnly = true,
            label = { Text(stringResource(R.string.onboarding_date_label)) },
            trailingIcon = {
                IconButton(onClick = { picking = true }) {
                    Icon(painterResource(R.drawable.ic_calendar_month), contentDescription = stringResource(R.string.onboarding_date_pick))
                }
            },
        )
    }

    if (picking) {
        TargetDatePicker(today, picked, onDismiss = { picking = false }, onPick = { date = it.toString() })
    }
}

/** From tomorrow to ten years ahead, the deadlines core accepts. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TargetDatePicker(
    today: LocalDate,
    initial: LocalDate?,
    onDismiss: () -> Unit,
    onPick: (LocalDate) -> Unit,
) {
    val last = today.plusDays(MAX_DAYS_AHEAD)
    val state =
        rememberDatePickerState(
            initialSelectedDateMillis = initial?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli(),
            yearRange = today.year..last.year,
            selectableDates =
                object : SelectableDates {
                    override fun isSelectableDate(utcTimeMillis: Long): Boolean {
                        val day = Instant.ofEpochMilli(utcTimeMillis).atZone(ZoneOffset.UTC).toLocalDate()
                        return day > today && day <= last
                    }
                },
        )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    state.selectedDateMillis?.let { onPick(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
                    onDismiss()
                },
                enabled = state.selectedDateMillis != null,
            ) { Text(stringResource(R.string.onboarding_save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.onboarding_cancel)) } },
    ) { DatePicker(state) }
}

@Composable
internal fun ColumnScope.ExamChoiceStep(
    subject: String,
    choices: List<ExamChoice>,
    pending: Boolean,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    var picks by rememberSaveable { mutableStateOf(choices.mapNotNull { choice -> choice.subject?.let { choice.group to it } }.toMap()) }
    val answer = { picked: Map<String, String> ->
        onAnswer(
            OnboardingAnswerInput.OnboardingAnswerInputOneOf6Value(
                OnboardingAnswerInputOneOf6(
                    OnboardingAnswerInputOneOf6.Question.EXAM_CHOICE,
                    choices = choices.mapNotNull { choice -> picked[choice.group]?.let { ExamChoicePick(choice.group, it) } },
                    timeZone = TimeZone.getDefault().id,
                ),
            ),
        )
    }

    StepForm(
        title =
            stringResource(
                if (choices.size ==
                    1
                ) {
                    R.string.onboarding_exam_choice_title_one
                } else {
                    R.string.onboarding_exam_choice_title_other
                },
            ),
        description = stringResource(R.string.onboarding_exam_choice_description),
        subject = subject,
        canContinue = choices.all { it.group in picks },
        skipLabel = stringResource(R.string.onboarding_decide_later),
        pending = pending,
        onContinue = { answer(picks) },
        onSkip = {
            onAnswer(
                OnboardingAnswerInput.OnboardingAnswerInputOneOf6Value(
                    OnboardingAnswerInputOneOf6(OnboardingAnswerInputOneOf6.Question.EXAM_CHOICE, choices = null),
                ),
            )
        },
    ) {
        choices.forEach { choice ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(choice.group, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.titleSmall)
                ChoiceList(
                    choices =
                        choice.options.map { option ->
                            Choice(
                                option.name,
                                option.shortName ?: option.name,
                                option.name.takeIf {
                                    option.shortName !=
                                        null &&
                                        option.shortName != it
                                },
                            )
                        },
                    value = picks[choice.group],
                    label = choice.group,
                    onChange = { picks = picks + (choice.group to it) },
                    onPick = if (choices.size == 1) ({ answer(picks + (choice.group to it)) }) else null,
                    readOnly = pending,
                )
            }
        }
    }
}

@Composable
internal fun ColumnScope.BuddyStep(
    pending: Boolean,
    onAnswer: (OnboardingAnswerInput) -> Unit,
) {
    var kind by rememberSaveable { mutableStateOf(BuddyKind.Zu) }
    var name by rememberSaveable { mutableStateOf("") }

    StepForm(
        title = stringResource(R.string.onboarding_buddy_title),
        description = stringResource(R.string.onboarding_buddy_description),
        pending = pending,
        onContinue = {
            onAnswer(
                OnboardingAnswerInput.OnboardingAnswerInputOneOf10Value(
                    OnboardingAnswerInputOneOf10(
                        BuddyInput(kind = BuddyInput.Kind.entries.first { it.value == kind.key }, name = name.trim().ifEmpty { null }),
                        OnboardingAnswerInputOneOf10.Question.BUDDY,
                    ),
                ),
            )
        },
    ) {
        BuddyPicker(kind = kind, name = name, onSelect = { kind = it }, onNameChange = { name = it })
    }
}

/** Only a screen's first field takes focus as it opens. */
@Composable
private fun AnswerField(
    label: String,
    placeholder: String,
    value: String,
    onValueChange: (String) -> Unit,
    focusFirst: Boolean = true,
) {
    val focus = remember { FocusRequester() }
    OutlinedTextField(
        value = value,
        onValueChange = { onValueChange(it.take(MAX_ANSWER_LENGTH)) },
        modifier = Modifier.fillMaxWidth().focusRequester(focus),
        label = { Text(label) },
        placeholder = { Text(placeholder) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
    )
    if (focusFirst) LaunchedEffect(Unit) { focus.requestFocus() }
}

private const val QUICK_TEST_MINUTES = 2
private const val MAX_ANSWER_LENGTH = 200
private const val MAX_DAYS_AHEAD = 3650L
