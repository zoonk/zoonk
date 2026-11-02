package com.zoonk.android.feature.plan

import com.zoonk.api.models.PlanTool

/** What the learner answers for one or more of the plan's tools; [system] is the device a setup is for. */
data class ToolAnswer(
    val tools: List<String>,
    val choice: PlanTool.Choice,
    val system: PlanTool.System? = null,
) {
    val operation: PlanOp get() = PlanOp.Tools(tools.map { ToolPick(it, choice.value, system?.value) })
}
