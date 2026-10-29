package com.zoonk.android.feature.missions

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.RichTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.session.BlockMark
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.feature.session.DayStep
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.ui.characters.Buddy
import com.zoonk.android.ui.characters.BuddyCrop
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.Trickster
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.StudyMission
import kotlinx.coroutines.launch

/**
 * The day's missions (main's `MissionsCard`): their status, the Brain Power they earn together,
 * a track of their progress and a row each. [rowsInQueue] leaves the rows to the session's queue,
 * which marks each mission's block; [collapseWhenDone] folds a won day to one line; [showBuddy] off
 * where the whole page is the buddy's.
 */
@Composable
fun MissionsCard(
    missions: List<DayMission>,
    bonus: Long,
    bonusEarned: Boolean,
    buddy: BuddyLook,
    buddyName: String,
    onOpen: (MissionOpens) -> Unit,
    modifier: Modifier = Modifier,
    brainPower: Long? = null,
    blockOf: (DayMission) -> DayStep? = { null },
    rowsInQueue: Boolean = false,
    collapseWhenDone: Boolean = false,
    showBuddy: Boolean = true,
) {
    if (missions.isEmpty()) return

    val locale = currentLocale()
    val points = formatNumber(bonus.toDouble(), locale)
    val allDone = missions.all(DayMission::done)
    val won = allDone && bonusEarned

    if (bonusEarned && !allDone) {
        MissionsLine(modifier) {
            Text(
                text = stringResource(R.string.missions_already_earned, points),
                modifier = Modifier.weight(1f),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        return
    }

    if (won && collapseWhenDone) {
        val names = missions.map { missionName(it, buddyName) }
        val title = stringResource(R.string.missions_done)
        MissionsLine(modifier) {
            Text(
                text = title,
                modifier = Modifier.weight(1f).semantics { contentDescription = (listOf(title) + names).joinToString(", ") },
                fontWeight = FontWeight.Medium,
                style = MaterialTheme.typography.bodyMedium,
            )
            BrainPowerReward(points, earned = true, brainPower)
        }
        return
    }

    OutlinedCard(modifier) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
                if (showBuddy) Buddy(buddy, Modifier.padding(top = 2.dp).size(24.dp), crop = BuddyCrop.Face)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = stringResource(if (won) R.string.missions_done else R.string.missions_title),
                        modifier = Modifier.semantics { heading() },
                        style = MaterialTheme.typography.titleSmall,
                    )
                    MissionsStatus(missions, points)
                }
                BrainPowerReward(points, earned = won, brainPower)
            }

            MissionTrack(missions, Modifier.padding(top = 14.dp))

            if (!rowsInQueue) {
                Column(Modifier.padding(top = 6.dp)) {
                    missions.forEachIndexed { index, mission ->
                        if (index > 0) HorizontalDivider()
                        MissionRow(mission, blockOf(mission), buddy, buddyName, onOpen)
                    }
                }
            } else {
                Box(Modifier.height(10.dp))
            }
        }
    }
}

@Composable
private fun MissionsLine(
    modifier: Modifier,
    content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit,
) {
    OutlinedCard(modifier) {
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            content = content,
        )
    }
}

@Composable
private fun MissionsStatus(
    missions: List<DayMission>,
    points: String,
) {
    val locale = currentLocale()
    val left = missions.filterNot(DayMission::done)
    val done = missions.size - left.size
    val minutes = left.sumOf { it.minutes ?: 0.0 }
    val text =
        if (left.isEmpty()) {
            stringResource(R.string.missions_earned, points)
        } else {
            val count =
                if (left.size == missions.size) {
                    pluralStringResource(R.plurals.missions_count, left.size, left.size)
                } else {
                    pluralStringResource(R.plurals.missions_left, left.size, left.size)
                }
            if (minutes >
                0
            ) {
                listOf(
                    count,
                    stringResource(R.string.missions_estimate, formatMinutes(minutes.toInt().coerceAtLeast(1), locale)),
                ).joinToString(" · ")
            } else {
                count
            }
        }
    val progress =
        stringResource(R.string.missions_progress, formatNumber(done.toDouble(), locale), formatNumber(missions.size.toDouble(), locale))

    Text(
        text = text,
        modifier = Modifier.semantics { contentDescription = "$text, $progress" },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall.withTabularFigures(),
    )
}

