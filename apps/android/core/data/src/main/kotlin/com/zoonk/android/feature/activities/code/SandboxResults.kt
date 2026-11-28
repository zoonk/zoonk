package com.zoonk.android.feature.activities.code

import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf16Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf18FieldsTablesInner
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonPrimitive

val PlayableLibraryStepAnyOfContentOneOf16Fields.codeLanguage
    get() =
        when (language) {
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.UNKNOWN_DEFAULT_OPEN_API -> null
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.CPP -> CodeLanguage.Cpp
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.CSHARP -> CodeLanguage.CSharp
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.GO -> CodeLanguage.Go
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.JAVA -> CodeLanguage.Java
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.JAVASCRIPT -> CodeLanguage.JavaScript
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.KOTLIN -> CodeLanguage.Kotlin
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.PHP -> CodeLanguage.Php
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.PYTHON -> CodeLanguage.Python
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.RUBY -> CodeLanguage.Ruby
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.RUST -> CodeLanguage.Rust
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.SWIFT -> CodeLanguage.Swift
            PlayableLibraryStepAnyOfContentOneOf16Fields.Language.TYPESCRIPT -> CodeLanguage.TypeScript
        }

/**
 * Core's `PROGRAM_LANGUAGES`, plus the SQL playground's SQLite: the language's name, the file its program is called when a
 * step names none, and whether it runs on our servers ([CodeRuns]) or in the device's sandbox page ([CodeSandbox]).
 */
@Serializable
enum class CodeLanguage(
    val displayName: String,
    val fileName: String,
    val runsOnServer: Boolean = true,
) {
    @SerialName("cpp")
    Cpp("C++", "main.cpp"),

    @SerialName("csharp")
    CSharp("C#", "Program.cs"),

    @SerialName("go")
    Go("Go", "main.go"),

    @SerialName("java")
    Java("Java", "Main.java"),

    @SerialName("javascript")
    JavaScript("JavaScript", "main.js", runsOnServer = false),

    @SerialName("kotlin")
    Kotlin("Kotlin", "Main.kt"),

    @SerialName("php")
    Php("PHP", "main.php"),

    @SerialName("python")
    Python("Python", "main.py", runsOnServer = false),

    @SerialName("ruby")
    Ruby("Ruby", "main.rb"),

    @SerialName("rust")
    Rust("Rust", "main.rs"),

    @SerialName("sql")
    Sql("SQLite", "query.sql", runsOnServer = false),

    @SerialName("swift")
    Swift("Swift", "main.swift"),

    @SerialName("typescript")
    TypeScript("TypeScript", "main.ts"),
    ;

    /** Core's id for it (`java`), which the API reads and a code fence names. */
    val id: String get() = CodeLanguage.serializer().descriptor.getElementName(ordinal)

    /**
     * Core's `PROGRAM_TIME_LIMIT_MS`, where the device's sandbox page stops a run; null on our servers, which stop a build and
     * a run at different limits.
     */
    val timeLimitSeconds: Int?
        get() =
            when (this) {
                JavaScript, Sql -> 3
                Python -> 5
                else -> null
            }
}

/** [runId] names a run on our servers, whose output the step's check reads from the server rather than the answer. */
@Serializable
data class ProgramRun(
    val error: ProgramError?,
    val errorOutput: String,
    val output: String,
    val stop: ProgramStop,
    val runId: String? = null,
) {
    companion object {
        val Unavailable = ProgramRun(error = null, errorOutput = "", output = "", stop = ProgramStop.Unavailable)

        /** A run known only by what it printed, like one restored from the learner's answer. */
        fun printed(output: String) = ProgramRun(error = null, errorOutput = "", output = output, stop = ProgramStop.Done)
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
    @SerialName("tooManyRows")
    data object TooManyRows : QueryRun

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

    /** Doesn't compile, could backtrack for exponential time (core's `compileSafeRegex`), or ran past the sandbox's time limit. */
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
