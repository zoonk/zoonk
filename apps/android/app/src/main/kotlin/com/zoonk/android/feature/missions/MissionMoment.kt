package com.zoonk.android.feature.missions

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.ui.characters.ActReaction
import com.zoonk.android.ui.characters.BuddyAct
import com.zoonk.android.ui.characters.BuddyActor
import com.zoonk.android.ui.characters.BuddyCrop
import com.zoonk.android.ui.characters.BuddyExpression
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.celebrates
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.StudyMission

/** What a finished block did to the day's missions, from its completion. */
data class MissionMomentFacts(
    val missions: List<DayMission>,
    val completed: List<StudyMission.Kind>,
    val bonus: Long,
    val bonusPaid: Boolean,
) {
    val justDone: List<DayMission> get() = missions.filter { it.done && it.kind in completed }
    val shows: Boolean get() = justDone.isNotEmpty() || bonusPaid
    val payoff: Boolean get() = bonusPaid && missions.all { it.done }
}

/** How long what follows waits, so the day's moment plays one thing at a time. */
fun MissionMomentFacts?.afterMillis(): Int =
    when {
        this == null || !shows -> ZoonkMotion.BEAT_MILLIS
        payoff -> 3 * ZoonkMotion.BEAT_MILLIS
        else -> 2 * ZoonkMotion.BEAT_MILLIS
    }

/** Main's `MissionMoment`: the missions a block just finished stamp in, and finishing them all pays the day's bonus. */
@Composable
fun MissionMoment(
    facts: MissionMomentFacts,
    buddy: BuddyLook,
    buddyName: String,
    modifier: Modifier = Modifier,
) {
    if (!facts.shows) return

    val justDone = facts.justDone
    val left = facts.missions.count { !it.done }
    val payoff = facts.payoff
    val celebrate = celebrates()
    val points = formatNumber(facts.bonus.toDouble(), currentLocale())
    val brain = MaterialTheme.zoonk.brain
    val title =
        if (left == 0) {
            stringResource(R.string.missions_moment_all_done)
        } else {
            pluralStringResource(R.plurals.missions_moment_done, justDone.size, justDone.size)
        }
    val status =
        when {
            left > 0 -> pluralStringResource(R.plurals.missions_moment_more, left, left, points)
            facts.bonusPaid -> stringResource(R.string.missions_earned, points)
            else -> stringResource(R.string.missions_already_earned, points)
        }

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = brain.copy(alpha = SURFACE_ALPHA),
        border = BorderStroke(1.dp, brain.copy(alpha = BORDER_ALPHA)),
    ) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(if (payoff) 16.dp else 12.dp),
            ) {
                BuddyActor(
                    look = buddy,
                    modifier = Modifier.size(if (payoff) 96.dp else 48.dp),
                    expression = if (payoff) BuddyExpression.Happy else BuddyExpression.Neutral,
                    crop = if (payoff) BuddyCrop.Whole else BuddyCrop.Face,
                    reaction =
                        if (celebrate) {
                            if (payoff) {
                                ActReaction(
                                    BuddyAct.Cheer,
                                    2 * ZoonkMotion.BEAT_MILLIS,
                                )
                            } else {
                                ActReaction(BuddyAct.Smile, ZoonkMotion.BEAT_MILLIS)
                            }
                        } else {
                            null
                        },
                )
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(if (payoff) 12.dp else 2.dp)) {
                    Column(
                        modifier = Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            text = title,
                            modifier = Modifier.semantics { heading() },
                            style = if (payoff) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        if (!payoff) {
                            Text(status, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    if (payoff) MomentReadouts(facts.bonus)
                }
            }

            MissionTrack(
                missions = facts.missions,
                modifier = Modifier.padding(top = 16.dp),
                from = justDone.map { it.kind }.toSet(),
                delayMillis = ZoonkMotion.BEAT_MILLIS,
            )

            Column(Modifier.padding(top = 6.dp)) {
                facts.missions.forEach { mission ->
                    MomentMissionRow(mission, order = justDone.indexOf(mission), buddyName = buddyName, celebrate = celebrate)
                }
            }
        }
    }
}

@Composable
private fun MomentMissionRow(
    mission: DayMission,
    order: Int,
    buddyName: String,
    celebrate: Boolean,
) {
    val now = order >= 0
    val muted = mission.done && !now

    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(20.dp), contentAlignment = Alignment.Center) {
            when {
                now -> StampedMark(order, celebrate)
                mission.done -> DoneMark()
                else -> KindMark(mission.learnKind)
            }
        }
        Column(Modifier.weight(1f)) {
            Text(
                text = missionName(mission, buddyName),
                color = if (muted) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.titleSmall,
            )
            if (!mission.done) {
                missionStepLine(mission, null)?.let {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (now) {
            Text(
                text = stringResource(R.string.missions_just_done),
                color = MaterialTheme.colorScheme.tertiary,
                style = MaterialTheme.typography.labelMedium,
            )
        }
    }
}

/** Stamps in one after another, a beat after the moment appears. */
@Composable
private fun StampedMark(
    order: Int,
    celebrate: Boolean,
) {
    val scale = remember { Animatable(if (celebrate) 0f else 1f) }
    LaunchedEffect(celebrate) {
        if (celebrate) {
            scale.animateTo(1f, tween(SETTLE_MILLIS, ZoonkMotion.BEAT_MILLIS + order * ZoonkMotion.STAGGER_MILLIS, ZoonkMotion.EaseSpring))
        }
    }

    DoneMark(
        Modifier.graphicsLayer {
            scaleX = scale.value
            scaleY = scale.value
        },
    )
}

private const val SURFACE_ALPHA = 0.06f
private const val BORDER_ALPHA = 0.25f
private const val SETTLE_MILLIS = 650
