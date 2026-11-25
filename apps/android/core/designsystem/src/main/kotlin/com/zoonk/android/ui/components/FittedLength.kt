package com.zoonk.android.ui.components

import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldBuffer
import androidx.compose.ui.semantics.SemanticsPropertyReceiver
import androidx.compose.ui.semantics.maxTextLength
import androidx.compose.ui.text.TextRange
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
        val old = originalText
        val new = asCharSequence()
        var before = 0
        val shortest = minOf(old.length, new.length)
        while (before < shortest && old[before] == new[before]) before++
        var after = 0
        while (after < shortest - before && old[old.length - 1 - after] == new[new.length - 1 - after]) after++
        val inserted = new.subSequence(before, new.length - after).toString()
        val kept = inserted.fittingPrefix(maxLength - before - after)
        if (kept.isEmpty() && inserted.isNotEmpty()) {
            revertAllChanges()
            return
        }
        replace(before, new.length - after, kept)
        selection = TextRange(before + kept.length)
    }
}

/** The longest run of whole characters (grapheme clusters) from this text's start that fits in [room] UTF-16 units. */
private fun String.fittingPrefix(room: Int): String {
    if (room <= 0) return ""
    if (length <= room) return this
    val characters = BreakIterator.getCharacterInstance().apply { setText(this@fittingPrefix) }
    var end = 0
    var next = characters.next()
    while (next != BreakIterator.DONE && next <= room) {
        end = next
        next = characters.next()
    }
    return substring(0, end)
}
