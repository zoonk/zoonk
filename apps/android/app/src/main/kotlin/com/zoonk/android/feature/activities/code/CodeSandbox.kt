package com.zoonk.android.feature.activities.code

import android.content.Context
import androidx.annotation.MainThread
import com.zoonk.api.ApiJson
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes

internal interface SandboxPage {
    fun send(message: String)

    fun close()

    interface Listener {
        fun onMessage(message: String)

        /** The page's process ended; nothing it was running will answer. */
        fun onGone()
    }
}

/**
 * Runs learner code on the device, never on our servers, in main's player sandbox: JavaScript in a worker,
 * Python through Pyodide and SQL through sql.js (both from jsDelivr on first use), and regexes with
 * JavaScript's own engine. Only shows what code does; grading stays with the step check.
 *
 * One page for the whole app, opened by the first request and closed a minute after the last [hold] and
 * request end. A result that couldn't be computed (no WebView, or its process ended) reads as unavailable.
 * Call it on the main thread.
 */
class CodeSandbox internal constructor(
    private val openPage: (SandboxPage.Listener) -> SandboxPage?,
    private val scope: CoroutineScope,
    private val keepOpen: Duration = 1.minutes,
) {
    constructor(context: Context, scope: CoroutineScope) : this(
        openPage = { listener -> WebSandboxPage.open(context.applicationContext, listener) },
        scope = scope,
    )

    private var page: OpenPage? = null
    private val replies = mutableMapOf<Int, CompletableDeferred<JsonElement?>>()
    private var nextId = 1
    private var holds = 0
    private var closing: Job? = null

    /** Keeps the page, and Python once loaded, ready until closed: hold it while an activity is on screen. */
    @MainThread
    fun hold(): AutoCloseable {
        holds += 1
        closing?.cancel()
        var released = false

        return AutoCloseable {
            if (released) return@AutoCloseable
            released = true
            holds -= 1
            if (holds == 0) {
                closing =
                    scope.launch {
                        delay(keepOpen)
                        close()
                    }
            }
        }
    }

    /** Loads the language's runtime; false when it can't, like Python while offline. */
    @MainThread
    suspend fun warmUp(language: CodeLanguage): Boolean =
        request("warmUp") { put("kind", sandboxJson.encodeToJsonElement(language)) }?.jsonPrimitive?.booleanOrNull == true

    /** JavaScript or Python, stopped after core's time and output limits. */
    @MainThread
    suspend fun runProgram(
        code: String,
        language: CodeLanguage,
    ): ProgramRun =
        request("runProgram") {
            put("code", code)
            put("language", sandboxJson.encodeToJsonElement(language))
        }.decodeOr<ProgramRun>(ProgramRun.Unavailable)

    /** Against a fresh database with [tables]; the result is the last statement that returned rows. */
    @MainThread
    suspend fun runQuery(
        query: String,
        tables: List<SqlTable>,
    ): QueryRun =
        request("runQuery") {
            put("query", query)
            put("tables", ApiJson.encodeToJsonElement(ListSerializer(SqlTable.serializer()), tables))
        }.decodeOr<QueryRun>(QueryRun.Unavailable)

    /** A JavaScript regex with the `u` flag, as core grades it, against each sample. */
    @MainThread
    suspend fun testRegex(
        pattern: String,
        shouldMatch: List<String>,
        shouldNotMatch: List<String>,
    ): RegexTest =
        request("testRegex") {
            put("pattern", pattern)
            put("shouldMatch", sandboxJson.encodeToJsonElement(shouldMatch))
            put("shouldNotMatch", sandboxJson.encodeToJsonElement(shouldNotMatch))
        }.decodeOr<RegexTest>(RegexTest.Unavailable)

    private suspend fun request(
        type: String,
        fields: JsonObjectBuilder.() -> Unit,
    ): JsonElement? {
        val hold = hold()

        try {
            val current = page ?: open() ?: return null
            if (!current.loaded.await()) return null
            val id = nextId++
            val reply = CompletableDeferred<JsonElement?>()
            replies[id] = reply

            try {
                current.view.send(sandboxRequest(id, type, buildJsonObject(fields)))
                return reply.await()
            } finally {
                replies.remove(id)
            }
        } finally {
            hold.close()
        }
    }

    private fun open(): OpenPage? {
        val opening = OpenPage()
        opening.view = openPage(opening) ?: return null
        page = opening
        return opening
    }

    private fun close() {
        val current = page ?: return
        page = null
        current.loaded.complete(false)
        replies.values.forEach { it.complete(null) }
        current.view.close()
    }

    private inner class OpenPage : SandboxPage.Listener {
        lateinit var view: SandboxPage
        val loaded = CompletableDeferred<Boolean>()

        override fun onMessage(message: String) {
            if (page !== this) return

            when (val reply = sandboxReply(message)) {
                SandboxReply.Loaded -> loaded.complete(true)
                is SandboxReply.Answer -> replies[reply.id]?.complete(reply.result)
            }
        }

        override fun onGone() {
            if (page === this) close()
        }
    }

    // Learner code can post its own messages to main's sandbox host, so a result may not have the shape it should.
    private inline fun <reified T> JsonElement?.decodeOr(unavailable: T): T =
        this?.let { runCatching { sandboxJson.decodeFromJsonElement<T>(it) }.getOrNull() } ?: unavailable
}

internal val sandboxJson = Json { classDiscriminator = "status" }

internal sealed interface SandboxReply {
    data object Loaded : SandboxReply

    /** [result] is null when the page couldn't compute it. */
    data class Answer(
        val id: Int,
        val result: JsonElement?,
    ) : SandboxReply
}

internal fun sandboxRequest(
    id: Int,
    type: String,
    fields: JsonObject,
): String = JsonObject(mapOf("id" to JsonPrimitive(id), "type" to JsonPrimitive(type)) + fields).toString()

internal fun sandboxReply(message: String): SandboxReply {
    val reply = sandboxJson.parseToJsonElement(message).jsonObject
    if (reply["type"]?.jsonPrimitive?.content == "loaded") return SandboxReply.Loaded

    return SandboxReply.Answer(
        id = reply.getValue("id").jsonPrimitive.int,
        result = reply["result"]?.takeUnless { it == JsonNull },
    )
}
