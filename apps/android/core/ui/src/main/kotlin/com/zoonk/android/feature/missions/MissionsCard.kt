package com.zoonk.android.feature.missions

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
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
import androidx.compose.material3.PlainTooltip
import androidx.compose.material3.RichTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.expand
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.StepOpenFailed
import com.zoonk.android.ui.characters.Buddy
import com.zoonk.android.ui.characters.BuddyCrop
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.Trickster
import com.zoonk.android.ui.components.BusyContent
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.ListRowChevron
import com.zoonk.android.ui.components.busyClickable
import com.zoonk.android.ui.components.celebrates
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.StudyMission

/**
 * The day's missions (main's `MissionsCard`), one look wherever they show: the title, a track with the Brain Power
 * the missions earn together at its end, and every mission as a row. [foldRows] keeps the rows behind the title
 * (Today, where most are rows of the day's list already); [collapseWhenDone] folds a won day to one line. [opening]
 * and [openFailed] say where a row's tap stands.
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
    onLevel: () -> Unit,
    opening: (DayMission) -> Boolean = { false },
    openFailed: (DayMission) -> Boolean = { false },
    foldRows: Boolean = false,
    collapseWhenDone: Boolean = false,
) {
    if (missions.isEmpty()) return

    val locale = currentLocale()
    val points = formatNumber(bonus.toDouble(), locale)
    val progress = MissionProgress(missions)
    val won = progress.full && bonusEarned
    var unfolded by rememberSaveable { mutableStateOf(false) }
    val open = !foldRows || unfolded

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
            BrainPowerReward(points, earned = true, onLevel)
        }
        return
    }

    OutlinedCard(modifier) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = if (open) 4.dp else 16.dp)) {
            MissionsTitle(won, fold = if (foldRows) ({ unfolded = !unfolded }) else null, open = open)

            Row(
                Modifier.padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MissionTrack(progress, Modifier.weight(1f), label = missionsDoneLabel(progress))
                BrainPowerReward(points, earned = won, onLevel)
            }

            if (open) {
                Column(Modifier.padding(top = 6.dp)) {
                    missions.forEachIndexed { index, mission ->
                        if (index > 0) HorizontalDivider()
                        MissionRow(mission, buddy, buddyName, opening(mission), openFailed(mission), onOpen)
                    }
                }
            }
        }
    }
}

/** The card's title; where the rows fold, a press on it shows or hides them. */
@Composable
private fun MissionsTitle(
    won: Boolean,
    fold: (() -> Unit)?,
    open: Boolean,
) {
    val title = stringResource(if (won) R.string.missions_done else R.string.missions_title)
    val modifier =
        if (fold == null) {
            Modifier.semantics { heading() }
        } else {
            Modifier
                .clip(MaterialTheme.shapes.extraSmall)
                .clickable(role = Role.Button, onClick = fold)
                .semantics {
                    heading()
                    if (open) collapse { fold().let { true } } else expand { fold().let { true } }
                }
        }

    Row(modifier, horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.zoonkType.sectionTitle)
        if (fold != null) {
            Icon(
                painterResource(R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.size(18.dp).rotate(if (open) 180f else 0f),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
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

/** How many are done, said for the track. */
@Composable
private fun missionsDoneLabel(progress: MissionProgress): String {
    val locale = currentLocale()
    return stringResource(
        R.string.missions_progress,
        formatNumber(progress.done.toDouble(), locale),
        formatNumber(progress.total.toDouble(), locale),
    )
}

internal class MissionProgress(
    private val missions: List<DayMission>,
) {
    val done = missions.count(DayMission::done)
    val total = missions.size
    val left get() = total - done
    val full get() = total > 0 && left == 0

    /**
     * Each part's fill before and after: how far its mission got, furthest first, as main's `mission-track`. A mission in
     * [justDone] fills from the step before it.
     */
    fun fills(justDone: Collection<DayMission> = emptyList()): List<Pair<Float, Float>> {
        val after = missions.map { if (it.done) 1f else share(it.progress, it.total) }
        val before = missions.zip(after) { mission, fill -> if (mission in justDone) share(mission.total - 1, mission.total) else fill }
        return before.sortedDescending().zip(after.sortedDescending())
    }
}

private fun share(
    steps: Long,
    total: Long,
): Float = if (total > 0) (steps.coerceAtLeast(0).toFloat() / total).coerceAtMost(1f) else 0f

/**
 * When each part that moved starts filling, in milliseconds, one [ZoonkMotion.STAGGER_MILLIS] after the one before, as
 * main's `getFillMotion`; null for a part that didn't move.
 */
internal fun fillDelays(
    fills: List<Pair<Float, Float>>,
    delayMillis: Int,
): List<Int?> {
    var order = 0
    return fills.map { (start, fill) -> if (start < fill) delayMillis + ZoonkMotion.STAGGER_MILLIS * order++ else null }
}

/**
 * One part per mission, furthest first, filling in Brain Power's violet. The [justDone] fill from the step before,
 * after [delayMillis], when the screen celebrates.
 */
@Composable
internal fun MissionTrack(
    progress: MissionProgress,
    modifier: Modifier,
    justDone: Collection<DayMission> = emptyList(),
    delayMillis: Int = 0,
    label: String? = null,
) {
    val fills = progress.fills(justDone)
    val brain = MaterialTheme.zoonk.brain
    val track = brain.copy(alpha = if (MaterialTheme.colorScheme.background.luminance() < HALF) DARK_TRACK_ALPHA else TRACK_ALPHA)
    val celebrate = celebrates()
    val delays = fillDelays(fills, delayMillis)

    Row(
        modifier.fillMaxWidth().clearAndSetSemantics { label?.let { contentDescription = it } },
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        fills.zip(delays).forEach { (part, delay) ->
            val (start, fill) = part
            val animates = celebrate && delay != null
            val motion = remember { Animatable(if (animates) 0f else 1f) }
            LaunchedEffect(animates) {
                if (animates) motion.animateTo(1f, tween(ZoonkMotion.BEAT_MILLIS * 2, delay, ZoonkMotion.EaseOut))
            }
            Box(
                Modifier
                    .weight(1f)
                    .height(TRACK_HEIGHT)
                    .clip(MaterialTheme.shapes.extraSmall)
                    .background(track),
            ) {
                Box(Modifier.fillMaxWidth(start + (fill - start) * motion.value).height(TRACK_HEIGHT).background(brain))
            }
        }
    }
}

/** Main's `bg-brain/15 dark:bg-brain/30`. */
private const val TRACK_ALPHA = 0.15f
private const val DARK_TRACK_ALPHA = 0.3f
private const val HALF = 0.5f
private val TRACK_HEIGHT = 6.dp

@Composable
private fun MissionRow(
    mission: DayMission,
    buddy: BuddyLook,
    buddyName: String,
    busy: Boolean,
    openFailed: Boolean,
    onOpen: (MissionOpens) -> Unit,
) {
    val opens = mission.opens?.takeIf { !mission.done && mission.waitReason == null }

    MissionListRow(
        name = missionName(mission, buddyName),
        line = if (mission.done) null else missionStepLine(mission),
        done = mission.done,
        muted = mission.done || mission.waitReason != null,
        mark = { MissionMark(mission.kind, mission.done, buddy) },
        openLabel = missionOpenLabel(mission, buddyName),
        onOpen = opens?.let { { onOpen(it) } },
        busy = busy,
        openFailed = openFailed,
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
    busy: Boolean = false,
    openFailed: Boolean = false,
    trailing: (@Composable () -> Unit)? = null,
) {
    val doneLabel = stringResource(R.string.today_step_done)
    val chevron = onOpen != null && trailing == null

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .then(
                    if (onOpen != null) {
                        Modifier.busyClickable(busy, onClickLabel = openLabel, onClick = onOpen)
                    } else {
                        Modifier
                    },
                ).semantics { if (done) stateDescription = doneLabel }
                .heightIn(min = 48.dp)
                .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(20.dp), contentAlignment = Alignment.Center) { BusyContent(busy && !chevron, mark) }

        Column(Modifier.weight(1f)) {
            Text(
                text = name,
                color = if (muted) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.titleSmall,
            )
            if (openFailed) StepOpenFailed()
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
        if (chevron) BusyContent(busy) { ListRowChevron() }
    }
}

/** The amount shows the unit's short form; a hover or a long press names the unit in full, and a tap opens the level page. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BrainPowerReward(
    points: String,
    earned: Boolean,
    onLevel: () -> Unit,
) {
    val amount = stringResource(R.string.missions_points, points)
    val name = stringResource(R.string.missions_brain_power)
    val spoken = "$amount $name"

    TooltipBox(
        positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
        tooltip = { PlainTooltip { Text(name) } },
        state = rememberTooltipState(),
    ) {
        Row(
            modifier =
                Modifier
                    .clip(MaterialTheme.shapes.small)
                    .clickable(role = Role.Button, onClick = onLevel)
                    .clearAndSetSemantics { contentDescription = spoken }
                    .heightIn(min = 32.dp)
                    .padding(horizontal = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // brainText, since the page's color on brain is under AA in light.
            val fill = MaterialTheme.zoonk.brainText
            Row(
                modifier =
                    if (earned) {
                        Modifier
                            .clip(MaterialTheme.shapes.extraSmall)
                            .background(fill)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    } else {
                        Modifier
                    },
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    painterResource(if (earned) R.drawable.ic_check else R.drawable.ic_psychology),
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = if (earned) MaterialTheme.colorScheme.surface else MaterialTheme.zoonk.brain,
                )
                Text(
                    text = amount,
                    color = if (earned) MaterialTheme.colorScheme.surface else MaterialTheme.zoonk.brainText,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.zoonkType.data.withTabularFigures(),
                )
            }
            Text(
                stringResource(R.string.missions_brain_power_short),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}
