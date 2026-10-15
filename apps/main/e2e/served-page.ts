import { type Page, expect } from "./fixtures";

/** A page that's there. */
const OK = 200;

/**
 * A page as the server sent it, before any script ran: its HTML, its main area, the words of the
 * main area's heading and how many skeleton placeholders the main area holds. It must answer with
 * `status` (a page that's there, by default).
 */
export async function getServedPage(page: Page, path: string, status = OK) {
  const response = await page.request.get(path, { maxRedirects: 0 });
  expect(response.status(), path).toBe(status);

  const html = await response.text();
  const main = html.slice(html.indexOf("<main"), html.lastIndexOf("</main>"));
  const heading = /<h1[^>]*>(?<words>.*?)<\/h1>/su.exec(main)?.groups?.words ?? "";

  return {
    heading: heading.replaceAll(/<[^>]+>/gu, "").replaceAll("&#x27;", "'"),
    html,
    main,
    skeletons: main.match(/data-slot="skeleton"/gu)?.length ?? 0,
  };
}
