package com.zoonk.android.feature.onboarding.setup

import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.SessionSource
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer

/** The setup's unsent words: the screen shows [session]'s, and an answer removes those of the learner it saves for. */
class SetupDrafts(
    private val store: DraftStore,
    private val session: AuthenticatedSession,
    private val sessions: SessionSource,
) {
    internal fun words(
        goalId: String,
        step: String,
    ) = open(session, goalId, step)

    /** The current learner's words: open them as the answer is sent, so they belong to the session its write takes. */
    internal fun sending(
        goalId: String,
        step: String,
    ) = sessions.current?.let { open(it, goalId, step) }

    private fun open(
        learner: AuthenticatedSession,
        goalId: String,
        step: String,
    ): DraftHandle<List<String>> = store.open(learner, "setup.unsent.$goalId.$step", ListSerializer(String.serializer()))
}

internal val LocalSetupDrafts = staticCompositionLocalOf<SetupDrafts?> { null }

@Stable
internal class UnsentWords(
    val fields: List<TextFieldState>,
    private val draft: DraftHandle<List<String>>?,
) {
    val values get() = fields.map { it.text.toString() }

    private var kept = values

    fun keep(values: List<String>) {
        if (values == kept) return
        draft?.saveDebounced(values)
        kept = values
    }

    internal fun restore(saved: List<String>) {
        if (values.all(String::isEmpty)) fields.zip(saved).forEach { (field, value) -> field.setTextAndPlaceCursorAtEnd(value) }
    }
}

/**
 * A step's [count] fields, kept across a closed app and Finish later until its answer saves, when
 * the setup's ViewModel removes them.
 */
@Composable
internal fun rememberUnsentWords(
    goalId: String,
    step: String,
    count: Int,
): UnsentWords {
    val drafts = LocalSetupDrafts.current
    val draft = remember(drafts, goalId, step) { drafts?.words(goalId, step) }
    val fields = key(goalId, step, count) { List(count) { rememberTextFieldState() } }
    val words = remember(draft, fields) { UnsentWords(fields, draft) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(words, draft) {
        draft
            ?.value
            ?.first()
            ?.takeIf { it.size == count }
            ?.let(words::restore)
    }
    LaunchedEffect(words) {
        snapshotFlow { words.values }.collect(words::keep)
    }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        words.keep(words.values)
        draft?.let { scope.launch { it.flush() } }
    }
    return words
}
