# @zoonk/testing

Shared testing infrastructure for Zoonk apps.

## Overview

This package provides fixtures and utilities for testing across all Zoonk applications. It centralizes test setup to avoid code duplication and ensure consistent testing patterns.

## Usage

Add as a dev dependency in your app:

```json
{
  "devDependencies": {
    "@zoonk/testing": "workspace:*"
  }
}
```

Import fixtures in your tests:

```ts
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture, courseAttrs } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { userFixture, userAttrs } from "@zoonk/testing/fixtures/users";
```
