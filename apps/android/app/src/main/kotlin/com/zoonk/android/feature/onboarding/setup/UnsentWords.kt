package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftHandle
import com.zoonk.android.data.DraftStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlin.properties.ReadWriteProperty
import kotlin.reflect.KProperty

/** The setup's unsent words, in the drafts of the learner the screen shows. */
class SetupDrafts(
    private val store: DraftStore,
    private val session: AuthenticatedSession,
) {
    internal fun words(
        goalId: String,
        step: String,
    ): DraftHandle<List<String>> = store.open(session, "setup.unsent.$goalId.$step", ListSerializer(String.serializer()))
}

internal val LocalSetupDrafts = staticCompositionLocalOf<SetupDrafts?> { null }

@Stable
internal class UnsentWords(
    initial: List<String>,
    private val draft: DraftHandle<List<String>>?,
) {
    var values by mutableStateOf(initial)
        private set

    fun field(index: Int) =
        object : ReadWriteProperty<Any?, String> {
            override fun getValue(
                thisRef: Any?,
                property: KProperty<*>,
            ) = values[index]

            override fun setValue(
                thisRef: Any?,
                property: KProperty<*>,
                value: String,
            ) = set(index, value)
        }

    fun set(
        index: Int,
        text: String,
    ) {
        values = values.toMutableList().also { it[index] = text }
        draft?.saveDebounced(values)
    }

    internal fun restore(saved: List<String>) {
        if (values.all(String::isEmpty)) values = saved
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
    var shown by rememberSaveable(goalId, step) { mutableStateOf(List(count) { "" }) }
    val words = remember(draft) { UnsentWords(shown, draft) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(draft) {
        draft
            ?.value
            ?.first()
            ?.takeIf { it.size == count }
            ?.let(words::restore)
    }
    LaunchedEffect(words.values) { shown = words.values }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { draft?.let { scope.launch { it.flush() } } }
    return words
}
