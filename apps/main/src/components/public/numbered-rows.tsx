import { ListGroup, ListRow, ListRowDescription, ListRowNumberedTitle } from "@zoonk/learn/list";

type NumberedRow = { description?: string; id: string; title: React.ReactNode };

export function NumberedRows({ rows }: { rows: NumberedRow[] }) {
  return (
    <ListGroup>
      <ol>
        {rows.map((row, index) => (
          <li key={row.id}>
            <ListRow className="py-3">
              <ListRowNumberedTitle
                description={
                  row.description && <ListRowDescription>{row.description}</ListRowDescription>
                }
                number={index + 1}
              >
                {row.title}
              </ListRowNumberedTitle>
            </ListRow>
          </li>
        ))}
      </ol>
    </ListGroup>
  );
}
