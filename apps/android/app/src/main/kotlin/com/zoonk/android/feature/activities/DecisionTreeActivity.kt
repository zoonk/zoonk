package com.zoonk.android.feature.activities

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf30Value as DecisionTreeContent

val decisionTreeRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_badge_follow_key, R.drawable.ic_call_split) },
        canvas = { DecisionTreeActivity(it) },
    )

@Composable
private fun DecisionTreeActivity(props: ActivityProps) {
    val fields = (props.content as DecisionTreeContent).value.fields
    val nodes = treeNodes(fields.nodes)
    var path by rememberSaveable {
        mutableStateOf(props.answer.orderIds?.takeIf { it.firstOrNull() == fields.rootId } ?: listOf(fields.rootId))
    }
    val current = nodes.find(path.lastOrNull())
    val steps = nodes.walkSteps(path)
    val stillPossible = nodes.reachableOutcomes(current?.id ?: fields.rootId)
    val expectedPath = props.expected.orderIds
    val walk = { next: List<String> ->
        path = next
        props.onAnswerChange(if (nodes.find(next.lastOrNull()) is TreeNode.Outcome) orderAnswer(next) else null)
    }
    val description =
        if (current is TreeNode.Outcome) {
            pluralStringResource(R.plurals.activities_tree_reached, steps.size, current.label, steps.size)
        } else {
            stringResource(R.string.activities_tree_question, steps.size + 1, stillPossible.joinToString(", ") { it.label })
        }

    ActivityCanvas(description) {
        Panel {
            ActivityCanvasLabel(stringResource(R.string.activities_tree_case))
            RichText(fields.case.description, style = MaterialTheme.typography.bodyLarge)
        }
        if (current is TreeNode.Question) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ActivityCanvasLabel(stringResource(R.string.activities_tree_still_possible))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    stillPossible.forEach { Pill(it.label) }
                }
            }
        }
        if (steps.isNotEmpty()) {
            val answersLabel = stringResource(R.string.activities_tree_your_answers)
            Column(Modifier.semantics { contentDescription = answersLabel }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                steps.forEach { step ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(
                            painterResource(R.drawable.ic_check_circle),
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        RichText(
                            step.node.question,
                            modifier = Modifier.weight(1f),
                            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
                        )
                        Pill(step.branch)
                    }
                }
            }
        }
        if (current is TreeNode.Question && !props.isChecked) {
            HorizontalDivider()
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    Modifier
                        .size(24.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                        .clearAndSetSemantics {},
                    contentAlignment = Alignment.Center,
                ) {
                    Text("${steps.size + 1}", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.labelMedium)
                }
                RichText(current.question, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold))
            }
            ActivitySelectGrid(
                current.branches,
                label = current.question,
                columns = if (current.branches.any { it.label.length > LONG_BRANCH_LENGTH }) 1 else 2,
            ) { branch ->
                ActivityTile(picked = false, result = null, onClick = { walk(path + branch.next) }) { Text(branch.label) }
            }
        }
        if (current is TreeNode.Outcome) {
            val accent = MaterialTheme.zoonk.vizAccent
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(accent.copy(alpha = SOFT))
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            ) {
                Text(stringResource(R.string.activities_tree_leads_to), color = accent, style = MaterialTheme.typography.labelMedium)
                Text(current.label, style = MaterialTheme.typography.titleMedium)
            }
        }
        if (!props.isChecked && path.size > 1) {
            OutlinedButton(onClick = { walk(path.dropLast(1)) }) {
                Icon(painterResource(R.drawable.ic_undo), contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.activities_tree_undo), modifier = Modifier.padding(start = 8.dp))
            }
        }
        if (props.isChecked && expectedPath != null) TreeReview(nodes, expectedPath, path)
    }
}

/** Main's `DecisionTreeReview`: the expected walk, marked up to where the learner's left it. */
@Composable
private fun TreeReview(
    nodes: List<TreeNode>,
    expectedPath: List<String>,
    walked: List<String>,
) {
    val steps = nodes.walkSteps(expectedPath)
    val missedAt = firstDivergence(expectedPath, walked)?.minus(1) ?: steps.size
    val learnerSteps = nodes.walkSteps(walked)
    val outcome = nodes.find(expectedPath.lastOrNull()) as? TreeNode.Outcome

    Panel {
        Text(stringResource(R.string.activities_tree_walk), style = MaterialTheme.typography.titleSmall)
        steps.forEachIndexed { index, step ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StepMark(
                    when {
                        index < missedAt -> AnswerMark.Right
                        index == missedAt -> AnswerMark.Wrong
                        else -> null
                    },
                )
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    RichText(
                        step.node.question,
                        style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
                    )
                    Text(step.branch, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
                    learnerSteps.getOrNull(index)?.branch?.takeIf { index == missedAt }?.let {
                        Text(
                            stringResource(R.string.activities_tree_you_chose, it),
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
            }
        }
        if (outcome != null) {
            HorizontalDivider()
            Text(stringResource(R.string.activities_tree_it_leads_to, outcome.label), style = MaterialTheme.typography.bodyMedium)
        }
    }
}

private enum class AnswerMark { Right, Wrong }

@Composable
private fun StepMark(mark: AnswerMark?) {
    val modifier = Modifier.padding(top = 2.dp).size(16.dp)
    when (mark) {
        AnswerMark.Right -> {
            Icon(painterResource(R.drawable.ic_check), null, modifier, tint = MaterialTheme.colorScheme.tertiary)
        }

        AnswerMark.Wrong -> {
            Icon(painterResource(R.drawable.ic_close), null, modifier, tint = MaterialTheme.colorScheme.error)
        }

        null -> {
            Box(modifier, contentAlignment = Alignment.Center) {
                Box(Modifier.size(4.dp).clip(CircleShape).background(MaterialTheme.colorScheme.onSurfaceVariant))
            }
        }
    }
}

@Composable
private fun Panel(content: @Composable () -> Unit) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { content() }
    }
}

@Composable
private fun Pill(text: String) {
    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Text(text, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp), style = MaterialTheme.typography.labelMedium)
    }
}

private const val LONG_BRANCH_LENGTH = 24
private const val SOFT = 0.16f
