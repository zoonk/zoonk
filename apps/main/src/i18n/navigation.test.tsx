import { describe, expectTypeOf, it } from "vitest";
import { type AppRoute, Link, type useRouter } from "./navigation";

/** Compile representative calls without invoking a React hook in this unit test. */
function assertRouterTypes(router: ReturnType<typeof useRouter>) {
  router.push("/courses");
  // @ts-expect-error -- This path is intentionally absent from the generated route types.
  router.replace("/not-a-route");
}

describe("locale-aware navigation types", () => {
  it("validates unprefixed paths against Next.js's generated routes", () => {
    expectTypeOf<AppRoute<"/courses">>().toEqualTypeOf<"/courses">();
    expectTypeOf<AppRoute<`/courses/${string}`>>().toEqualTypeOf<`/courses/${string}`>();
    expectTypeOf<AppRoute<"/not-a-route">>().toEqualTypeOf<never>();
  });

  it("preserves typed routes for links", () => {
    const validLink = <Link href="/courses">Courses</Link>;
    // @ts-expect-error -- This path is intentionally absent from the generated route types.
    const invalidLink = <Link href="/not-a-route">Invalid</Link>;

    expectTypeOf(validLink).toEqualTypeOf(invalidLink);
  });

  it("preserves typed routes for router navigation", () => {
    expectTypeOf(assertRouterTypes).toBeFunction();
  });
});
