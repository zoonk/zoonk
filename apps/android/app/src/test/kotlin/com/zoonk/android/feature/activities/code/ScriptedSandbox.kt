package com.zoonk.android.feature.activities.code

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * A sandbox whose page loads at once and answers like main's: every runtime warms up, and each
 * program, query or regex gets what [answer] returns. Hold a reply back with [gate].
 */
internal class ScriptedSandbox(
    private val scope: CoroutineScope,
    var answer: (JsonObject) -> JsonElement = { request -> if (request.type == "testRegex") regexTested(request) else JsonPrimitive(true) },
) {
    val requests = mutableListOf<JsonObject>()
    var gate: CompletableDeferred<Unit>? = null

    val sandbox =
        CodeSandbox(
            openPage = { listener -> Page(listener).also { scope.launch(Dispatchers.Main) { listener.onMessage(LOADED) } } },
            scope = scope,
        )

    private inner class Page(
        private val listener: SandboxPage.Listener,
    ) : SandboxPage {
        override fun send(message: String) {
            val request = sandboxJson.parseToJsonElement(message).jsonObject
            requests += request
            val result = if (request.type == "warmUp") JsonPrimitive(true) else answer(request)
            val held = gate
            scope.launch(Dispatchers.Main) {
                held?.await()
                listener.onMessage(
                    JsonObject(mapOf("id" to JsonPrimitive(request.getValue("id").jsonPrimitive.int), "result" to result)).toString(),
                )
            }
        }

        override fun close() = Unit
    }

    companion object {
        private const val LOADED = """{"type":"loaded"}"""

        fun printed(output: String): JsonElement = sandboxJson.encodeToJsonElement(ProgramRun.printed(output))

        /** A `testRegex` reply worked out with Kotlin's engine, which agrees with JavaScript's on simple patterns. */
        fun regexTested(request: JsonObject): JsonElement {
            val pattern = request.getValue("pattern").jsonPrimitive.content
            val regex = if (pattern.isEmpty()) null else runCatching { Regex(pattern) }.getOrNull()
            val test: RegexTest =
                when {
                    pattern.isEmpty() -> RegexTest.Empty
                    regex == null -> RegexTest.Invalid
                    else -> RegexTest.Tested(regex.samples(request, "shouldMatch", true), regex.samples(request, "shouldNotMatch", false))
                }
            return sandboxJson.encodeToJsonElement(test)
        }

        private fun Regex.samples(
            request: JsonObject,
            key: String,
            shouldMatch: Boolean,
        ) = request.getValue(key).jsonArray.map { element ->
            val sample = element.jsonPrimitive.content
            val found = find(sample)
            SampleResult(
                found?.let { SampleMatch(it.range.first, it.range.last + 1) },
                passes = (found != null) == shouldMatch,
                sample = sample,
            )
        }
    }
}

internal val JsonObject.code: String get() = getValue("code").jsonPrimitive.content

private val JsonObject.type get() = getValue("type").jsonPrimitive.content