/** One part per mission, furthest first, filling in Brain Power's violet. */
@Composable
private fun MissionTrack(
    missions: List<DayMission>,
    modifier: Modifier,
) {
    val fills = missions.map { if (it.total > 0) (it.progress.toFloat() / it.total).coerceAtMost(1f) else 0f }.sortedDescending()
    val brain = MaterialTheme.zoonk.brain

    Row(modifier.fillMaxWidth().clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        fills.forEach { fill ->
            Box(
                Modifier
                    .weight(1f)
                    .height(6.dp)
                    .clip(MaterialTheme.shapes.extraSmall)
                    .background(brain.copy(alpha = TRACK_ALPHA)),
            ) {
                Box(Modifier.fillMaxWidth(fill).height(6.dp).background(brain))
            }
        }
    }
}

@Composable
private fun MissionRow(
    mission: DayMission,
    block: DayStep?,
    buddy: BuddyLook,
    buddyName: String,
    onOpen: (MissionOpens) -> Unit,
) {
    val opens = mission.opens?.takeIf { !mission.done && mission.waitReason == null }

    MissionListRow(
        name = missionName(mission, buddyName),
        line = if (mission.done) null else missionStepLine(mission, block),
        done = mission.done,
        muted = mission.done || mission.waitReason != null,
        mark = { if (block != null && !mission.done) BlockMark(block) else MissionMark(mission.kind, mission.done, buddy) },
        openLabel = missionOpenLabel(mission, buddyName),
        onOpen = opens?.let { { onOpen(it) } },
        trailing =
            if (!mission.done && mission.opens is MissionOpens.Block && mission.waitReason == null) {
                {
                    Icon(
                        painterResource(R.drawable.ic_target),
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.zoonk.brain,
                    )
                }
            } else {
                null
            },
    )
}

/** A mission's mark when no block of the day stands for it: done, the Trickster, the buddy's face, or its kind. */
@Composable
fun MissionMark(
    kind: StudyMission.Kind,
    done: Boolean,
    buddy: BuddyLook,
) {
    when {
        done -> DoneMark()
        kind == StudyMission.Kind.CHALLENGE -> Trickster(Modifier.size(20.dp))
        kind == StudyMission.Kind.ASK_BUDDY -> Buddy(buddy, Modifier.size(16.dp), crop = BuddyCrop.Face)
        else -> KindMark(kind.learnKind)
    }
}

/** One row of the day's missions or the buddy's first steps: its mark, name and line, opening where it leads. */
@Composable
fun MissionListRow(
    name: String,
    line: String?,
    done: Boolean,
    muted: Boolean,
    mark: @Composable () -> Unit,
    openLabel: String?,
    onOpen: (() -> Unit)?,
    modifier: Modifier = Modifier,
    trailing: (@Composable () -> Unit)? = null,
) {
    val doneLabel = stringResource(R.string.today_step_done)

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .then(if (onOpen != null) Modifier.clickable(role = Role.Button, onClickLabel = openLabel, onClick = onOpen) else Modifier)
                .semantics { if (done) stateDescription = doneLabel }
                .heightIn(min = 48.dp)
                .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(20.dp), contentAlignment = Alignment.Center) { mark() }

        Column(Modifier.weight(1f)) {
            Text(
                text = name,
                color = if (muted) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.titleSmall,
            )
            line?.let {
                Text(
                    it,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        trailing?.invoke()
    }
}

/** The day's bonus; a tap explains Brain Power and, when known, says how much the learner has. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BrainPowerReward(
    points: String,
    earned: Boolean,
    brainPower: Long?,
) {
    val state = rememberTooltipState(isPersistent = true)
    val scope = rememberCoroutineScope()
    val locale = currentLocale()
    val label = stringResource(R.string.missions_brain_power)

    TooltipBox(
        positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Below),
        tooltip = {
            RichTooltip(title = { Text(label) }) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.missions_brain_power_about, points))
                    if (brainPower !=
                        null
                    ) {
                        Text(stringResource(R.string.missions_brain_power_total, formatNumber(brainPower.toDouble(), locale)))
                    }
                }
            }
        },
        state = state,
    ) {
        Column(
            modifier =
                Modifier
                    .clip(MaterialTheme.shapes.small)
                    .clickable(role = Role.Button) { scope.launch { state.show() } }
                    .semantics(mergeDescendants = true) {}
                    .heightIn(min = 48.dp)
                    .padding(4.dp),
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            val brain = MaterialTheme.zoonk.brain
            Row(
                modifier =
                    if (earned) {
                        Modifier
                            .clip(
                                MaterialTheme.shapes.extraSmall,
                            ).background(brain)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    } else {
                        Modifier
                    },
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (earned) {
                    Icon(
                        painterResource(R.drawable.ic_check),
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.surface,
                    )
                }
                Text(
                    text = stringResource(R.string.missions_points, points),
                    color = if (earned) MaterialTheme.colorScheme.surface else MaterialTheme.zoonk.brainText,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleSmall.withTabularFigures(),
                )
            }
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
        }
    }
}

private const val TRACK_ALPHA = 0.2f
