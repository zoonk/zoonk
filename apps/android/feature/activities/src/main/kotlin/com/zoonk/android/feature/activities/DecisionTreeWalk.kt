package com.zoonk.android.feature.activities

import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf30FieldsNodesInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf30FieldsNodesInner.PlayableLibraryStepAnyOfContentOneOf30FieldsNodesInnerOneOf1Value as OutcomeValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf30FieldsNodesInner.PlayableLibraryStepAnyOfContentOneOf30FieldsNodesInnerOneOfValue as QuestionValue

/** A decision tree's node: a question with its branches, or an outcome it leads to. */
sealed interface TreeNode {
    val id: String

    data class Question(
        override val id: String,
        val question: String,
        val branches: List<Branch>,
    ) : TreeNode

    data class Outcome(
        override val id: String,
        val label: String,
    ) : TreeNode

    data class Branch(
        val label: String,
        val next: String,
    )
}

data class WalkStep(
    val node: TreeNode.Question,
    val branch: String,
)

fun treeNodes(nodes: List<PlayableLibraryStepAnyOfContentOneOf30FieldsNodesInner>): List<TreeNode> =
    nodes.map { node ->
        when (node) {
            is QuestionValue -> {
                TreeNode.Question(
                    node.value.id,
                    node.value.question,
                    node.value.branches.map { TreeNode.Branch(it.label, it.next) },
                )
            }

            is OutcomeValue -> {
                TreeNode.Outcome(node.value.id, node.value.label)
            }
        }
    }

/** Main's `decision-tree-walk.ts`. */
fun List<TreeNode>.find(id: String?): TreeNode? = firstOrNull { it.id == id }

fun List<TreeNode>.reachableOutcomes(id: String): List<TreeNode.Outcome> =
    when (val node = find(id)) {
        is TreeNode.Outcome -> listOf(node)
        is TreeNode.Question -> node.branches.flatMap { reachableOutcomes(it.next) }
        null -> emptyList()
    }

fun List<TreeNode>.walkSteps(path: List<String>): List<WalkStep> =
    path.dropLast(1).mapIndexedNotNull { index, id ->
        val node = find(id) as? TreeNode.Question
        val branch = node?.branches?.find { it.next == path[index + 1] }
        if (node != null && branch != null) WalkStep(node, branch.label) else null
    }

/** Where the learner's walk first left the expected one, or null when it never did. */
fun firstDivergence(
    expected: List<String>,
    walked: List<String>,
): Int? {
    val index = expected.indices.firstOrNull { walked.getOrNull(it) != expected[it] }
    return index ?: expected.size.takeIf { walked.size > expected.size }
}
