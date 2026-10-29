package com.zoonk.android.feature.activities.code

import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf18FieldsTablesInner
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonPrimitive

@Serializable
enum class CodeLanguage {
    @SerialName("javascript")
    JavaScript,

    @SerialName("python")
    Python,

    @SerialName("sql")
    Sql,
}

@Serializable
data class ProgramRun(
    val error: ProgramError?,
    val errorOutput: String,
    val output: String,
    val stop: ProgramStop,
) {
    companion object {
        val Unavailable = ProgramRun(error = null, errorOutput = "", output = "", stop = ProgramStop.Unavailable)
    }
}

@Serializable
data class ProgramError(
    val line: Int?,
    val message: String,
)

@Serializable
enum class ProgramStop {
    @SerialName("done")
    Done,

    @SerialName("error")
    Error,

    @SerialName("timeout")
    Timeout,

    @SerialName("tooMuchOutput")
    TooMuchOutput,

    @SerialName("unavailable")
    Unavailable,
}

typealias SqlTable = PlayableLibraryStepAnyOfContentOneOf18FieldsTablesInner

@Serializable
sealed interface QueryRun {
    @Serializable
    @SerialName("done")
    data class Done(
        val result: QueryResult,
    ) : QueryRun

    @Serializable
    @SerialName("error")
    data class Error(
        val message: String,
    ) : QueryRun

    @Serializable
    @SerialName("timeout")
    data object Timeout : QueryRun

    @Serializable
    @SerialName("unavailable")
    data object Unavailable : QueryRun
}

@Serializable
data class QueryResult(
    val columns: List<String>,
    val rows: List<List<JsonPrimitive>>,
)

@Serializable
sealed interface RegexTest {
    @Serializable
    @SerialName("empty")
    data object Empty : RegexTest

    /** Doesn't compile, or could backtrack for exponential time (core's `compileSafeRegex`). */
    @Serializable
    @SerialName("invalid")
    data object Invalid : RegexTest

    @Serializable
    @SerialName("tested")
    data class Tested(
        val shouldMatch: List<SampleResult>,
        val shouldNotMatch: List<SampleResult>,
    ) : RegexTest

    @Serializable
    @SerialName("unavailable")
    data object Unavailable : RegexTest
}

/** [match] indexes [sample]'s UTF-16 units, like Kotlin strings. */
@Serializable
data class SampleResult(
    val match: SampleMatch?,
    val passes: Boolean,
    val sample: String,
)

@Serializable
data class SampleMatch(
    val start: Int,
    val end: Int,
)
