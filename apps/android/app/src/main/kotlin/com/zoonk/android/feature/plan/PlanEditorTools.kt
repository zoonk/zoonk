package com.zoonk.android.feature.plan

import androidx.annotation.DrawableRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.PendingLabel
import com.zoonk.api.models.PlanTool
import java.util.UUID

/** What the learner answers for one or more of the plan's tools; [system] is the device a setup is for. */
data class ToolAnswer(
    val tools: List<String>,
    val choice: PlanTool.Choice,
    val system: PlanTool.System? = null,
) {
    val operation: PlanOp get() = PlanOp.Tools(tools.map { ToolPick(it, choice.value, system?.value) })
}

/** Main's `PlanTools`: tools only later phases use are listed under "More later" instead of asked now. */
@Composable
internal fun PlanTools(
    page: PlanPageState,
    edits: PlanEdits,
    drafts: EditorDrafts,
) {
    if (page.plan.tools.isEmpty()) return
    val tools = page.plan.tools.map { it.answered(edits.asked(PlanPart.Tools)) }

    fun choose(tool: PlanTool) {
        drafts.tool = ToolDraft(tool.name, tool.choice, tool.system)
    }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SectionLabel(stringResource(R.string.plan_tools_title))
        Column {
            tools.filterNot { it.later }.forEach { tool -> ToolRow(tool, onChoose = { choose(tool) }) }
        }
        LaterTools(tools.filter { it.later }, onChoose = ::choose)
        NoToolsPath(tools, edits)
    }

    drafts.tool?.let { draft ->
        tools.firstOrNull { it.name == draft.name }?.let { tool ->
            PlanSheet(onDismiss = { drafts.tool = null }) {
                ToolChoiceForm(tool, draft, edits, onDraft = { drafts.tool = it }, onDone = { drafts.tool = null })
            }
        }
    }
}

/** The tool as a change saving answers it. */
private fun PlanTool.answered(asked: List<PlanOp>): PlanTool {
    val pick = asked.filterIsInstance<PlanOp.Tools>().flatMap { it.tools }.lastOrNull { it.name == name } ?: return this
    return copy(
        choice = PlanTool.Choice.entries.firstOrNull { it.value == pick.choice },
        system = PlanTool.System.entries.firstOrNull { it.value == pick.system },
    )
}

@Composable
private fun ToolRow(
    tool: PlanTool,
    onChoose: () -> Unit,
) {
    val parts = CHOICES_PATTERN.matchEntire(tool.name)?.groupValues
    val action =
        stringResource(if (tool.choice == null) R.string.plan_tool_choose_how else R.string.plan_tool_change_how, tool.name)
    val button =
        @Composable { stacked: Boolean ->
            val described = Modifier.semantics { contentDescription = action }
            if (tool.choice == null) {
                FilledTonalButton(onClick = onChoose, modifier = described) { Text(stringResource(R.string.plan_choose)) }
            } else if (stacked) {
                TextButton(onClick = onChoose, modifier = described, shape = MaterialTheme.shapes.small, contentPadding = FLUSH_START) {
                    Text(stringResource(R.string.plan_tool_change))
                }
            } else {
                TextButton(onClick = onChoose, modifier = described) { Text(stringResource(R.string.plan_tool_change)) }
            }
        }

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val stacked = maxWidth < STACKED_BELOW * LocalDensity.current.fontScale
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(vertical = 8.dp),
            verticalAlignment = if (stacked) Alignment.Top else Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(painterResource(toolIcon(tool.name)), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(parts?.get(1) ?: tool.name, style = MaterialTheme.typography.bodyLarge)
                parts
                    ?.get(
                        2,
                    )?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                ToolStatus(tool)
                if (stacked) Box(Modifier.padding(top = 6.dp)) { button(true) }
            }
            if (!stacked) button(false)
        }
    }
}

/** The link starts where the section's text does; the button keeps its 48dp target. */
private val FLUSH_START = PaddingValues(start = 0.dp, top = 8.dp, end = 12.dp, bottom = 8.dp)

/** Main's `@max-2xs` (18rem): a row narrower than this, grown with the learner's font size, puts its button under the text. */
private val STACKED_BELOW = 288.dp

@Composable
private fun ToolStatus(tool: PlanTool) {
    val style = MaterialTheme.typography.bodyMedium
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant

    when (tool.choice) {
        PlanTool.Choice.HAVE -> {
            Text(
                text = stringResource(R.string.plan_tool_have_it),
                style = style,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
            )
        }

        PlanTool.Choice.SETUP -> {
            val system = tool.system
            Text(
                text =
                    if (system != null) {
                        stringResource(R.string.plan_tool_setup_for, systemName(system.value))
                    } else {
                        stringResource(R.string.plan_tool_setup_first)
                    },
                style = style,
                color = quiet,
            )
        }

        PlanTool.Choice.NONE -> {
            Text(stringResource(R.string.plan_tool_examples_only), style = style, color = quiet)
        }

        null -> {
            Text(
                stringResource(if (tool.essential) R.string.plan_tool_needed else R.string.plan_tool_optional),
                style = style,
                color = quiet,
            )
        }
    }
}

