import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  emptyLabel?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  emptyLabel = "No records available.",
  onRowClick,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className={cn(
                "data-table__row",
                onRowClick && "data-table__row--interactive",
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={`${getRowKey(row)}-${column.key}`}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
