package com.zoonk.android.feature.activities.code

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

enum class SandboxRuntimeStatus { Loading, Ready, Failed }

@Stable
class SandboxRuntime internal constructor() {
    var status by mutableStateOf(SandboxRuntimeStatus.Loading)
        internal set

    internal var attempt by mutableIntStateOf(0)

    fun retry() {
        attempt += 1
    }
}

/** Holds the sandbox while on screen and loads [language]'s runtime; a regex tester passes JavaScript. */
@Composable
fun rememberSandboxRuntime(
    sandbox: CodeSandbox,
    language: CodeLanguage,
): SandboxRuntime {
    val runtime = remember(sandbox, language) { SandboxRuntime() }

    DisposableEffect(sandbox) {
        val hold = sandbox.hold()
        onDispose(hold::close)
    }

    LaunchedEffect(runtime, runtime.attempt) {
        runtime.status = SandboxRuntimeStatus.Loading
        runtime.status = if (sandbox.warmUp(language)) SandboxRuntimeStatus.Ready else SandboxRuntimeStatus.Failed
    }

    return runtime
}
