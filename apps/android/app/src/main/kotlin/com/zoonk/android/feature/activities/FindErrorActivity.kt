package com.zoonk.android.feature.activities

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf29Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf29Value as FindErrorContent

val findErrorRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_badge_find_error, R.drawable.ic_document_search) },
        canvas = { FindErrorActivity(it) },
        keyPick = { content, index ->
            (content as FindErrorContent)
                .value.fields.steps
                .getOrNull(index)
                ?.let { selectionAnswer(listOf(it.id)) }
        },
    )

@Composable
private fun FindErrorActivity(props: ActivityProps) {
    val fields = (props.content as FindErrorContent).value.fields
    val pickedId = props.answer.selectionIds?.firstOrNull()
    val errorId = props.expected.selectionIds?.firstOrNull()
    val isAi = fields.author == PlayableLibraryStepAnyOfContentOneOf29Fields.Author.AI
    val description =
        if (isAi) {
            pluralStringResource(R.plurals.activities_find_error_ai_description, fields.steps.size, fields.steps.size)
        } else {
            pluralStringResource(R.plurals.activities_find_error_description, fields.steps.size, fields.steps.size)
        }

    ActivityCanvas(description) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            ActivityCanvasLabel(
                stringResource(if (isAi) R.string.activities_find_error_ai_asked else R.string.activities_find_error_problem),
            )
            RichText(fields.problem, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
        }
        if (isAi) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(
                    painterResource(R.drawable.ic_smart_toy),
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    stringResource(R.string.activities_find_error_ai_note),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        val listLabel = stringResource(if (isAi) R.string.activities_find_error_ai_answer else R.string.activities_find_error_worked)
        Column(Modifier.selectableGroup().semantics { contentDescription = listLabel }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            fields.steps.forEachIndexed { index, step ->
                val result =
                    when {
                        step.id == errorId -> AnswerResult.Right
                        props.isChecked && step.id == pickedId -> AnswerResult.Wrong
                        else -> null
                    }
                StepRow(
                    number = index + 1,
                    text = step.text,
                    correction = fields.correction.takeIf { result == AnswerResult.Right },
                    picked = step.id == pickedId,
                    result = result,
                    enabled = !props.isChecked,
                    onClick = { props.onAnswerChange(if (step.id == pickedId) null else selectionAnswer(listOf(step.id))) },
                )
            }
        }
        if (props.isChecked) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (pickedId != errorId) {
                    Text(
                        stringResource(R.string.activities_find_error_wrong_step, fields.steps.indexOfFirst { it.id == errorId } + 1),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                RichText(fields.why, style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
            }
        }
    }
}

@Composable
private fun StepRow(
    number: Int,
    text: String,
    correction: String?,
    picked: Boolean,
    result: AnswerResult?,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val tone = answerTone(picked, result)
    val shape = RoundedCornerShape(12.dp)
    val label = stringResource(R.string.activities_find_error_step, number, text)

    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(shape)
                .background(if (result == null) MaterialTheme.colorScheme.surface else tone.container)
                .border(tone.border, shape)
                .selectable(selected = picked, enabled = enabled, role = Role.RadioButton, onClick = onClick)
                .semantics { contentDescription = label }
                .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        StepNumber(number, result)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            RichText(
                text,
                style =
                    MaterialTheme.typography.bodyLarge.copy(
                        color = if (correction != null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                        textDecoration = if (correction != null) TextDecoration.LineThrough else null,
                    ),
            )
            correction?.let {
                RichText(
                    it,
                    style =
                        MaterialTheme.typography.bodyLarge.copy(
                            color = MaterialTheme.colorScheme.onTertiaryContainer,
                            fontWeight = FontWeight.Medium,
                        ),
                )
            }
        }
    }
}

@Composable
private fun StepNumber(
    number: Int,
    result: AnswerResult?,
) {
    val colors = MaterialTheme.colorScheme
    val (container, content) =
        when (result) {
            AnswerResult.Right -> colors.tertiary to colors.onTertiary
            AnswerResult.Wrong -> colors.error to colors.onError
            else -> colors.surfaceContainerHigh to colors.onSurface
        }
    Box(
        Modifier
            .size(28.dp)
            .clip(CircleShape)
            .background(container)
            .clearAndSetSemantics {},
        contentAlignment = Alignment.Center,
    ) {
        when (result) {
            AnswerResult.Right -> Icon(painterResource(R.drawable.ic_check), null, Modifier.size(16.dp), tint = content)
            AnswerResult.Wrong -> Icon(painterResource(R.drawable.ic_close), null, Modifier.size(16.dp), tint = content)
            else -> Text("$number", color = content, style = MaterialTheme.typography.labelMedium.withTabularFigures())
        }
    }
}
