package com.zoonk.android.feature.subscription

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.api.models.FreePlan

/** Main's FreePlan card, which only a visitor sees beside Plus: a guest or an account already has it. */
@Composable
internal fun FreePlanCard(
    limits: FreePlan,
    currency: String?,
    onStart: () -> Unit,
) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(stringResource(R.string.subscription_free), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
            if (currency != null) Text(money(0, currency, currentLocale()), style = MaterialTheme.typography.headlineMedium)
            OutlinedButton(
                onClick = onStart,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
            ) { Text(stringResource(R.string.subscription_start_free)) }
            Note(stringResource(R.string.subscription_no_card_needed), Modifier.align(Alignment.CenterHorizontally))
            HorizontalDivider()
            PlanIncludes(
                summary =
                    stringResource(
                        R.string.subscription_free_summary,
                        goals(limits.activeGoals),
                        pluralStringResource(
                            R.plurals.subscription_free_lessons_a_month,
                            count(limits.lessonsPerMonth),
                            count(limits.lessonsPerMonth),
                        ),
                    ),
                items =
                    listOfNotNull(
                        stringResource(R.string.subscription_free_plan),
                        limits.examPrepDays?.let {
                            examPrep(
                                it.toInt(),
                                R.string.subscription_free_exam_week,
                                R.string.subscription_free_exam_day,
                                R.plurals.subscription_free_exam,
                            )
                        },
                        pluralStringResource(
                            R.plurals.subscription_free_buddy,
                            count(limits.tutorMessagesPerDay),
                            count(limits.tutorMessagesPerDay),
                        ),
                        stringResource(R.string.subscription_free_calls),
                    ),
            )
        }
    }
}

/** Main's PlusQuestions. [limits] answers the first question; without them it's left out. */
@Composable
internal fun CommonQuestions(
    limits: FreePlan?,
    hasAccount: Boolean,
    navigator: AppNavigator,
) {
    val email = stringResource(R.string.subscription_questions_email)
    val linkStyle = TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline))

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            stringResource(R.string.subscription_questions_title),
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
        )
        Text(
            buildAnnotatedString {
                append(stringResource(R.string.subscription_questions_unsure))
                append(" ")
                withLink(LinkAnnotation.Url("mailto:$email", linkStyle)) { append(email) }
            },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }

    Column {
        if (limits != null) {
            Question(stringResource(R.string.subscription_question_free), initiallyOpen = true) {
                FreePlanAnswer(limits, hasAccount)
            }
        }
        Question(stringResource(R.string.subscription_question_unlimited)) {
            Answer(stringResource(R.string.subscription_answer_unlimited))
            AnswerAction(stringResource(R.string.subscription_answer_fair_use)) { navigator.open(AppRoute.FairUse) }
        }
        Question(stringResource(R.string.subscription_question_cancel)) {
            Answer(stringResource(R.string.subscription_answer_cancel))
        }
        Question(stringResource(R.string.subscription_question_refund)) {
            Answer(stringResource(R.string.subscription_answer_refund))
            AnswerAction(stringResource(R.string.subscription_contact_support)) { navigator.open(AppRoute.Help) }
        }
        HorizontalDivider()
    }
}

@Composable
private fun FreePlanAnswer(
    limits: FreePlan,
    hasAccount: Boolean,
) {
    val guestLessons = limits.guestLessons?.toInt()
    val lead =
        if (!hasAccount && guestLessons != null) {
            pluralStringResource(R.plurals.subscription_answer_free_guest_lead, guestLessons, guestLessons)
        } else {
            stringResource(R.string.subscription_answer_free_lead)
        }
    val items =
        listOfNotNull(
            goals(limits.activeGoals, R.plurals.subscription_answer_free_goals),
            pluralStringResource(
                R.plurals.subscription_answer_free_lessons,
                count(limits.lessonsPerMonth),
                count(limits.lessonsPerMonth),
                count(limits.lessonsPerDay),
            ),
            limits.examPrepDays?.let {
                examPrep(
                    it.toInt(),
                    R.string.subscription_answer_free_exam_week,
                    R.string.subscription_answer_free_exam_day,
                    R.plurals.subscription_answer_free_exam,
                )
            },
            stringResource(
                R.string.subscription_answer_free_buddy_uploads,
                pluralStringResource(
                    R.plurals.subscription_answer_free_buddy,
                    count(limits.tutorMessagesPerDay),
                    count(limits.tutorMessagesPerDay),
                ),
                pluralStringResource(R.plurals.subscription_answer_free_uploads, count(limits.uploadsPerDay), count(limits.uploadsPerDay)),
            ),
            stringResource(R.string.subscription_answer_free_calls),
        )

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Answer(lead)
        items.forEach { item ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("•", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Answer(item)
            }
        }
    }
}

@Composable
private fun Question(
    question: String,
    initiallyOpen: Boolean = false,
    answer: @Composable () -> Unit,
) {
    var open by rememberSaveable(question) { mutableStateOf(initiallyOpen) }

    HorizontalDivider()
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(
                    onClickLabel = stringResource(if (open) R.string.subscription_hide_answer else R.string.subscription_show_answer),
                    role = Role.Button,
                ) { open = !open }
                .padding(vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(question, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
        Icon(
            painterResource(R.drawable.ic_expand_more),
            contentDescription = null,
            modifier = if (open) Modifier.rotate(180f) else Modifier,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    if (open) {
        Column(Modifier.padding(bottom = 16.dp)) { answer() }
    }
}

@Composable
private fun AnswerAction(
    label: String,
    onClick: () -> Unit,
) {
    TextButton(onClick = onClick) { Text(label) }
}

@Composable
private fun Answer(text: String) {
    Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun goals(
    activeGoals: Long?,
    plural: Int = R.plurals.subscription_free_goals,
): String = pluralStringResource(plural, count(activeGoals), count(activeGoals))

/** Main's "=7" and "one" cases: a week of exam prep reads as a week, and one day as a day. */
@Composable
private fun examPrep(
    days: Int,
    week: Int,
    day: Int,
    plural: Int,
): String =
    when (days) {
        DAYS_IN_WEEK -> stringResource(week)
        1 -> stringResource(day)
        else -> pluralStringResource(plural, days, days)
    }

private fun count(limit: Long?): Int = limit?.toInt() ?: 0

private const val DAYS_IN_WEEK = 7
