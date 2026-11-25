package com.zoonk.android.ui.components

import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldBuffer
import androidx.compose.foundation.text.input.delete
import androidx.compose.ui.semantics.SemanticsPropertyReceiver
import androidx.compose.ui.semantics.maxTextLength
import java.text.BreakIterator

/**
 * Main's `maxLength` (iOS's `TextEdit.fitted`): an edit that would pass [maxLength] UTF-16 units keeps as many whole
 * characters of what it inserted as fit, never text that was already there, so a stored value over the limit stays
 * whole while the learner deletes from it. An insertion with no room for its first character is refused.
 */
fun InputTransformation.Companion.fitTo(maxLength: Int): InputTransformation = FittedLength(maxLength)

private class FittedLength(
    private val maxLength: Int,
) : InputTransformation {
    override fun SemanticsPropertyReceiver.applySemantics() {
        maxTextLength = maxLength
    }

    override fun TextFieldBuffer.transformInput() {
        if (length <= maxLength) return
        val changeCount = changes.changeCount
        if (
            length < originalText.length &&
            (0 until changeCount).all { changes.getRange(it).length <= changes.getOriginalRange(it).length }
        ) {
            return
        }

        for (index in changeCount - 1 downTo 0) {
            if (length <= maxLength) break
            val range = changes.getRange(index)
            if (range.collapsed) continue

            val inserted = asCharSequence().subSequence(range.min, range.max).toString()
            val kept = inserted.fittingPrefixLength(range.length - (length - maxLength))
            if (kept == 0 && changeCount == 1) {
                revertAllChanges()
                return
            }

            val originalRange = changes.getOriginalRange(index)
            if (kept == 0 && !originalRange.collapsed) {
                replace(range.min, range.max, originalText.subSequence(originalRange.min, originalRange.max))
            } else {
                delete(range.min + kept, range.max)
            }
        }
    }
}

private fun String.fittingPrefixLength(room: Int): Int {
    if (room <= 0) return 0
    val characters = BreakIterator.getCharacterInstance().apply { setText(this@fittingPrefixLength) }
    var end = 0
    var next = characters.next()
    while (next != BreakIterator.DONE && next <= room) {
        end = next
        next = characters.next()
    }
    return end
}
