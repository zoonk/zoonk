package com.zoonk.android.feature.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonScreen
import com.zoonk.android.feature.player.engine.explanationsAfter
import com.zoonk.android.feature.player.engine.recap
import com.zoonk.android.feature.player.engine.recapMark
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.WorkedExampleStepContent
import com.zoonk.android.feature.player.steps.LessonStepVisual
import com.zoonk.android.feature.player.steps.count
import com.zoonk.android.ui.components.DisclosureRow
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.richtext.MathText
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures

/**
 * Main's "From the lesson" under a question: the screen it comes after, folded. After a miss the
 * sentence the question rests on is highlighted. Not when "Explain first" can bring the explanation.
 */
@Composable
internal fun LessonRecap(
    state: LessonPlayerState,
    screen: LessonScreen,
) {
    val step = screen.step ?: return
    val recap = remember(state) { state.recap()?.takeIf { state.explanationsAfter().isEmpty() } } ?: return
    val mark = if (state.showsMiss(screen)) step.recapMark(recap) else null
    var expanded by rememberSaveable(step.id, state.position) { mutableStateOf(false) }
    val title = recap.recapTitle

    DisclosureRow(
        title = stringResource(R.string.player_from_the_lesson),
        expanded = expanded,
        onExpandedChange = { expanded = it },
        leading = { Icon(painterResource(R.drawable.ic_format_quote), contentDescription = null) },
        modifier = Modifier.bleed(LIST_ITEM_INSET),
        supporting = title?.let { { RichInlineText(it) } },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { RecapBody(recap, mark) }
    }
}

private val LessonStep.recapTitle: String?
    get() =
        when (val content = content) {
            is StepContent.Explanation -> content.content.title
            is StepContent.WorkedExample -> content.content.title
            else -> null
        }

@Composable
private fun RecapBody(
    recap: LessonStep,
    mark: String?,
) {
    val style = MaterialTheme.typography.bodyMedium

    when (val content = recap.content) {
        is StepContent.Explanation -> {
            RichText(text = content.content.text, mark = mark, style = style)
            LessonStepVisual(content.content.visual)
        }

        is StepContent.WorkedExample -> {
            WorkedExampleRecap(content.content, mark)
        }

        is StepContent.Fact -> {
            RichText(text = content.content.text, mark = mark, style = style)
            LessonStepVisual(content.content.visual)
        }

        else -> {}
    }
}

@Composable
private fun WorkedExampleRecap(
    worked: WorkedExampleStepContent,
    mark: String?,
) {
    val style = MaterialTheme.typography.bodyMedium
    val stepsLabel = stringResource(R.string.player_worked_example_steps)

    RichText(text = worked.problem, mark = mark, style = style)

    Column(Modifier.semantics { contentDescription = stepsLabel }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        worked.steps.forEachIndexed { index, line ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = count(index + 1),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = style.withTabularFigures(),
                )
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    RichText(text = line.text, mark = mark, style = style)
                    line.math?.let { MathText(it) }
                }
            }
        }
    }

    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            stringResource(R.string.player_worked_example_result),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = style.copy(fontWeight = FontWeight.Medium),
        )
        RichInlineText(text = worked.result, mark = mark, style = style)
    }

    LessonStepVisual(worked.visual)
}
