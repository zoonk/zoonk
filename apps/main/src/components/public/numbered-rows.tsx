import { ListGroup, ListRow, ListRowDescription, ListRowTitle } from "@zoonk/learn/list";

type NumberedRow = { description?: string; id: string; title: React.ReactNode };

function NumberedRowContent({ number, row }: { number: number; row: NumberedRow }) {
  return (
    <>
      <span className="text-faint w-4 shrink-0 font-mono text-xs leading-5 tabular-nums">
        {number}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ListRowTitle className="leading-5">{row.title}</ListRowTitle>
        {row.description && (
          <ListRowDescription className="leading-snug">{row.description}</ListRowDescription>
        )}
      </span>
    </>
  );
}

export function NumberedRows({ rows }: { rows: NumberedRow[] }) {
  return (
    <ListGroup>
      <ol>
        {rows.map((row, index) => (
          <li key={row.id}>
            <ListRow className="items-start py-3">
              <NumberedRowContent number={index + 1} row={row} />
            </ListRow>
          </li>
        ))}
      </ol>
    </ListGroup>
  );
}
