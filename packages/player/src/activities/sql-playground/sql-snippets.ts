import { type CodeSnippet } from "../_utils/insert-at-cursor";

type Table = { columns: readonly { name: string }[]; name: string };
type NamedSnippet = CodeSnippet & { label: string; name: string };

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "ORDER BY",
  "DESC",
  "GROUP BY",
  "COUNT(*)",
];

/**
 * Buttons for the SQL words a lesson query needs and the lesson's own table and column names,
 * so a phone keyboard only types values. Keywords add a space after themselves.
 */
export function sqlSnippets(tables: readonly Table[]): NamedSnippet[] {
  const all = [
    ...SQL_KEYWORDS.map((keyword) => ({ before: `${keyword} `, label: keyword, name: keyword })),
    ...tables.flatMap((table) => [
      { before: `${table.name} `, label: table.name, name: table.name },
      ...table.columns.map((column) => ({
        before: column.name,
        label: column.name,
        name: column.name,
      })),
    ]),
  ];

  return all.filter(
    (snippet, index) => all.findIndex((item) => item.label === snippet.label) === index,
  );
}
