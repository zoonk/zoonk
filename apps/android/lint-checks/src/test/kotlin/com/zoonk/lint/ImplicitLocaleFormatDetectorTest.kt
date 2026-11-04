package com.zoonk.lint

import com.android.tools.lint.checks.infrastructure.LintDetectorTest
import com.android.tools.lint.checks.infrastructure.TestLintTask
import com.android.tools.lint.detector.api.Detector
import com.android.tools.lint.detector.api.Issue

class ImplicitLocaleFormatDetectorTest : LintDetectorTest() {
    override fun getDetector(): Detector = ImplicitLocaleFormatDetector()

    override fun getIssues(): List<Issue> = listOf(ImplicitLocaleFormatDetector.ISSUE)

    override fun lint(): TestLintTask = super.lint().allowMissingSdk()

    fun testFormatsWhoseDigitsFollowTheDevicesLanguageAreReported() {
        lint()
            .files(
                kotlin(
                    """
                package test.pkg
                fun time(hour: Int, minute: Int) = "%02d:%02d".format(hour, minute)
                fun band(value: Double) = "%.1f".format(value)
                fun padded(value: Int) = "%s %0<4d".format(value)
                fun shout(word: String) = "%S".format(word)
                """,
                ).indented(),
            ).run()
            .expectErrorCount(4)
    }

    fun testFormatsWithALocaleOrWithoutLocalizedDigitsAreClean() {
        lint()
            .files(
                kotlin(
                    """
                package test.pkg
                import java.util.Locale
                fun hex(byte: Byte) = "%02x".format(byte)
                fun name(first: String) = "%s!".format(first)
                fun share() = "100%%".format()
                fun root(hour: Int) = "%02d".format(Locale.ROOT, hour)
                fun javaStyle(hour: Int) = String.format(Locale.ROOT, "%02d", hour)
                """,
                ).indented(),
            ).run()
            .expectClean()
    }
}
