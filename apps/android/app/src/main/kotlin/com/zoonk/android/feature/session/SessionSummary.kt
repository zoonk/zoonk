package com.zoonk.android.feature.session

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.ui.characters.ActReaction
import com.zoonk.android.ui.characters.BuddyAct
import com.zoonk.android.ui.characters.BuddyActor
import com.zoonk.android.ui.characters.BuddyCrop
import com.zoonk.android.ui.characters.BuddyExpression
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.BeltDot
import com.zoonk.android.ui.components.BeltTicks
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.StatTile
import com.zoonk.android.ui.components.StatTiles
import com.zoonk.android.ui.components.StatTone
import com.zoonk.android.ui.components.StepDots
import com.zoonk.android.ui.components.celebrates
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.formatProgressShare
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.StudyMission
import com.zoonk.api.models.StudySessionSummary
import com.zoonk.api.models.StudySessionSummaryBelt
import com.zoonk.api.models.StudySessionSummarySkillsMovedInner
import com.zoonk.api.models.TodayGoal
import kotlinx.datetime.toJavaLocalDate

/** What the summary needs beyond the session's own numbers. [bonus] is the day's missions bonus, from its session. */
internal data class SummaryFacts(
    val stopped: Boolean,
    val goalKind: TodayGoal.Kind?,
    val bonus: Long,
    val guest: Boolean,
)

internal class SummaryActions(
    val keepGoing: () -> Unit,
    val extraTime: () -> Unit,
    val seeMistakes: () -> Unit,
    val signUp: () -> Unit,
    val finish: () -> Unit,
)

/**
 * Main's `SessionSummary`: how the session went, then what it earned. A phone shows the rewards as
 * a second step; a wide window keeps them beside the session, as main's "Earned today" does.
 */
