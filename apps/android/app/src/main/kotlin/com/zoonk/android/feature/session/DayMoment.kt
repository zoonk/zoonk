package com.zoonk.android.feature.session

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.zoonk.android.feature.missions.MissionMoment
import com.zoonk.android.feature.missions.MissionMomentFacts
import com.zoonk.android.feature.missions.afterMillis
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.api.models.LibraryLessonCompletion
import com.zoonk.api.models.Milestone
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.StudyMission
import com.zoonk.api.models.StudyMissionMoment

/**
 * Main's `DayMoment`, shown where a finished block or lesson says how it went: the missions it
 * finished, then the belt level and Energy it reached. A milestone's ceremony shows before it.
 */
@Composable
fun DayMoment(
    missions: MissionMomentFacts?,
    reached: ReachedFacts,
    ceremony: Milestone.Kind?,
    buddy: BuddyLook,
    buddyName: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(24.dp)) {
        missions?.let { MissionMoment(it, buddy, buddyName) }
        ReachedMoment(reached, beltCeremony = ceremony == Milestone.Kind.BELT, delayMillis = missions.afterMillis(), buddyName = buddyName)
    }
}

/** A session block's end, from L6's question runner. */
@Composable
fun DayMoment(
    completion: StudyBlockCompletion,
    buddy: BuddyLook,
    buddyName: String,
    modifier: Modifier = Modifier,
) {
    DayMoment(
        missions = completion.missionMomentFacts(),
        reached = ReachedFacts(completion.reached.level, completion.reached.energy),
        ceremony = completion.ceremony?.kind,
        buddy = buddy,
        buddyName = buddyName,
        modifier = modifier,
    )
}

/** A lesson's end, from L4's player. A lesson played in a session carries its moment, ceremony included, in its block. */
@Composable
fun DayMoment(
    completion: LibraryLessonCompletion,
    buddy: BuddyLook,
    buddyName: String,
    modifier: Modifier = Modifier,
) {
    val block = completion.studyBlock
    if (block != null) {
        DayMoment(block, buddy, buddyName, modifier)
        return
    }

    DayMoment(
        missions = null,
        reached = ReachedFacts(completion.reached.level, completion.reached.energy),
        ceremony = completion.ceremony?.kind,
        buddy = buddy,
        buddyName = buddyName,
        modifier = modifier,
    )
}

fun StudyBlockCompletion.missionMomentFacts(): MissionMomentFacts =
    MissionMomentFacts(
        missions = missions.map { it.toDayMission() },
        completed = completedMissions.map { done -> StudyMission.Kind.entries.first { it.value == done.value } },
        bonus = fullMeal.bonus,
        bonusPaid = fullMeal.paid,
    )

fun StudyMissionMoment.missionMomentFacts(): MissionMomentFacts =
    MissionMomentFacts(
        missions = missions.map { it.toDayMission() },
        completed = completed.map { done -> StudyMission.Kind.entries.first { it.value == done.value } },
        bonus = fullMeal.bonus,
        bonusPaid = fullMeal.paid,
    )
