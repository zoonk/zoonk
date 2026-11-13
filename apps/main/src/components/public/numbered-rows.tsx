import { ListGroup, ListRow } from "@zoonk/learn/list";

type NumberedRow = { description?: string; id: string; title: React.ReactNode };

function NumberedRowContent({ number, row }: { number: number; row: NumberedRow }) {
  return (
    <>
      <span className="text-faint w-4 shrink-0 font-mono text-xs leading-5 tabular-nums">
        {number}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-5 font-medium text-pretty">{row.title}</span>
        {row.description && (
          <span className="text-muted-foreground text-xs leading-snug text-pretty">
            {row.description}
          </span>
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
