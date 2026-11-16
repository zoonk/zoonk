package com.zoonk.lint

import com.android.tools.lint.checks.infrastructure.LintDetectorTest
import com.android.tools.lint.checks.infrastructure.TestLintTask
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue

class CentralizedFormattingDetectorTest : LintDetectorTest() {
    override fun getDetector(): Detector = CentralizedFormattingDetector()

    override fun getIssues(): List<Issue> = listOf(CentralizedFormattingDetector.ISSUE)

    override fun lint(): TestLintTask = super.lint().allowMissingSdk()

    private val formats =
        """
        package com.zoonk.android.ui.format
        import java.time.format.DateTimeFormatter
        import java.text.SimpleDateFormat
        import java.text.DateFormat
        fun date() = DateTimeFormatter.ofPattern("MMMM d")
        fun legacy() = SimpleDateFormat("yyyy-MM-dd")
        fun shortDate() = DateFormat.getDateInstance()
        fun duration(minutes: Int) = "${'$'}minutes min"
        fun clock(hour: Int, minute: Int) = "%02d:%02d".format(java.util.Locale.ROOT, hour, minute)
        """

    fun testReportsDirectFormatting() {
        lint().files(kotlin("src/com/zoonk/android/ui/format/Screen.kt", formats).indented()).run().expectErrorCount(5)
    }

    fun testReportsDateUtilsAndDurationConcatenation() {
        lint()
            .files(
                java(
                    """
                package android.text.format;
                public class DateUtils {
                    public static String formatDateTime(Object context, long time, int flags) { return ""; }
                    public static String getRelativeTimeSpanString(long time) { return ""; }
                }
            """,
                ).indented(),
                kotlin(
                    """
                package test.pkg
                import android.text.format.DateUtils
                import java.time.LocalDate
                import java.time.format.DateTimeFormatter
                fun date() = DateUtils.formatDateTime(null, 0L, 0)
                fun relative() = DateUtils.getRelativeTimeSpanString(0L)
                fun duration(minutes: Int) = minutes.toString() + " min"
                fun day(value: LocalDate) = value.format(DateTimeFormatter.ISO_DATE)
            """,
                ).indented(),
            ).run()
            .expectErrorCount(4)
    }

    fun testAllowsSharedClock() {
        lint().files(kotlin("src/com/zoonk/android/ui/format/Clock.kt", formats).indented()).run().expectClean()
    }

    fun testAllowsOnlySharedFormatterPaths() {
        lint()
            .files(kotlin("src/com/zoonk/android/ui/format/Formatters.kt", formats).indented())
            .run()
            .expectClean()
    }

    fun testDoesNotExemptUnrelatedFormattersFile() {
        lint().files(kotlin("src/other/Formatters.kt", formats).indented()).run().expectErrorCount(5)
    }

    fun testAllowsParsingSharedHelpersAndUnrelatedStrings() {
        lint()
            .files(
                kotlin(
                    """
                    package test.pkg
                    import java.time.LocalDate
                    fun parse(value: String) = LocalDate.parse(value)
                    fun title(name: String) = "Hello ${'$'}name"
                    fun fixed() = "5 min"
                    fun cacheKey(id: String, state: String) = "${'$'}id:${'$'}state"
                    fun label(subjects: String, questions: Int) = "${'$'}subjects ${'$'}questions"
                    fun payload(fields: String) = "{fields:${'$'}fields}"
                    fun fields(fields: String) = "${'$'}fields"

                    fun formatMinutes(value: Int) = value.toString()
                    fun screen() = formatMinutes(5)
                    """,
                ).indented(),
            ).run()
            .expectClean()
    }

    fun testReportsDisplayNames() {
        lint()
            .files(
                kotlin(
                    """
            package test.pkg
            import java.time.DayOfWeek
            import java.time.Month
            import java.time.ZoneId
            import java.time.format.TextStyle
            import java.util.Locale
            fun day() = DayOfWeek.MONDAY.getDisplayName(TextStyle.FULL, Locale.US)
            fun month() = Month.JANUARY.getDisplayName(TextStyle.FULL, Locale.US)
            fun zone() = ZoneId.of("UTC").getDisplayName(TextStyle.FULL, Locale.US)
        """,
                ).indented(),
            ).run()
            .expectErrorCount(3)
    }

    fun testReportsOneSitePerFormatterChain() {
        lint()
            .files(
                kotlin(
                    """
            package test.pkg
            import java.time.LocalDate
            import java.time.format.DateTimeFormatter
            import java.time.format.FormatStyle
            import java.util.Locale
            fun date(value: LocalDate) = DateTimeFormatter
                .ofLocalizedDate(FormatStyle.MEDIUM)
                .withLocale(Locale.US)
                .format(value)
        """,
                ).indented(),
            ).run()
            .expectErrorCount(1)
    }

    fun testKeepsSeparateSitesAndGroupsConfiguredChains() {
        lint()
            .files(
                kotlin(
                    """
            package test.pkg
            import java.text.SimpleDateFormat
            import java.util.Date
            import java.util.TimeZone
            fun values(date: Date) = listOf(
                SimpleDateFormat("yyyy-MM-dd").apply { timeZone = TimeZone.getTimeZone("UTC") }.format(date),
                SimpleDateFormat("HH:mm").format(date)
            )
        """,
                ).indented(),
            ).run()
            .expectErrorCount(2)
    }

    fun testAllowsSharedWeekdayNames() {
        lint()
            .files(
                kotlin(
                    "src/com/zoonk/android/ui/format/WeekdayNames.kt",
                    """
            package com.zoonk.android.ui.format
            import java.time.DayOfWeek
            import java.time.format.TextStyle
            import java.util.Locale
            fun day() = DayOfWeek.MONDAY.getDisplayName(TextStyle.FULL, Locale.US)
        """,
                ).indented(),
            ).run()
            .expectClean()
    }
}