@Composable
internal fun SessionSummary(
    summary: StudySessionSummary,
    facts: SummaryFacts,
    buddy: BuddyLook,
    buddyName: String,
    busy: SessionAction?,
    failed: SessionAction?,
    actions: SummaryActions,
) {
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)
    val stepped = !wide && !facts.stopped && summary.hasRewardsBeyondBrainPower()
    var onRewards by rememberSaveable { mutableStateOf(false) }
    var leftRewards by rememberSaveable { mutableStateOf(false) }
    val rewardsShown = stepped && onRewards

    BackHandler(enabled = rewardsShown) {
        onRewards = false
        leftRewards = true
    }

    TaskScaffold(
        onClose = actions.finish,
        title = { if (stepped) StepDots(count = 2, index = if (rewardsShown) 1 else 0) },
        bottomBar = {
            SummaryBar(
                summary = summary,
                facts = facts,
                busy = busy,
                failed = failed,
                actions = actions,
                toRewards = if (stepped && !rewardsShown) ({ onRewards = true }) else null,
                fromRewards =
                    if (rewardsShown) {
                        {
                            onRewards = false
                            leftRewards = true
                        }
                    } else {
                        null
                    },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                modifier = Modifier.widthIn(max = 960.dp).padding(horizontal = 16.dp, vertical = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(32.dp),
            ) {
                Column(Modifier.weight(1f)) {
                    // Going back to a step already seen shows it still.
                    CelebrationScope(play = !leftRewards) {
                        if (rewardsShown) {
                            RewardsStep(summary, facts, buddy, buddyName)
                        } else {
                            DoneStep(summary, facts, wide)
                        }
                    }
                }
                if (wide) {
                    Column(Modifier.widthIn(max = 320.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        SectionLabel(stringResource(R.string.session_summary_earned_today))
                        Rewards(summary, facts, buddy, buddyName, title = null)
                    }
                }
            }
        }
    }
}

@Composable
private fun DoneStep(
    summary: StudySessionSummary,
    facts: SummaryFacts,
    wide: Boolean,
) {
    val locale = currentLocale()
    val time = formatMinutes(summary.minutes.toInt(), locale)
    val title =
        when {
            facts.stopped -> stringResource(R.string.session_summary_done_for_now)
            summary.minutes < 1 -> stringResource(R.string.session_summary_done_under_minute)
            else -> stringResource(R.string.session_summary_done_in, time)
        }

    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                stringResource(R.string.session_summary_eyebrow),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelLarge,
            )
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
            if (facts.stopped && summary.minutes >= 1) {
                Text(
                    stringResource(R.string.session_summary_so_far, time),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        SessionNumbers(summary, facts, brainPowerTile = !wide)
        SkillRises(summary)
        summary.tomorrow?.takeIf { !facts.stopped }?.let { tomorrow ->
            SummaryList(stringResource(R.string.session_summary_tomorrow)) {
                SummaryRow(R.drawable.ic_menu_book) { Text(tomorrow.title, style = MaterialTheme.typography.bodyLarge) }
            }
        }
    }
}

@Composable
private fun SessionNumbers(
    summary: StudySessionSummary,
    facts: SummaryFacts,
    brainPowerTile: Boolean,
) {
    val locale = currentLocale()
    val goalNumber = goalNumber(summary, facts.goalKind)
    val right = stringResource(R.string.session_summary_right)
    val reviewLabel = stringResource(R.string.session_summary_to_review)
    val brainLabel = stringResource(R.string.session_summary_brain_power)
    val answers =
        summary.takeIf { it.questions > 0 }?.let {
            Triple(
                "${formatNumber(it.correct.toDouble(), locale)}/${formatNumber(it.questions.toDouble(), locale)}",
                stringResource(R.string.session_summary_right_spoken, it.correct.toInt(), it.questions.toInt()),
                rightDetail(it),
            )
        }
    val goalLabel =
        goalNumber?.let {
            stringResource(
                if (it.exam) R.string.session_summary_preparation else R.string.session_summary_progress,
            )
        }
    val backOn =
        summary.comesBack
            .takeIf { it.isNotEmpty() }
            ?.let { days ->
                stringResource(
                    R.string.session_summary_back_on,
                    formatList(days.map { formatDate(it.date.toJavaLocalDate(), locale) }, locale),
                )
            }
    val belt =
        summary.belt?.let { change ->
            beltOf(change.after.color)?.let {
                stringResource(R.string.belt_level, stringResource(it.label), formatNumber(change.after.level.toDouble(), locale))
            }
        }
    val earned = stringResource(R.string.session_summary_plus, formatNumber(summary.brainPower.toDouble(), locale))

    val tiles =
        buildList<@Composable (Modifier) -> Unit> {
            answers?.let { (value, spoken, detail) ->
                add { modifier ->
                    StatTile(right, value, modifier, detail, StatTone.Success, summaryIcon(R.drawable.ic_target), spokenValue = spoken)
                }
            }
            if (goalNumber != null && goalLabel != null) {
                add { modifier ->
                    // A number that went down says so quietly, never in the color of progress.
                    StatTile(
                        label = goalLabel,
                        value = goalNumber.after,
                        modifier = modifier,
                        detail = goalNumber.before?.let { "$it → ${goalNumber.after}" },
                        tone = if (goalNumber.dropped) StatTone.Neutral else StatTone.Success,
                        icon = summaryIcon(if (goalNumber.dropped) R.drawable.ic_trending_down else R.drawable.ic_trending_up),
                    )
                }
            }
            add { modifier ->
                val skills = summary.comesBack.sumOf { it.skills }
                StatTile(reviewLabel, formatNumber(skills.toDouble(), locale), modifier, backOn, icon = summaryIcon(R.drawable.ic_replay))
            }
            if (brainPowerTile) {
                add { modifier -> StatTile(brainLabel, earned, modifier, belt, StatTone.Brain, summaryIcon(R.drawable.ic_psychology)) }
            }
        }

    StatTiles(columns = 2, tiles = tiles)
}

private fun summaryIcon(icon: Int): @Composable (Modifier) -> Unit = { modifier -> Icon(painterResource(icon), null, modifier) }

@Composable
private fun rightDetail(summary: StudySessionSummary): String? {
    val locale = currentLocale()
    val parts =
        listOfNotNull(
            summary.accuracy?.let { formatPercent(it, locale) },
            summary.netScore?.let { stringResource(R.string.session_summary_net, formatNumber(it.toDouble(), locale)) },
        )
    return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
}

private class GoalNumber(
    val exam: Boolean,
    val after: String,
    val before: String?,
    val dropped: Boolean,
)

/** An exam's preparation or a goal's progress; a language goal has neither. [GoalNumber.before] only when it moved. */
@Composable
private fun goalNumber(
    summary: StudySessionSummary,
    kind: TodayGoal.Kind?,
): GoalNumber? {
    if (kind == TodayGoal.Kind.LANGUAGE) return null
    val locale = currentLocale()
    val exam = kind == TodayGoal.Kind.EXAM
    val after = (if (exam) summary.preparation.after else summary.progress.after) ?: return null
    val start = (if (exam) summary.preparation.before else summary.progress.before) ?: after
    val format = { share: Double -> if (exam) formatPercent(share, locale) else formatProgressShare(share, locale) }
    val shownAfter = format(after)
    val shownBefore = format(start)
    val moved = shownAfter != shownBefore
    return GoalNumber(exam, shownAfter, shownBefore.takeIf { moved }, dropped = moved && after < start)
}

@Composable
private fun SkillRises(summary: StudySessionSummary) {
    val rises = risenSkills(summary.skillsMoved)
    if (rises.isEmpty()) return

    SummaryList(stringResource(R.string.session_summary_skills_rose)) {
        rises.forEach { move ->
            val from = skillStateLabel(move.from.value)
            val to = skillStateLabel(move.to.value)
            SummaryRow(icon = null) {
                Text(move.name, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
                Text(
                    text =
                        buildAnnotatedString {
                            append("$from → ")
                            withStyle(SpanStyle(color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)) { append(to) }
                        },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
    }
}

@Composable
private fun skillStateLabel(state: String): String =
    stringResource(
        when (state) {
            "learning" -> R.string.goalcontent_skill_learning
            "solid" -> R.string.goalcontent_skill_solid
            "mastered" -> R.string.goalcontent_skill_mastered
            else -> R.string.goalcontent_new
        },
    )

@Composable
private fun RewardsStep(
    summary: StudySessionSummary,
    facts: SummaryFacts,
    buddy: BuddyLook,
    buddyName: String,
) {
    Rewards(summary, facts, buddy, buddyName, title = stringResource(R.string.session_summary_rewards))
}

/** [title] heads the step when nothing was earned in Brain Power; beside the session it needs none. */
@Composable
private fun Rewards(
    summary: StudySessionSummary,
    facts: SummaryFacts,
    buddy: BuddyLook,
    buddyName: String,
    title: String?,
) {
    val locale = currentLocale()
    val missionsDone = summary.missionsDone()
    val belt = summary.belt?.takeIf { it.stripesGained > 0 }
    val streak = summary.bestStreak.takeIf { it >= SHOWN_STREAK }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        BuddyActor(
            look = buddy,
            modifier = Modifier.size(96.dp),
            expression = BuddyExpression.Happy,
            crop = BuddyCrop.Whole,
            reaction = if (celebrates()) ActReaction(BuddyAct.Proud, ZoonkMotion.BEAT_MILLIS) else null,
            label = stringResource(R.string.session_summary_buddy_happy, buddyName),
        )
        if (summary.brainPower > 0) {
            MomentReadouts(summary.brainPower, Modifier.semantics { heading() })
        } else if (title != null) {
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
        }
        if (missionsDone || belt != null || streak != null) {
            SummaryList(title = null) {
                if (missionsDone) {
                    val count = summary.missions.size
                    SummaryRow(R.drawable.ic_checklist) {
                        Column(Modifier.weight(1f)) {
                            Text(stringResource(R.string.missions_title), style = MaterialTheme.typography.bodyLarge)
                            Text(
                                if (count == 1) {
                                    stringResource(R.string.session_summary_mission_done)
                                } else {
                                    pluralStringResource(R.plurals.session_summary_missions_done, count, count)
                                },
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        RewardValue(
                            stringResource(R.string.session_summary_plus, formatNumber(facts.bonus.toDouble(), locale)),
                            brain = true,
                        )
                    }
                }
                belt?.let { BeltRow(it) }
                streak?.let {
                    SummaryRow(R.drawable.ic_keyboard_double_arrow_up) {
                        Text(
                            stringResource(R.string.session_summary_streak, formatNumber(it.toDouble(), locale)),
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
            }
        }
    }
}

/** The ticks hold still: each level already landed at the end of the block that reached it. */
@Composable
private fun BeltRow(change: StudySessionSummaryBelt) {
    val belt = beltOf(change.after.color) ?: return
    val level = change.after.level.toInt()
    val gained = change.stripesGained.toInt()

    Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            BeltDot(belt)
            Text(
                stringResource(R.string.belt_level, stringResource(belt.label), formatNumber(level.toDouble(), currentLocale())),
                Modifier.weight(1f),
                style = MaterialTheme.typography.bodyLarge,
            )
            RewardValue(pluralStringResource(R.plurals.session_summary_levels_gained, gained, gained), brain = false)
        }
        BeltTicks(belt, level)
    }
}

@Composable
private fun RewardValue(
    text: String,
    brain: Boolean,
) {
    Text(
        text = text,
        color = if (brain) MaterialTheme.zoonk.brainText else MaterialTheme.colorScheme.tertiary,
        style = MaterialTheme.typography.labelLarge,
    )
}

@Composable
private fun SummaryList(
    title: String?,
    rows: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        title?.let { SectionLabel(it) }
        OutlinedCard(Modifier.fillMaxWidth()) { rows() }
    }
}

@Composable
private fun SummaryRow(
    icon: Int?,
    content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let { Icon(painterResource(it), null, Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant) }
        content()
    }
}

/**
 * Main's summary buttons. On a phone, the extra time sits only beside Finish: two buttons that keep
 * studying would leave the learner guessing which one does.
 */
@Composable
private fun SummaryBar(
    summary: StudySessionSummary,
    facts: SummaryFacts,
    busy: SessionAction?,
    failed: SessionAction?,
    actions: SummaryActions,
    toRewards: (() -> Unit)?,
    fromRewards: (() -> Unit)?,
) {
    val locale = currentLocale()
    val extraTime = summary.extraTime.takeIf { !facts.stopped && it.available && toRewards == null }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (failed == SessionAction.KeepGoing) SummaryError()
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            fromRewards?.let { OutlinedButton(onClick = it) { Text(stringResource(R.string.navigation_back)) } }
            if (fromRewards == null && summary.mistakesSaved > 0) {
                OutlinedButton(onClick = actions.seeMistakes) { Text(stringResource(R.string.session_summary_see_mistakes)) }
            }
            if (facts.stopped) {
                OutlinedButton(
                    onClick = actions.keepGoing,
                    enabled = busy == null,
                ) { Text(stringResource(R.string.session_summary_keep_going)) }
            }
            if (toRewards != null) {
                Button(onClick = toRewards) { Text(stringResource(R.string.steps_continue)) }
            } else {
                Button(onClick = actions.finish) { Text(stringResource(R.string.session_summary_finish)) }
            }
        }
        extraTime?.let { extra ->
            TextButton(onClick = actions.extraTime, modifier = Modifier.fillMaxWidth(), enabled = busy == null) {
                Text(
                    if (extra.lessons.isNotEmpty()) {
                        stringResource(R.string.today_keep_learning)
                    } else {
                        stringResource(R.string.today_study_more_minutes, formatNumber(extra.minutes.toDouble(), locale))
                    },
                )
            }
            if (failed == SessionAction.ExtraTime) SummaryError()
        }
        if (facts.guest) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.Center) {
                Text(
                    stringResource(R.string.session_summary_save_note),
                    Modifier.align(Alignment.CenterVertically),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                TextButton(onClick = actions.signUp) { Text(stringResource(R.string.session_summary_create_account)) }
            }
        }
    }
}

@Composable
private fun SummaryError() {
    Text(
        stringResource(R.string.today_open_failed),
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

internal fun beltOf(color: String): Belt? = Belt.entries.firstOrNull { it.name.equals(color, ignoreCase = true) }

/** The bonus is once a day across goals, so another goal's earning it never says this goal's missions are done. */
internal fun StudySessionSummary.missionsDone(): Boolean =
    fullMeal && missions.isNotEmpty() && missions.all { it.status == StudyMission.Status.DONE }

internal fun StudySessionSummary.hasRewardsBeyondBrainPower(): Boolean =
    missionsDone() || (belt?.stripesGained ?: 0) > 0 || bestStreak >= SHOWN_STREAK

/** A skill that slipped back is memory's to bring back, not news for the end of the day. */
internal fun risenSkills(moves: List<StudySessionSummarySkillsMovedInner>): List<StudySessionSummarySkillsMovedInner> =
    moves.filter { rank(it.to.value) > rank(it.from.value) }.take(SHOWN_RISES)

private fun rank(state: String): Int = STATE_RANK.indexOf(state)

private val STATE_RANK = listOf("new", "learning", "solid", "mastered")
private const val SHOWN_STREAK = 3
private const val SHOWN_RISES = 2
