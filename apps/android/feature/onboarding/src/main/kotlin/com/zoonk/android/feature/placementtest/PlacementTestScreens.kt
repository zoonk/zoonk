package com.zoonk.android.feature.placementtest

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.TestContext
import com.zoonk.android.data.TestRow
import com.zoonk.android.data.TrackShown
import com.zoonk.android.feature.focustest.Pressed
import com.zoonk.android.feature.onboarding.setup.FinishFailed
import com.zoonk.android.feature.onboarding.setup.SetupContent
import com.zoonk.android.feature.onboarding.start.OnboardingActions
import com.zoonk.android.feature.onboarding.start.OnboardingHeading
import com.zoonk.android.feature.onboarding.start.OnboardingSubject
import com.zoonk.android.feature.plan.lessonsSkippedLine
import com.zoonk.android.feature.plan.restoredLessonsLine
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.Facts
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.Readout
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.controlInk
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.BarError
import com.zoonk.android.ui.theme.ZoonkRadius

/**
 * One way to start (main's `TestOfferCard`): a test with its kind's mark, the most it asks and its minutes as the
 * readout, or the first lesson by its name where it's known.
 */
internal data class OfferCard(
    val id: TestRow,
    val label: String,
    val kind: LearnKind,
    val line: String? = null,
    val minutes: Int? = null,
)

/** "First lesson": the other way to start, by the lesson's name where onboarding knows it. */
@Composable
internal fun firstLessonCard(title: String?) =
    OfferCard(TestRow.FirstLesson, stringResource(R.string.placementtest_first_lesson), LearnKind.Lesson, line = title)

/** A test's card: the most questions it asks (it can end sooner) and about how long they take. */
@Composable
internal fun testCard(
    id: TestRow,
    label: String,
    questions: Int?,
    minutes: Int?,
) = OfferCard(
    id = id,
    label = label,
    kind = LearnKind.Mock,
    line = questions?.let { pluralStringResource(R.plurals.placementtest_up_to_questions, it, it) },
    minutes = minutes?.takeIf { it > 0 },
)

/**
 * Main's `TestOffer`, one piece for every test: a title, one sentence, and each way to start as a card. With two
 * cards [initial] comes picked and the main action starts the picked one; a test offered alone is its card and the way
 * in. [onNotNow] is the Plan's way out; onboarding has none, since its first lesson is the way to decline. [test] says
 * the offer was shown, once per time it shows.
 */
@Composable
internal fun ColumnScope.TestOffer(
    title: String,
    sentence: String,
    cards: List<OfferCard>,
    initial: TestRow,
    pressed: Pressed?,
    failed: Boolean,
    onChoose: (TestRow) -> Unit,
    test: TestContext,
    onNotNow: (() -> Unit)? = null,
) {
    var selected by rememberSaveable { mutableStateOf(initial.takeIf { id -> cards.any { it.id == id } } ?: cards.first().id) }
    val card = cards.firstOrNull { it.id == selected } ?: cards.first()
    TrackShown(AnalyticsEvent.TestOffered(test, cards.map { it.id }, initial))

    SetupContent {
        OnboardingHeading(title, sentence)
        Column(
            Modifier.selectableGroup().semantics { contentDescription = title },
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            cards.forEach { option ->
                OfferCardFace(
                    card = option,
                    picked = cards.size > 1 && option.id == selected,
                    onPick = { selected = option.id }.takeIf { cards.size > 1 && pressed == null },
                )
            }
        }
        OnboardingActions {
            FinishFailed(failed)
            TaskActions { main ->
                onNotNow?.let {
                    OutlinedButton(onClick = it, enabled = pressed == null) { Text(stringResource(R.string.placementtest_not_now)) }
                }
                Button(busy = pressed == Pressed.Main, onClick = { onChoose(card.id) }, modifier = main, enabled = pressed == null) {
                    Text(
                        stringResource(
                            if (card.id == TestRow.FirstLesson) R.string.onboarding_continue else R.string.placementtest_start,
                        ),
                    )
                }
            }
        }
    }
}

