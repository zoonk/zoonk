package com.zoonk.lint

import com.android.tools.lint.detector.api.Category
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Implementation
import com.android.tools.lint.detector.api.Issue
import com.android.tools.lint.detector.api.JavaContext
import com.android.tools.lint.detector.api.Scope
import com.android.tools.lint.detector.api.Severity
import com.android.tools.lint.detector.api.SourceCodeScanner
import com.intellij.psi.PsiMethod
import org.jetbrains.uast.UCallExpression

/** Material's buttons, text fields and list items, which the design system draws in Zoonk's look. */
class MaterialComponentDetector :
    Detector(),
    SourceCodeScanner {
    override fun getApplicableMethodNames(): List<String> = BUTTONS + SECONDARY_BUTTONS + FIELDS + LIST_ITEMS

    override fun visitMethodCall(
        context: JavaContext,
        node: UCallExpression,
        method: PsiMethod,
    ) {
        if (!method.containingClass
                ?.qualifiedName
                .orEmpty()
                .startsWith("androidx.compose.material3.")
        ) {
            return
        }
        if (method.name in LIST_ITEMS) {
            context.report(LIST_ITEM, node, context.getNameLocation(node), "Use `com.zoonk.android.ui.components.ListRow`")
            return
        }
        val field = method.name in FIELDS
        if (context.file.name == if (field) FIELDS_FILE else BUTTONS_FILE) return

        val zoonk =
            when (method.name) {
                in SECONDARY_BUTTONS -> "OutlinedButton"
                in FIELDS -> "OutlinedTextField"
                else -> method.name
            }
        context.report(
            if (field) TEXT_FIELD else BUTTON,
            node,
            context.getNameLocation(node),
            "Use `com.zoonk.android.ui.components.$zoonk`",
        )
    }

    companion object {
        private const val BUTTONS_FILE = "Buttons.kt"
        private const val FIELDS_FILE = "TextFields.kt"
        private val BUTTONS = listOf("Button", "TextButton", "OutlinedButton", "OutlinedIconButton")
        private val SECONDARY_BUTTONS = listOf("FilledTonalButton", "ElevatedButton")
        private val FIELDS = listOf("OutlinedTextField", "TextField")
        private val LIST_ITEMS = listOf("ListItem")

        val BUTTON: Issue =
            Issue.create(
                id = "MaterialButton",
                briefDescription = "Material's button instead of Zoonk's",
                explanation =
                    "Zoonk's buttons in `ui/components/Buttons.kt` take main's corners and sizes instead of " +
                        "Material's pill, and one look per role: `Button` for the main action, `OutlinedButton` " +
                        "(an `input` line, ink words) for a secondary one, `TextButton` for a quiet one and " +
                        "`DestructiveButton`. Material's tonal and elevated buttons would be a second look for the secondary role.",
                category = Category.CORRECTNESS,
                priority = 6,
                severity = Severity.ERROR,
                implementation = Implementation(MaterialComponentDetector::class.java, Scope.JAVA_FILE_SCOPE),
            )

        val TEXT_FIELD: Issue =
            Issue.create(
                id = "MaterialTextField",
                briefDescription = "Material's text field instead of Zoonk's",
                explanation =
                    "Zoonk's `OutlinedTextField` in `ui/components/TextFields.kt` is main's field: the label above " +
                        "it, an `input` line with `lg` corners, 40dp on one line and an ink focus ring, on Material's " +
                        "own text field pieces. Material's fields float their label inside a taller box.",
                category = Category.CORRECTNESS,
                priority = 6,
                severity = Severity.ERROR,
                implementation = Implementation(MaterialComponentDetector::class.java, Scope.JAVA_FILE_SCOPE),
            )

        val LIST_ITEM: Issue =
            Issue.create(
                id = "MaterialListItem",
                briefDescription = "Material's list item instead of Zoonk's row",
                explanation =
                    "Zoonk's `ListRow` in `ui/components/ListRow.kt` is main's row: as dense as main's and iOS's, " +
                        "its mark, title, description and mono data, the learner's place on `muted`, and the chevron " +
                        "of a row that opens a page. Material's `ListItem` is 56dp and up, with its own type and colors.",
                category = Category.CORRECTNESS,
                priority = 6,
                severity = Severity.ERROR,
                implementation = Implementation(MaterialComponentDetector::class.java, Scope.JAVA_FILE_SCOPE),
            )
    }
}
