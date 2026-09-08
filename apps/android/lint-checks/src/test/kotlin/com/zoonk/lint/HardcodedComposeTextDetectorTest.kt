package com.zoonk.lint

import com.android.tools.lint.checks.infrastructure.LintDetectorTest
import com.android.tools.lint.checks.infrastructure.TestLintTask
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue

class HardcodedComposeTextDetectorTest : LintDetectorTest() {
    override fun getDetector(): Detector = HardcodedComposeTextDetector()

    override fun getIssues(): List<Issue> = listOf(HardcodedComposeTextDetector.ISSUE)

    override fun lint(): TestLintTask = super.lint().allowMissingSdk()

    // Lint's JVM harness needs API signatures, not an Android runtime or Compose rendering.
    private val composable =
        kotlin(
            """
        package androidx.compose.runtime
        @Target(AnnotationTarget.FUNCTION, AnnotationTarget.TYPE)
        annotation class Composable
        """,
        ).indented()

    private val components =
        kotlin(
            """
        package androidx.compose.material3
        import androidx.compose.runtime.Composable
        @Composable fun Text(text: String) {}
        @Composable fun Icon(contentDescription: String?) {}
        """,
        ).indented()

    fun testHardcodedTextConstantsTemplatesAndCustomComposables() {
        lint()
            .files(
                composable,
                components,
                kotlin(
                    """
                package test.pkg
                import androidx.compose.runtime.Composable
                import androidx.compose.material3.Text as MaterialText
                import androidx.compose.material3.Icon
                private const val TITLE = "Welcome"
                @Composable fun Heading(title: String) { MaterialText(title) }
                @Composable fun Explanation(
                    message: String,
                    content: String,
                    description: String,
                    prompt: String,
                    hint: String,
                ) {
                    MaterialText(message)
                    MaterialText(content)
                    MaterialText(description)
                    MaterialText(prompt)
                    MaterialText(hint)
                }
                @Composable fun Screen(name: String) {
                    MaterialText("Hello")
                    MaterialText(text = TITLE)
                    MaterialText("Hello, ＄name")
                    Icon(contentDescription = "Close")
                    Heading(title = "Courses")
                    Explanation(
                        message = "Something went wrong",
                        content = "Try another lesson",
                        description = "Learn at your own pace",
                        prompt = "What do you want to learn?",
                        hint = "Choose a topic",
                    )
                }
                """,
                ).indented(),
            ).run()
            .expectErrorCount(10)
    }

    fun testResourcesAndDynamicContentAreAllowed() {
        lint()
            .files(
                composable,
                components,
                kotlin(
                    """
                package androidx.compose.ui.res
                import androidx.compose.runtime.Composable
                @Composable fun stringResource(id: Int): String = ""
                """,
                ).indented(),
                kotlin(
                    """
                package test.pkg
                import androidx.compose.runtime.Composable
                import androidx.compose.material3.Text
                import androidx.compose.material3.Icon
                import androidx.compose.ui.res.stringResource
                @Composable fun Screen(userContent: String, name: String?) {
                    Text(stringResource(123))
                    Text(userContent)
                    Text("")
                    Text("—")
                    Icon(contentDescription = null)
                    Text(if (userContent == "internal_id") stringResource(123) else userContent)
                    Text(when (userContent) {
                        "internal_state" -> stringResource(123)
                        else -> userContent
                    })
                    Text(name ?: stringResource(123))
                }
                """,
                ).indented(),
            ).run()
            .expectClean()
    }

    fun testConditionalTextMustBeLocalized() {
        lint()
            .files(
                composable,
                components,
                kotlin(
                    """
                package test.pkg
                import androidx.compose.runtime.Composable
                import androidx.compose.material3.Text
                @Composable fun Screen(offline: Boolean, count: Int, name: String?) {
                    Text(if (offline) { "Offline" } else ("Online"))
                    Text(when (count) {
                        0 -> "No lessons"
                        1 -> "One lesson"
                        else -> "Many lessons"
                    })
                    Text(name ?: "Anonymous")
                }
                """,
                ).indented(),
            ).run()
            .expectErrorCount(6)
    }

    fun testDefaultArgumentsMustBeLocalized() {
        lint()
            .files(
                composable,
                components,
                kotlin(
                    """
                package test.pkg
                import androidx.compose.runtime.Composable
                import androidx.compose.material3.Text
                @Composable fun Heading(title: String = "Welcome") { Text(title) }
                @Composable fun Screen() { Heading() }
                """,
                ).indented(),
            ).run()
            .expectErrorCount(1)
    }

    fun testInternalComposeStringsAreAllowed() {
        lint()
            .files(
                composable,
                components,
                kotlin(
                    """
                package androidx.navigation.compose
                import androidx.compose.runtime.Composable
                @Composable fun NavHost(startDestination: String, route: String? = null) {}
                """,
                ).indented(),
                kotlin(
                    """
                package androidx.compose.animation.core
                import androidx.compose.runtime.Composable
                @Composable fun animateFloatAsState(label: String) {}
                """,
                ).indented(),
                kotlin(
                    """
                package test.pkg
                import androidx.compose.runtime.Composable
                import androidx.compose.animation.core.animateFloatAsState
                import androidx.navigation.compose.NavHost
                @Composable fun CourseRoute(courseId: String = "new", key: String = "course") {}
                @Composable fun Screen() {
                    NavHost(startDestination = "home", route = "root")
                    CourseRoute(courseId = "draft", key = "new-course")
                    CourseRoute()
                    animateFloatAsState(label = "progress")
                }
                """,
                ).indented(),
            ).run()
            .expectClean()
    }

    fun testSemanticsAndAnnotatedText() {
        lint()
            .files(
                kotlin(
                    """
                package androidx.compose.ui.semantics
                class SemanticsPropertyReceiver
                var SemanticsPropertyReceiver.contentDescription: String
                    get() = ""
                    set(value) {}
                var SemanticsPropertyReceiver.testTag: String
                    get() = ""
                    set(value) {}
                """,
                ).indented(),
                kotlin(
                    """
                package androidx.compose.ui.text
                class AnnotatedString(text: String) {
                    class Builder { fun append(text: String) {} }
                }
                """,
                ).indented(),
                kotlin(
                    """
                package test.pkg
                import androidx.compose.ui.semantics.SemanticsPropertyReceiver
                import androidx.compose.ui.semantics.contentDescription
                import androidx.compose.ui.semantics.testTag
                import androidx.compose.ui.text.AnnotatedString
                fun SemanticsPropertyReceiver.label() {
                    contentDescription = "Close"
                    testTag = "internal_id"
                    AnnotatedString("Welcome")
                    AnnotatedString.Builder().append("Continue")
                }
                """,
                ).indented(),
            ).run()
            .expectErrorCount(3)
    }
}
