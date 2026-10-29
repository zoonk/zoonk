package com.zoonk.android.feature.plan

import androidx.annotation.DrawableRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.api.models.PlanTool

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
            ToolSheet(
                tool = tool,
                draft = draft,
                edits = edits,
                onDraft = { next -> if (drafts.tool != null) drafts.tool = next },
                onDismiss = { drafts.tool = null },
            )
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

    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(painterResource(toolIcon(tool.name)), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(parts?.get(1) ?: tool.name, style = MaterialTheme.typography.bodyLarge)
            parts?.get(2)?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            ToolStatus(tool)
        }
        val described = Modifier.semantics { contentDescription = action }
        if (tool.choice == null) {
            FilledTonalButton(onClick = onChoose, modifier = described) { Text(stringResource(R.string.plan_choose)) }
        } else {
            TextButton(onClick = onChoose, modifier = described) { Text(stringResource(R.string.plan_tool_change)) }
        }
    }
}

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
    val stateWords = stringResource(if (open) R.string.plan_expanded else R.string.plan_collapsed)
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
    var chose by remember { mutableStateOf(false) }

    if (tools.all { it.choice == PlanTool.Choice.NONE }) {
        Text(
            text = stringResource(R.string.plan_tools_without),
            modifier = Modifier.padding(top = 4.dp).semantics { liveRegion = LiveRegionMode.Polite },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        return
    }
    TextButton(
        onClick = {
            chose = true
            edits.chooseTools(ToolAnswer(tools.map { it.name }, PlanTool.Choice.NONE)) {}
        },
    ) {
        Text(stringResource(R.string.plan_tools_none))
    }
    if (chose && edits.hasFailed(PlanPart.Tools)) SaveFailedText()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ToolSheet(
    tool: PlanTool,
    draft: ToolDraft,
    edits: PlanEdits,
    onDraft: (ToolDraft) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        ToolChoiceForm(tool, draft, edits, onDraft, onDone = onDismiss)
    }
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
    var tried by remember { mutableStateOf(false) }
    val pending = edits.isPending(PlanPart.Tools)
    val chosen = draft.choice
    val system = draft.system
    val needsSystem = chosen == PlanTool.Choice.SETUP && system == null

    Column(
        modifier =
            Modifier
                .weight(1f, fill = false)
                .verticalScroll(rememberScrollState())
                .padding(start = SHEET_MARGIN, end = SHEET_MARGIN, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(tool.name, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            Text(
                text = stringResource(R.string.plan_tool_how),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Column(Modifier.selectableGroup()) {
            TOOL_CHOICES.forEach { option ->
                ChoiceRow(
                    label = stringResource(option.label),
                    description = stringResource(option.description),
                    selected = option.choice == chosen,
                    onSelect = { onDraft(draft.copy(choice = option.choice)) },
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
                        )
                    }
                }
            }
        }
        if (tried && edits.hasFailed(PlanPart.Tools)) SaveFailedText()
    }
    HorizontalDivider()
    Row(
        modifier = Modifier.padding(start = SHEET_MARGIN, end = SHEET_MARGIN, top = 16.dp, bottom = 24.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TextButton(onClick = onDone, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.plan_cancel)) }
        Button(
            onClick = {
                if (chosen == null) return@Button
                tried = true
                val answer = ToolAnswer(listOf(tool.name), chosen, system.takeIf { chosen == PlanTool.Choice.SETUP })
                edits.chooseTools(answer) { if (it != null) onDone() }
            },
            modifier = Modifier.weight(1f),
            enabled = chosen != null && !needsSystem,
        ) {
            if (pending) {
                CircularProgressIndicator(Modifier.padding(end = 8.dp).size(18.dp), color = LocalContentColor.current, strokeWidth = 2.dp)
            }
            Text(stringResource(R.string.plan_save))
        }
    }
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
