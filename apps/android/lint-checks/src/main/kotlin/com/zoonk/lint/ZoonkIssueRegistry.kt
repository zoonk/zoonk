package com.zoonk.lint

import com.android.tools.lint.client.api.IssueRegistry
import com.android.tools.lint.client.api.Vendor
import com.android.tools.lint.detector.api.CURRENT_API
import com.android.tools.lint.detector.api.Issue

class ZoonkIssueRegistry : IssueRegistry() {
    override val api: Int = CURRENT_API
    override val minApi: Int = CURRENT_API
    override val issues: List<Issue> = listOf(HardcodedComposeTextDetector.ISSUE)
    override val vendor: Vendor = Vendor(vendorName = "Zoonk", identifier = "com.zoonk.lint")
}
