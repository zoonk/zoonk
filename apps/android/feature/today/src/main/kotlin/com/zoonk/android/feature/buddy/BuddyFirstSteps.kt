package com.zoonk.android.feature.buddy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.missions.MissionListRow
import com.zoonk.android.feature.missions.MissionMark
import com.zoonk.android.feature.missions.missionOpenLabel
import com.zoonk.android.feature.missions.missionStepLine
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.feature.session.toMissionOpens
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.BuddyFirstSteps
import com.zoonk.api.models.BuddyFirstStepsStepsInner
import com.zoonk.api.models.BuddyFirstStepsStepsInner.Kind
import com.zoonk.api.models.BuddyFirstStepsStepsInner.Status
import com.zoonk.api.models.StudyMission

/**
 * Main's `FirstStepsSection`: only the steps a learner can do now are rows. The ones done are in the count, and the
 * ones that open later are one line, since a row nobody can press only says when the plan gets to it.
 */
@Composable
internal fun BuddyFirstStepsSection(
    firstSteps: BuddyFirstSteps?,
    look: BuddyLook,
    name: String,
    taps: BuddyDayTaps,
) {
    firstSteps ?: return
    val locale = currentLocale()
    val open = firstSteps.steps.filter { it.status == Status.TODAY || it.status == Status.AVAILABLE }
    val later = firstSteps.steps.count { it.status == Status.LATER }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SectionHeader(
            stringResource(R.string.buddy_page_first_steps),
            detail =
                stringResource(
                    R.string.buddy_page_count,
                    formatNumber(firstSteps.done.toDouble(), locale),
                    formatNumber(firstSteps.total.toDouble(), locale),
                ),
        )
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (open.isNotEmpty()) {
                Column {
                    open.forEachIndexed { index, step ->
                        if (index > 0) HorizontalDivider()
                        FirstStepRow(step.asMission(), firstStepName(step.kind, name), look, name, taps)
                    }
                }
            }
            if (later > 0) {
                SectionNote(
                    pluralStringResource(R.plurals.buddy_page_first_steps_later, later, later),
                    first = open.isEmpty(),
                )
            }
            if (firstSteps.completedOn != null) {
                SectionNote(
                    stringResource(R.string.buddy_page_first_steps_done),
                    first = open.isEmpty() && later == 0,
                    success = true,
                )
            }
        }
    }
}

/** A quiet line under the rows, set off by a hairline unless it's the first thing under the header. */
@Composable
private fun SectionNote(
    text: String,
    first: Boolean,
    success: Boolean = false,
) {
    Column {
        if (!first) HorizontalDivider()
        Text(
            text,
            Modifier.padding(top = if (first) 0.dp else 12.dp),
            color = if (success) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = if (success) FontWeight.Medium else null,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun FirstStepRow(
    mission: DayMission,
    stepName: String,
    look: BuddyLook,
    buddyName: String,
    taps: BuddyDayTaps,
) {
    val tap = mission.tap(firstStep = true)?.takeIf { mission.waitReason == null }

    MissionListRow(
        name = stepName,
        line = missionStepLine(mission),
        done = false,
        muted = mission.waitReason != null,
        mark = { MissionMark(mission.kind, false, look) },
        openLabel = missionOpenLabel(mission, buddyName),
        onOpen = tap?.let { { taps.open(it) } },
        busy = taps.isOpening(tap),
        openFailed = taps.hasFailed(tap),
    )
}

/** A first step reads as the mission it is, so its mark, its wait and its open label are the mission's. */
private fun BuddyFirstStepsStepsInner.asMission(): DayMission =
    DayMission(
        kind = StudyMission.Kind.entries.first { it.value == kind.value },
        done = false,
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
