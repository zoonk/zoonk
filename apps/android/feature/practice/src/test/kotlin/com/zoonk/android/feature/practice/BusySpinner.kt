package com.zoonk.android.feature.practice

import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.test.SemanticsNodeInteractionsProvider
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.hasAnySibling
import androidx.compose.ui.test.hasProgressBarRangeInfo
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onNodeWithText
import org.junit.Assert.assertTrue

/** The one spinner on screen is [button]'s, in its icon's place beside its words rather than over them. */
internal fun SemanticsNodeInteractionsProvider.assertOnlySpinnerBeside(button: String) {
    val spinning = hasProgressBarRangeInfo(ProgressBarRangeInfo.Indeterminate)
    onAllNodes(spinning, useUnmergedTree = true).assertCountEquals(1)
    val spinner = onNode(spinning and hasAnySibling(hasText(button)), useUnmergedTree = true).getUnclippedBoundsInRoot()
    val words = onNodeWithText(button, useUnmergedTree = true).getUnclippedBoundsInRoot()
    assertTrue(spinner.right <= words.left || spinner.left >= words.right)
}