/** A card of the offer: the picked one in the pick's soft fill, the other on its line; a lone card has no radio. */
@Composable
private fun OfferCardFace(
    card: OfferCard,
    picked: Boolean,
    onPick: (() -> Unit)?,
) {
    val tone = answerTone(picked = picked, result = null)
    val choosable = onPick != null || picked
    Surface(
        shape = RoundedCornerShape(ZoonkRadius.option),
        color = if (picked) tone.container else Color.Transparent,
        border = if (picked) tone.border else BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier =
            Modifier.fillMaxWidth().then(
                if (choosable) {
                    Modifier.selectable(
                        selected = picked,
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        enabled = onPick != null,
                        role = Role.RadioButton,
                    ) { onPick?.invoke() }
                } else {
                    Modifier
                },
            ),
    ) {
        Row(
            Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            KindMark(card.kind, Modifier.align(Alignment.Top))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(card.label, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
                card.line?.let {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
            card.minutes?.let { Readout(formatMinutes(it, currentLocale()), style = MaterialTheme.typography.headlineSmall) }
            if (choosable) RadioButton(selected = picked, onClick = null, modifier = Modifier.controlInk())
        }
    }
}

@Composable
internal fun placementKnownLine(lessons: Int): String =
    stringResource(if (lessons == 1) R.string.placementtest_known_one else R.string.placementtest_known_other)

/** A result's next lesson, under "Up next", until an Undo puts the skipped lessons back. */
@Composable
internal fun UpNext(
    title: String,
    minutes: Int? = null,
) {
    ListRow(
        headline = { Text(title) },
        modifier = Modifier.bleed(LIST_ITEM_INSET),
        highlighted = true,
        leading = { StatusMark(MarkStatus.Next) },
        supporting = { Text(stringResource(R.string.placementtest_up_next)) },
        meta = minutes?.let { { Text(formatMinutes(it, currentLocale())) } },
    )
}

/**
 * Lessons behind the learner on the course's line, started past or studied: the progress blue, as the language result's
 * level meters show what the learner reached.
 */
@Composable
private fun passedFill(): Color = MaterialTheme.colorScheme.tertiary

/**
 * The course as one line (main's `CourseLine`): its chapters in plan order, each as wide as its lessons, the lessons
 * behind the learner (started past or already studied) filled and a ring on the chapter the learner starts in. With several areas the skipped chapters need not
 * be one run, and the start can sit before chapters with skipped lessons; each chapter draws its own share.
 */
@Composable
private fun CourseLine(course: PlacementTestPhase.Course) {
    val passed = passedFill()
    MeterParts(
        course.chapters.map { chapter ->
            val share = if (chapter.lessons > 0) (chapter.done + chapter.skipped).toFloat() / chapter.lessons else 0f
            MeterPart(
                fill =
                    when {
                        chapter.start -> MeterPart.Fill.Place(share)
                        share > 0f -> MeterPart.Fill.Solid(passed, share)
                        else -> MeterPart.Fill.Track
                    },
                weight = chapter.lessons.toFloat(),
            )
        },
    )
}

/**
 * Main's `PlacementResult`: where the course's test starts the learner. The chapter's name is the title under "You
 * start here", over the course's line, how much of it was skipped and the lesson that's next. A result that exists
 * before the plan does has no line to draw and says only where they start. A sentence shows only for what the picture
 * can't: lessons Undo put back, or skips held until tomorrow.
 */
@Composable
internal fun ColumnScope.PlacementResult(
    result: PlacementTestPhase.Result,
    action: String,
    onAction: () -> Unit,
    undo: PlacementUndoViewModel? = null,
    busy: Boolean = false,
    pressed: Pressed? = null,
    failed: Boolean = false,
) {
    val restored = undo?.restoredLessons
    val undone = restored != null
    val place = result.chapter.takeUnless { undone }
    val course = result.course.takeUnless { undone }
    SetupContent {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            place?.let { OnboardingSubject(stringResource(R.string.placementtest_you_start_here)) }
            OnboardingHeading(
                title = place ?: lessonsSkippedLine(if (undone) 0 else result.lessonsSkipped),
                description =
                    when {
                        restored != null -> restoredLessonsLine(restored)
                        result.heldUntilTomorrow && result.lessonsSkipped == 0 -> stringResource(R.string.placementtest_retake_tomorrow)
                        else -> null
                    },
                announceDescription = undone,
            )
        }
        course?.let {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                CourseLine(it)
                Facts(
                    listOf(
                        if (result.lessonsSkipped > 0) {
                            pluralStringResource(
                                R.plurals.placementtest_course_skipped,
                                result.lessonsSkipped,
                                result.lessonsSkipped,
                                it.lessons,
                            )
                        } else {
                            pluralStringResource(R.plurals.placementtest_course_lessons, it.lessons, it.lessons)
                        },
                    ),
                )
            }
            result.nextLesson?.let { title -> UpNext(title, result.nextMinutes) }
        }
        TestActions(action, onAction, busy = busy || pressed == Pressed.Main, enabled = !busy && pressed == null, failed, undo)
    }
}

/** Main's `TestOutcome`: the end of a test, what it found under its heading, and the way on. */
@Composable
internal fun ColumnScope.TestOutcome(
    title: String,
    lead: String?,
    action: String,
    onAction: () -> Unit,
    busy: Boolean = false,
    enabled: Boolean = true,
    failed: Boolean = false,
    undo: PlacementUndoViewModel? = null,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    SetupContent {
        val restored = undo?.restoredLessons
        OnboardingHeading(
            if (restored != null) lessonsSkippedLine(0) else title,
            if (restored != null) restoredLessonsLine(restored) else lead,
            announceDescription = restored != null,
        )
        content()
        TestActions(action, onAction, busy, enabled, failed, undo)
    }
}

@Composable
private fun TestActions(
    action: String,
    onAction: () -> Unit,
    busy: Boolean,
    enabled: Boolean,
    failed: Boolean,
    undo: PlacementUndoViewModel? = null,
) {
    val undoFailure = if (undo?.failed == true) stringResource(R.string.plan_undo_failed) else null
    OnboardingActions(note = undoFailure?.let { { BarError(it) } }) {
        FinishFailed(failed)
        TaskActions { main ->
            PlacementUndoButton(undo, enabled = enabled && !busy)
            Button(busy = busy, onClick = onAction, modifier = main, enabled = enabled && undo?.saving != true) { Text(action) }
        }
    }
}
