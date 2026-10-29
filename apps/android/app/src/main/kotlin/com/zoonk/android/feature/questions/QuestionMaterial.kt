package com.zoonk.android.feature.questions

import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RichTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import com.zoonk.android.R
import com.zoonk.android.ui.components.LessonVisual
import com.zoonk.android.ui.components.PictureFrame
import com.zoonk.android.ui.components.PrivatePicture
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** What a question stands on before it's asked: its situation, picture and chart. Pictures load through [com.zoonk.android.ui.components.LocalPrivatePictures]. */
@Composable
fun ItemSupport(
    question: Question,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        question.context?.let { ItemText(it, style = MaterialTheme.typography.bodyLarge) }
        question.image?.let { image ->
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                // Main caps a question's picture at 55% of the window, as a lesson's hero.
                PrivatePicture(image.url, image.alt, image.width, image.height, PictureFrame.Hero)
            }
        }
        question.visual?.let { LessonVisual(it) }
    }
}

/**
 * The passage, case or chart a set's questions share (main's `ItemSetStimulus` for text). A long
 * passage the learner already read folds on a narrow window when [continued]; beside the
 * questions ([inAside]) it stays whole and drops its rule.
 */
@Composable
fun ItemSetText(
    set: ItemSet,
    modifier: Modifier = Modifier,
    continued: Boolean = false,
    inAside: Boolean = false,
) {
    val folds = continued && !inAside && isLongText(set.text)
    var expanded by rememberSaveable(set.id) { mutableStateOf(!folds) }
    val foldedHeight = MaterialTheme.typography.bodyMedium.lineHeightDp() * FOLDED_LINES

    Row(modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        if (!inAside) VerticalDivider(Modifier.fillMaxHeight(), thickness = 2.dp)

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SetPlace(set)
            set.title?.let { Text(text = it, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium) }
            set.text?.let { text ->
                ItemText(
                    text = text,
                    modifier =
                        if (folds && !expanded) {
                            Modifier.heightIn(max = foldedHeight).clipToBounds().fadeOut()
                        } else {
                            Modifier
                        },
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            if (folds) {
                FilledTonalButton(onClick = { expanded = !expanded }) {
                    Text(stringResource(if (expanded) R.string.questions_show_less else R.string.questions_read_again))
                    Icon(
                        painter = painterResource(R.drawable.ic_expand_more),
                        contentDescription = null,
                        modifier = Modifier.padding(start = 8.dp).size(18.dp).rotate(if (expanded) 180f else 0f),
                    )
                }
            }

            set.visual?.let { LessonVisual(it) }
            set.source?.let {
                Text(
                    text = it,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

/** A folded passage fades toward its cut, as main's mask does, so no line reads as cut in half. */
private fun Modifier.fadeOut(): Modifier =
    graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen).drawWithContent {
        drawContent()
        drawRect(Brush.verticalGradient(FADE_FROM to Color.Black, 1f to Color.Transparent), blendMode = BlendMode.DstIn)
    }

/** "Question 2 of 3 on this text". */
@Composable
fun SetPlace(
    set: ItemSet,
    modifier: Modifier = Modifier,
) {
    val position = set.position + 1
    val text =
        when (set.kind) {
            ItemSet.Kind.Audio -> stringResource(R.string.questions_set_place_audio, position, set.count)
            ItemSet.Kind.Case -> stringResource(R.string.questions_set_place_case, position, set.count)
            ItemSet.Kind.Chart -> stringResource(R.string.questions_set_place_chart, position, set.count)
            ItemSet.Kind.Text -> stringResource(R.string.questions_set_place_text, position, set.count)
        }

    Text(text = text, modifier = modifier, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
}

/** Over a placement question, so a miss feels safe. */
@Composable
fun PlacementNote(modifier: Modifier = Modifier) {
    QuestionNote(R.drawable.ic_explore, stringResource(R.string.questions_placement_note), modifier)
}

/** Past exam questions are only copied where their organizer allows it with the source cited. */
@Composable
fun QuotedSource(
    citation: Citation,
    modifier: Modifier = Modifier,
) {
    QuestionNote(R.drawable.ic_history_edu, stringResource(R.string.questions_quoted_source, citation.text), modifier)
}

@Composable
private fun QuestionNote(
    icon: Int,
    text: String,
    modifier: Modifier,
) {
    val style = MaterialTheme.typography.labelMedium

    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(
            painter = painterResource(icon),
            contentDescription = null,
            modifier = Modifier.size(style.lineHeightDp()),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = style)
    }
}

/** Where an answer comes from, with when it was checked once someone did (main's `ItemCitationNote`). */
@Composable
fun ItemCitationNote(
    citation: Citation,
    modifier: Modifier = Modifier,
) {
    FlowRow(
        modifier,
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalArrangement = Arrangement.spacedBy(8.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = citation.text,
            modifier = Modifier.padding(end = 12.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
        )
        citation.checkedAt?.let(::checkedDay)?.let { SourcesChip(citation, it) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SourcesChip(
    citation: Citation,
    checked: LocalDate,
) {
    val locale = currentLocale()
    val context = LocalContext.current
    val tooltip = rememberTooltipState(isPersistent = true)
    val scope = rememberCoroutineScope()
    val day = formatDate(checked, locale, DateStyle.Short)
    val url = citation.url

    TooltipBox(
        positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
        tooltip = {
            RichTooltip(
                title = { Text(citation.title ?: citation.text) },
                action =
                    url?.let {
                        {
                            TextButton(onClick = { CustomTabsIntent.Builder().build().launchUrl(context, it.toUri()) }) {
                                Text(stringResource(R.string.questions_open_source))
                                Icon(
                                    painterResource(R.drawable.ic_open_in_new),
                                    contentDescription = null,
                                    modifier = Modifier.padding(start = 6.dp).size(16.dp),
                                )
                            }
                        }
                    },
            ) {
                Text(
                    citation.publisher?.let { stringResource(R.string.questions_source_checked_by, it, day) }
                        ?: stringResource(R.string.questions_source_checked, day),
                )
            }
        },
        state = tooltip,
    ) {
        AssistChip(
            onClick = { scope.launch { tooltip.show() } },
            label = { Text(stringResource(R.string.questions_sources_chip, formatDate(checked, locale, DateStyle.MonthShort))) },
            colors =
                AssistChipDefaults.assistChipColors(
                    labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    leadingIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                ),
            leadingIcon = {
                Icon(
                    painterResource(R.drawable.ic_menu_book),
                    contentDescription = null,
                    modifier = Modifier.size(AssistChipDefaults.IconSize),
                )
            },
        )
    }
}

private fun checkedDay(checkedAt: String): LocalDate? =
    runCatching {
        Instant.parse(checkedAt).atZone(ZoneOffset.UTC).toLocalDate()
    }.getOrNull()

/** About where a phone starts folding a set's text, and where an aside gives it half the window. */
internal fun isLongText(text: String?): Boolean = (text?.length ?: 0) >= LONG_TEXT_CHARACTERS

private const val LONG_TEXT_CHARACTERS = 400
private const val FOLDED_LINES = 4
private const val FADE_FROM = 0.4f
