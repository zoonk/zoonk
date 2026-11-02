package com.zoonk.android.feature.buddy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.missions.MissionListRow
import com.zoonk.android.feature.missions.MissionMark
import com.zoonk.android.feature.missions.missionOpenLabel
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.toMissionOpens
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.BuddyFirstSteps
import com.zoonk.api.models.BuddyFirstStepsStepsInner
import com.zoonk.api.models.BuddyFirstStepsStepsInner.Kind
import com.zoonk.api.models.BuddyFirstStepsStepsInner.Status
import com.zoonk.api.models.BuddyFirstStepsStepsInnerWhen
import com.zoonk.api.models.BuddyFirstStepsStepsInnerWhenOneOf2
import com.zoonk.api.models.StudyMission
import kotlinx.datetime.toJavaLocalDate

/** Main's first steps: each thing the plan uses, tried once, in the order the plan brings them. */
@Composable
internal fun BuddyFirstStepsSection(
    firstSteps: BuddyFirstSteps?,
    look: BuddyLook,
    name: String,
    onMission: (MissionOpens) -> Unit,
) {
    firstSteps ?: return
    val done = firstSteps.done.toString()
    val total = firstSteps.total.toString()
    val spoken = stringResource(R.string.buddy_page_count, done, total)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                stringResource(R.string.buddy_page_first_steps),
                Modifier.weight(1f).semantics {
                    heading()
                },
                style = MaterialTheme.typography.titleSmall,
            )
            Text(
                "$done/$total",
                Modifier.semantics { contentDescription = spoken },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }
        Column {
            firstSteps.steps.forEachIndexed { index, step ->
                if (index > 0) HorizontalDivider()
                FirstStepRow(step, look, name, onMission)
            }
        }
        if (firstSteps.completedOn != null) {
            Text(
                stringResource(R.string.buddy_page_first_steps_done),
                color = MaterialTheme.colorScheme.onTertiaryContainer,
                style = MaterialTheme.typography.labelMedium,
            )
        }
    }
}

@Composable
private fun FirstStepRow(
    step: BuddyFirstStepsStepsInner,
    look: BuddyLook,
    name: String,
    onMission: (MissionOpens) -> Unit,
) {
    val done = step.status == Status.DONE
    val later = step.status == Status.LATER
    val mission = step.asMission()
    val opens = mission.opens?.takeIf { !done && !later && step.waitReason == null }

    MissionListRow(
        name = firstStepName(step.kind, name),
        line = if (done) null else firstStepLine(step),
        done = done,
        muted = done || later,
        mark = { if (later) StatusMark(MarkStatus.Todo) else MissionMark(mission.kind, done, look) },
        openLabel = missionOpenLabel(mission, name),
        onOpen = opens?.let { { onMission(it) } },
    )
}

/** A first step reads as the mission it is, so its mark and open label are the mission's. */
private fun BuddyFirstStepsStepsInner.asMission(): DayMission =
    DayMission(
        kind = StudyMission.Kind.entries.first { it.value == kind.value },
        done = status == Status.DONE,
        progress = 0,
        total = 1,
        minutes = null,
        firstStep = true,
        waitReason = waitReason?.let { reason -> StudyMission.WaitReason.entries.first { it.value == reason.value } },
        detail = null,
        opens = opens?.toMissionOpens(),
    )

@Composable
private fun firstStepName(
    kind: Kind,
    buddyName: String,
): String =
    when (kind) {
        Kind.SOMETHING_NEW -> stringResource(R.string.buddy_page_first_lesson)
        Kind.REVIEW -> stringResource(R.string.buddy_page_first_review)
        Kind.FIX_MISTAKE -> stringResource(R.string.buddy_page_first_mistake)
        Kind.PATTERN -> stringResource(R.string.buddy_page_first_pattern)
        Kind.ASK_BUDDY -> stringResource(R.string.buddy_page_first_ask, buddyName)
        Kind.ESSAY -> stringResource(R.string.buddy_page_first_essay)
        Kind.CALL -> stringResource(R.string.buddy_page_first_call)
        Kind.MOCK -> stringResource(R.string.buddy_page_first_mock)
        Kind.CHALLENGE -> stringResource(R.string.buddy_page_first_challenge)
    }

/** Main's `FirstStepDetailLine`: what it waits for, that it's one of today's, anytime, or when it comes. */
@Composable
private fun firstStepLine(step: BuddyFirstStepsStepsInner): String? {
    val wait = step.waitReason

    return when {
        wait == BuddyFirstStepsStepsInner.WaitReason.LESSONS -> stringResource(R.string.missions_after_lessons)
        wait == BuddyFirstStepsStepsInner.WaitReason.CHALLENGE -> stringResource(R.string.missions_after_challenge)
        step.status == Status.TODAY -> stringResource(R.string.buddy_page_first_today)
        step.status == Status.AVAILABLE -> stringResource(R.string.buddy_page_first_anytime)
        else -> step.`when`?.let { whenLine(it) }
    }
}

@Composable
private fun whenLine(comes: BuddyFirstStepsStepsInnerWhen): String =
    when (comes) {
        is BuddyFirstStepsStepsInnerWhen.BuddyFirstStepsStepsInnerWhenOneOfValue -> {
            comes.value.date?.let {
                stringResource(R.string.buddy_page_when_challenge_on, formatDate(it.toJavaLocalDate(), currentLocale()))
            } ?: stringResource(R.string.buddy_page_when_challenge)
        }

        is BuddyFirstStepsStepsInnerWhen.BuddyFirstStepsStepsInnerWhenOneOf1Value -> {
            stringResource(R.string.buddy_page_when_essay)
        }

        is BuddyFirstStepsStepsInnerWhen.BuddyFirstStepsStepsInnerWhenOneOf2Value -> {
            stringResource(
                when (comes.value.kind) {
                    BuddyFirstStepsStepsInnerWhenOneOf2.Kind.MISTAKE -> R.string.buddy_page_when_mistake
                    BuddyFirstStepsStepsInnerWhenOneOf2.Kind.REVIEW -> R.string.buddy_page_when_review
                    BuddyFirstStepsStepsInnerWhenOneOf2.Kind.PATTERN -> R.string.buddy_page_when_pattern
                    BuddyFirstStepsStepsInnerWhenOneOf2.Kind.CALL -> R.string.buddy_page_when_call
                    BuddyFirstStepsStepsInnerWhenOneOf2.Kind.BUDDY -> R.string.buddy_page_when_buddy
                    BuddyFirstStepsStepsInnerWhenOneOf2.Kind.LESSON -> R.string.buddy_page_when_lesson
                    BuddyFirstStepsStepsInnerWhenOneOf2.Kind.MOCK -> R.string.buddy_page_when_mock
                },
            )
        }
    }
