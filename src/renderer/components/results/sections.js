/**
 * Building blocks shared by the race results views: a titled table card,
 * the DNS/DNF/DSQ tables for each run, the category podiums, the empty
 * state and the PDF button.
 */
import React from 'react';
import { Card, CardContent, DataTable, Button } from '../../design-system';
import { categoryPodiums } from '../../utils/raceResults';
import { statusColumns, podiumColumns } from './columns';

const STATUS_TABLE_PAGE_SIZE = 30;

export function ResultsSection({
  title,
  columns,
  rows,
  pageSize = 50,
  paginate,
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardContent>
        {title && (
          <h2 className="text-lg font-semibold mb-4 text-center">{title}</h2>
        )}
        <DataTable
          columns={columns}
          data={rows}
          showPagination={paginate ?? rows.length > pageSize}
          pageSize={pageSize}
          className="w-full"
        />
      </CardContent>
    </Card>
  );
}

/** DNS, DNF and DSQ tables for every run in the partition */
export function StatusTables({ partition }) {
  return Object.entries(partition.runs).map(([run, lists]) => (
    <React.Fragment key={run}>
      {[
        ['DNS', lists.dns],
        ['DNF', lists.dnf],
        ['DSQ', lists.dsq],
      ].map(([status, rows]) => (
        <ResultsSection
          key={status}
          title={`${status} Run ${run}`}
          columns={statusColumns}
          rows={rows}
          pageSize={STATUS_TABLE_PAGE_SIZE}
        />
      ))}
    </React.Fragment>
  ));
}

/** Top three per category from the finished list */
export function CategoryPodiums({ finished }) {
  if (finished.length === 0) return null;
  return categoryPodiums(finished).map(({ key, title, rows }) => (
    <Card key={key}>
      <CardContent>
        <h2 className="text-lg font-semibold mb-4 text-center">{title}</h2>
        <DataTable
          columns={podiumColumns}
          data={rows}
          showPagination={false}
          className="w-full"
        />
      </CardContent>
    </Card>
  ));
}

export function NoResults() {
  return (
    <Card>
      <CardContent>
        <div className="text-center py-8 text-neutral-600">
          No Competitors found, make sure you&apos;ve marked the previous run as
          finished.
        </div>
      </CardContent>
    </Card>
  );
}

export function PdfButton({ onClick, disabled }) {
  return (
    <div className="flex justify-center">
      <Button onClick={onClick} disabled={disabled}>
        Download PDF
      </Button>
    </div>
  );
}
