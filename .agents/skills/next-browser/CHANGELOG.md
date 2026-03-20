# @vercel/next-browser

## 0.2.0

### Minor Changes

- [#4](https://github.com/vercel-labs/next-browser/pull/4) [`0f0aa67`](https://github.com/vercel-labs/next-browser/commit/0f0aa670c2a40e7927ca1dba2f9550d56bb89f81) Thanks [@gaojude](https://github.com/gaojude)! - Add `perf` command that profiles a full page load — collects Core Web Vitals (TTFB, LCP, CLS) and React hydration timing in one pass. Also exposes `hydration` as a standalone command for React-only timing. Restructure PPR analysis output to use a Quick Reference table.

- [#6](https://github.com/vercel-labs/next-browser/pull/6) [`b53f406`](https://github.com/vercel-labs/next-browser/commit/b53f406a66e1142e5e1b0b24233beb14a609ec53) Thanks [@gaojude](https://github.com/gaojude)! - Add `--file` and stdin (`-`) modes to `eval` command to avoid shell quoting failures

- [#8](https://github.com/vercel-labs/next-browser/pull/8) [`9b3dd4c`](https://github.com/vercel-labs/next-browser/commit/9b3dd4ce618e4786d8ff4bba4f4e8a08fff8d153) Thanks [@gaojude](https://github.com/gaojude)! - Add `snapshot`, `click`, and `fill` commands for page interaction via accessibility tree refs

### Patch Changes

- [#7](https://github.com/vercel-labs/next-browser/pull/7) [`4162ca1`](https://github.com/vercel-labs/next-browser/commit/4162ca172776669e9c3e883d1479d21bb5b2ad4a) Thanks [@gaojude](https://github.com/gaojude)! - Use named pipes on Windows instead of Unix domain sockets to fix daemon startup failure
