package com.zoonk.android.feature.catalog

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.CatalogFirstQuestion
import com.zoonk.api.models.LearnerSummaryGoal
import java.util.Locale
import kotlin.math.roundToLong

/** Main's readable column (`max-w-column`) on any window. */
internal val COLUMN_WIDTH = 640.dp

/** Main's `max-w-[30rem]` for a plan's sentences. */
internal val RESULT_LINE_WIDTH = 480.dp

/** A visitor reads "no account needed" notes; a learner or guest already has one, and while the session is read nobody does. */
@Composable
internal fun isVisitor(app: AppContainer): Boolean {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    return session is SessionState.SignedOut
}

/** Main offers "Continue your plan" when a goal already follows the course, since starting again would only lead back to it. */
@Composable
internal fun followsCourse(
    app: AppContainer,
    courseId: String,
): Boolean {
    val summary by app.learnerSummary.summary.collectShown()

    return summary.value?.goals.orEmpty().any { goal ->
        goal.courseId?.toString() == courseId &&
            goal.status == LearnerSummaryGoal.Status.ACTIVE &&
            goal.kind != LearnerSummaryGoal.Kind.EXPLAIN
    }
}

/** Main's `getTotalDuration`: minutes under an hour, rounded hours ("~3 hr") after. */
internal fun formatTotalDuration(
    totalMinutes: Double,
    locale: Locale,
): String {
    val minutes = totalMinutes.roundToLong()
    if (minutes < MINUTES_PER_HOUR) return formatMinutes(minutes.toInt(), locale)

    val hours = (minutes.toDouble() / MINUTES_PER_HOUR).roundToLong()
    return "~" + formatDuration(hours * MINUTES_PER_HOUR * SECONDS_PER_MINUTE, locale)
}

/** Scales with the text, as main's `size-10` mark does with the page's font. */
@Composable
internal fun markDp(size: Int): Dp = with(LocalDensity.current) { size.sp.toDp() }

/** A language course's flag, else its picture, else main's neutral `SubjectIcon`. */
@Composable
internal fun CourseMark(
    app: AppContainer,
    imageUrl: String?,
    languageFlag: String?,
    targetLanguage: String?,
    modifier: Modifier = Modifier,
    size: Dp = markDp(MARK_SIZE),
) {
    val flag = languageFlag?.let(::flagEmoji)
    val context = LocalContext.current

    when {
        flag != null -> {
            val label = targetLanguage?.let { Locale.forLanguageTag(it).getDisplayLanguage(currentLocale()) }.orEmpty()

            Box(modifier.size(size).clearAndSetSemantics { contentDescription = label }, contentAlignment = Alignment.Center) {
                Text(flag, style = MaterialTheme.typography.headlineMedium)
            }
        }

        imageUrl != null -> {
            AsyncImage(
                model = app.images.request(context, imageUrl, null),
                imageLoader = app.images.loader,
                contentDescription = null,
                modifier =
                    modifier
                        .size(size)
                        .clip(MaterialTheme.shapes.small)
                        .background(MaterialTheme.colorScheme.surfaceContainerHighest),
            )
        }

        else -> {
            Box(
                modifier =
                    modifier
                        .size(size)
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.shapes.small),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painterResource(R.drawable.ic_library_books),
                    contentDescription = null,
                    modifier = Modifier.size(size / 2),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** A country's two letters as its flag; regions (`es-ct`, `arab`) have no standard emoji. */
internal fun flagEmoji(code: String): String? {
    if (code.length != 2 || !code.all { it.isLetter() }) return null
    return code.uppercase().map { Character.toChars(REGIONAL_INDICATOR_A + (it - 'A')).concatToString() }.joinToString("")
}

@Composable
internal fun LineWithIcon(
    @DrawableRes icon: Int,
    text: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurfaceVariant,
    style: TextStyle = MaterialTheme.typography.bodyMedium,
) {
    LineWithIcon(icon, AnnotatedString(text), modifier, color, style)
}

@Composable
internal fun LineWithIcon(
    @DrawableRes icon: Int,
    text: AnnotatedString,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurfaceVariant,
    style: TextStyle = MaterialTheme.typography.bodyMedium,
) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(
            painterResource(icon),
            contentDescription = null,
            modifier = Modifier.padding(top = 2.dp).size(markDp(ICON_SIZE)),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(text, color = color, style = style)
    }
}

@Composable
internal fun PlanLine(
    startsHere: Boolean,
    modifier: Modifier = Modifier,
) {
    LineWithIcon(
        icon = R.drawable.ic_map,
        text = stringResource(if (startsHere) R.string.catalog_plan_line_chapter else R.string.catalog_plan_line),
        modifier = modifier,
    )
}

/**
 * Main's start block: "Build my plan" (or "Continue your plan" for a goal that follows the course),
 * "Try a lesson" where the page has one to scroll to, and the visitor's note under them.
 */
@Composable
internal fun StartActions(
    app: AppContainer,
    navigator: AppNavigator,
    courseId: String,
    modifier: Modifier = Modifier,
    chapterId: String? = null,
    dailyMinutes: Long? = null,
    note: String? = null,
    secondary: Boolean = false,
    onTryLesson: (() -> Unit)? = null,
) {
    val follows = followsCourse(app, courseId)
    val visitorNote = if (isVisitor(app)) stringResource(R.string.catalog_start_free) else null

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val start = {
                navigator.open(
                    AppRoute.CourseStart(
                        courseId = courseId,
                        chapterId = chapterId.takeUnless { follows },
                        dailyMinutes = dailyMinutes?.toInt().takeUnless { follows },
                    ),
                )
            }
            val label = @Composable {
                Text(stringResource(if (follows) R.string.catalog_continue_plan else R.string.catalog_build_plan))
                Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                Icon(
                    painterResource(R.drawable.ic_arrow_forward),
                    contentDescription = null,
                    modifier = Modifier.size(ButtonDefaults.IconSize),
                )
            }

            if (secondary) {
                FilledTonalButton(onClick = start, contentPadding = ButtonDefaults.ButtonWithIconContentPadding) { label() }
            } else {
                Button(onClick = start, contentPadding = ButtonDefaults.ButtonWithIconContentPadding) { label() }
            }

            if (onTryLesson != null) {
                FilledTonalButton(onClick = onTryLesson) { Text(stringResource(R.string.catalog_try_lesson)) }
            }
        }

        (note ?: visitorNote)?.let { LineWithIcon(R.drawable.ic_play_circle, it, style = MaterialTheme.typography.bodySmall) }
    }
}