@Composable
private fun LaterTools(
    tools: List<PlanTool>,
    onChoose: (PlanTool) -> Unit,
) {
    if (tools.isEmpty()) return
    var open by remember { mutableStateOf(false) }
    val stateWords = stringResource(if (open) R.string.disclosure_expanded else R.string.disclosure_collapsed)
    val names = tools.joinToString(", ") { CHOICES_PATTERN.matchEntire(it.name)?.groupValues?.get(1) ?: it.name }

    Column {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .clickable(role = Role.Button) { open = !open }
                    .semantics { stateDescription = stateWords },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = stringResource(R.string.plan_tools_later, names),
                modifier = Modifier.weight(1f, fill = false),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Icon(
                painter = painterResource(if (open) R.drawable.ic_expand_less else R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (open) tools.forEach { tool -> ToolRow(tool, onChoose = { onChoose(tool) }) }
    }
}

@Composable
private fun NoToolsPath(
    tools: List<PlanTool>,
    edits: PlanEdits,
) {
    var asked by remember { mutableStateOf(false) }
    val opening = remember { UUID.randomUUID() }
    val note = remember { FocusRequester() }
    val link = remember { FocusRequester() }
    val withoutTools = tools.all { it.choice == PlanTool.Choice.NONE }
    val failed = edits.sheetFailed(PlanPart.Tools, opening)

    LaunchedEffect(withoutTools, failed) {
        if (!asked) return@LaunchedEffect
        if (withoutTools) {
            note.requestFocus()
        } else if (failed) {
            asked = false
            link.requestFocus()
        }
    }

    if (withoutTools) {
        Text(
            text = stringResource(R.string.plan_tools_without),
            modifier = Modifier.padding(top = 4.dp).focusRequester(note).focusable(),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        return
    }
    TextButton(
        onClick = {
            asked = true
            edits.chooseTools(ToolAnswer(tools.map { it.name }, PlanTool.Choice.NONE)) { edits.answerSheet(opening, it) }
        },
        modifier = Modifier.focusRequester(link),
        shape = MaterialTheme.shapes.small,
        contentPadding = FLUSH_START,
    ) {
        Text(stringResource(R.string.plan_tools_none))
    }
    if (failed) SaveFailedText()
}

/** Main's `ToolChoiceForm`: it closes once its answer saves. */
@Composable
internal fun ColumnScope.ToolChoiceForm(
    tool: PlanTool,
    draft: ToolDraft,
    edits: PlanEdits,
    onDraft: (ToolDraft) -> Unit,
    onDone: () -> Unit,
) {
    val pending = edits.isPending(PlanPart.Tools)
    val saved = edits.sheetAnswer(draft.opening)
    val chosen = draft.choice
    val system = draft.system
    val needsSystem = chosen == PlanTool.Choice.SETUP && system == null

    LaunchedEffect(saved) { if (saved != null) onDone() }

    PlanSheetContent(
        title = tool.name,
        description = stringResource(R.string.plan_tool_how),
        body = {
            Column(Modifier.selectableGroup()) {
                TOOL_CHOICES.forEach { option ->
                    ChoiceRow(
                        label = stringResource(option.label),
                        description = stringResource(option.description),
                        selected = option.choice == chosen,
                        onSelect = { onDraft(draft.copy(choice = option.choice)) },
                        enabled = !pending,
                    )
                }
            }
            if (chosen == PlanTool.Choice.SETUP) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionLabel(stringResource(R.string.plan_tool_device))
                    FlowRow(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        PlanTool.System.entries.forEach { option ->
                            PlanChip(
                                text = systemName(option.value),
                                selected = option == system,
                                onClick = { onDraft(draft.copy(system = option)) },
                                role = Role.RadioButton,
                                enabled = !pending,
                            )
                        }
                    }
                }
            }
        },
        actions = {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                TextButton(onClick = onDone, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.plan_cancel)) }
                Button(
                    onClick = {
                        if (chosen == null) return@Button
                        val answer = ToolAnswer(listOf(tool.name), chosen, system.takeIf { chosen == PlanTool.Choice.SETUP })
                        edits.chooseTools(answer) { edits.answerSheet(draft.opening, it) }
                    },
                    modifier = Modifier.weight(1f),
                    enabled = chosen != null && !needsSystem && !pending,
                ) {
                    PendingLabel(pending, stringResource(R.string.plan_save))
                }
            }
            if (edits.sheetFailed(PlanPart.Tools, draft.opening)) SaveFailedText()
        },
    )
}

private class ToolOption(
    val choice: PlanTool.Choice,
    val label: Int,
    val description: Int,
)

private val TOOL_CHOICES =
    listOf(
        ToolOption(PlanTool.Choice.HAVE, R.string.plan_tool_have, R.string.plan_tool_have_description),
        ToolOption(PlanTool.Choice.SETUP, R.string.plan_tool_setup, R.string.plan_tool_setup_description),
        ToolOption(PlanTool.Choice.NONE, R.string.plan_tool_none, R.string.plan_tool_none_description),
    )

/** "Spreadsheet (Google Sheets or Excel)": the tool, then its usual choices. */
private val CHOICES_PATTERN = Regex("""(.+?)\s*\(([^()]+)\)""")

/** Main's `ToolIcon`, matched on the tool's name in the goal's language. */
@DrawableRes
private fun toolIcon(name: String): Int = TOOL_ICONS.firstOrNull { it.first.containsMatchIn(name) }?.second ?: R.drawable.ic_build

private val TOOL_ICONS =
    listOf(
        Regex("calculat|calculad|rechner", RegexOption.IGNORE_CASE) to R.drawable.ic_calculate,
        Regex("sheet|excel|planilha|hoja|tabell|tableur", RegexOption.IGNORE_CASE) to R.drawable.ic_table,
        Regex("terminal|shell|comand|command|konsole", RegexOption.IGNORE_CASE) to R.drawable.ic_terminal,
        Regex("""python|code|código|javascript|sql|editor|\bR\b""", RegexOption.IGNORE_CASE) to R.drawable.ic_code,
    )