/** Main's `TryLesson` card: the lesson's first question, answered right here, which opens the lesson with that answer. */
@Composable
internal fun TryLessonCard(
    app: AppContainer,
    navigator: AppNavigator,
    lessonId: String,
    chapterTitle: String,
    number: Long,
    minutes: Long,
    screen: CatalogFirstQuestion,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()

    OutlinedCard(modifier.widthIn(max = COLUMN_WIDTH)) {
        Column(Modifier.padding(20.dp)) {
            Text(
                text = stringResource(R.string.catalog_try_title, formatMinutes(minutes.toInt(), locale)),
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.labelLarge,
            )
            Spacer(Modifier.size(4.dp))
            Text(
                text = stringResource(R.string.catalog_try_place, chapterTitle, formatNumber(number.toDouble(), locale)),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
            Spacer(Modifier.size(20.dp))
            FirstQuestion(app, navigator, lessonId, minutes, screen)
        }
    }
}

@Composable
internal fun FirstQuestion(
    app: AppContainer,
    navigator: AppNavigator,
    lessonId: String,
    minutes: Long,
    screen: CatalogFirstQuestion,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val minutesText = formatNumber(minutes.toDouble(), locale)

    Column(modifier) {
        LineWithIcon(
            icon = R.drawable.ic_auto_awesome,
            text = stringResource(if (screen.guess) R.string.catalog_guess_first else R.string.catalog_quick_question),
            style = MaterialTheme.typography.labelLarge,
        )

        screen.context?.let { context ->
            Spacer(Modifier.size(12.dp))
            RichText(context, style = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
        }

        Spacer(Modifier.size(8.dp))
        RichText(screen.question, style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.size(20.dp))

        AnswerOptionGroup {
            screen.options.forEachIndexed { index, option ->
                AnswerOption(
                    marker = index + 1,
                    picked = false,
                    result = null,
                    onClick = { navigator.open(AppRoute.Lesson(lessonId, firstAnswer = option.id)) },
                ) {
                    RichInlineText(option.text, style = MaterialTheme.typography.bodyLarge)
                }
            }
        }

        Spacer(Modifier.size(20.dp))

        val note = stringResource(if (screen.guess) R.string.catalog_guess_note else R.string.catalog_check_note, minutesText)
        val visitor = if (isVisitor(app)) " " + stringResource(R.string.catalog_no_sign_up) else ""
        LineWithIcon(R.drawable.ic_play_circle, note + visitor, style = MaterialTheme.typography.bodySmall)
    }
}

internal enum class DayStepState { Done, Current, Ahead }

internal data class DayStep(
    val id: String,
    val title: String,
    val detail: String?,
    val minutes: Double,
    val state: DayStepState,
)

/** Main's `DayList`: a day's lessons, the current one on its tint, done ones marked. */
@Composable
internal fun DayList(
    steps: List<DayStep>,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()

    OutlinedCard(modifier.fillMaxWidth()) {
        steps.forEach { step ->
            val current = step.state == DayStepState.Current

            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(if (current) MaterialTheme.colorScheme.surfaceContainerHigh else MaterialTheme.colorScheme.surface)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (step.state == DayStepState.Done) {
                    DoneMark()
                } else {
                    KindMark(LearnKind.Lesson)
                }

                Column(Modifier.weight(1f)) {
                    Text(
                        step.title,
                        color =
                            if (step.state ==
                                DayStepState.Done
                            ) {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            } else {
                                MaterialTheme.colorScheme.onSurface
                            },
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                    )
                    if (step.state != DayStepState.Done && step.detail != null) {
                        Text(step.detail, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    }
                }

                Text(
                    formatTotalDuration(step.minutes, locale),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }
    }
}

/** A title with its facts beside it ("Lessons · 3 short lessons · 20 min"), as main's section titles. */
@Composable
internal fun SectionTitle(
    title: String,
    modifier: Modifier = Modifier,
    facts: String? = null,
) {
    FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(12.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
        if (facts != null) {
            Text(
                facts,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }
    }
}

@Composable
internal fun CheckLines(
    lines: List<String>,
    modifier: Modifier = Modifier,
) {
    Column(modifier.widthIn(max = COLUMN_WIDTH), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        lines.forEach { line ->
            LineWithIcon(R.drawable.ic_check, line, color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

private const val MARK_SIZE = 40
private const val ICON_SIZE = 16
private const val MINUTES_PER_HOUR = 60L
private const val SECONDS_PER_MINUTE = 60L
private const val REGIONAL_INDICATOR_A = 0x1F1E6
