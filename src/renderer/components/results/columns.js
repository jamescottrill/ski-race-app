/**
 * Column definitions shared by the race results tables. Defined once at
 * module level so React sees stable cell components between renders.
 */
import React from 'react';
import { Badge } from '../../design-system';

const centred = (render) =>
  function CentredCell({ row }) {
    return <div className="text-center">{render(row.original)}</div>;
  };

const emphasised = (render) =>
  function EmphasisedCell({ row }) {
    return (
      <div className="text-center font-medium">{render(row.original)}</div>
    );
  };

export const competitorName = (row) =>
  `${row.lastName.toUpperCase()} ${row.firstName}`;

const bibColumn = (header) => ({
  accessorKey: 'bibNumber',
  header,
  cell: centred((row) => row.bibNumber),
});
const rankColumn = {
  accessorKey: 'title',
  header: 'Rank',
  cell: centred((row) => row.title),
};
const nameColumn = {
  accessorKey: 'name',
  header: 'Name',
  cell: centred(competitorName),
};
const teamColumn = {
  accessorKey: 'team',
  header: 'Team',
  cell: centred((row) => row.team),
};
const positionColumn = {
  accessorKey: 'position',
  header: 'Position',
  cell: emphasised((row) => row.position),
};

// Position within the displayed table rather than the race
function TablePositionCell({ row, table }) {
  const index = table
    .getSortedRowModel()
    .rows.findIndex((r) => r.id === row.id);
  return <div className="text-center">{index + 1}</div>;
}
const tablePositionColumn = {
  accessorKey: 'position',
  header: 'Position',
  cell: TablePositionCell,
};

const STATUS_BADGE = { DNS: 'warning', DNF: 'danger', DSQ: 'info' };
const runTimeColumn = (field, header, withStatusBadge = false) => ({
  accessorKey: field,
  header,
  cell: centred((row) =>
    withStatusBadge && STATUS_BADGE[row[field]] ? (
      <Badge variant={STATUS_BADGE[row[field]]}>{row[field]}</Badge>
    ) : (
      row[field]
    ),
  ),
});

/** DNS / DNF / DSQ tables */
export const statusColumns = [
  bibColumn('Start Number'),
  rankColumn,
  nameColumn,
];

/** Category podium tables */
export const podiumColumns = [
  bibColumn('Bib'),
  rankColumn,
  nameColumn,
  teamColumn,
  tablePositionColumn,
];

/** Main individual results table for a one- or two-run race */
export const individualResultColumns = (runs) => [
  positionColumn,
  bibColumn('Start Number'),
  rankColumn,
  nameColumn,
  teamColumn,
  runTimeColumn('run1Time', 'Time First Run'),
  ...(runs === 2
    ? [
        runTimeColumn('run2Time', 'Time Second Run'),
        {
          accessorKey: 'totalTime',
          header: 'Total Time',
          cell: emphasised((row) => row.totalTime),
        },
      ]
    : []),
  {
    accessorKey: 'seedPoints',
    header: runs === 2 ? 'Race Points' : 'Seed Points',
    cell: centred((row) => row.seedPoints),
  },
];

/** Main table for a seeding race: both runs scored separately, best kept */
export const seedResultColumns = [
  positionColumn,
  bibColumn('Start Number'),
  rankColumn,
  nameColumn,
  teamColumn,
  runTimeColumn('run1Time', 'Time First Run', true),
  runTimeColumn('run2Time', 'Time Second Run', true),
  {
    accessorKey: 'totalTime',
    header: 'Total Time',
    cell: emphasised((row) => row.totalTime),
  },
  {
    accessorKey: 'points1',
    header: 'Points First Run',
    cell: centred((row) => row.points1),
  },
  {
    accessorKey: 'points2',
    header: 'Points Second Run',
    cell: centred((row) => row.points2),
  },
  {
    accessorKey: 'finalSeed',
    header: 'Best Points',
    cell: emphasised((row) => row.finalSeed),
  },
];

/** Team results: one row per team, listing its scoring racers */
export const teamResultColumns = (timeField) => [
  positionColumn,
  {
    accessorKey: 'time',
    header: 'Total Time',
    cell: emphasised((row) => row.time),
  },
  {
    accessorKey: 'teamName',
    header: 'Team',
    cell: emphasised((row) => row.teamName),
  },
  {
    accessorKey: 'racers',
    header: 'Racers',
    cell: function RacersCell({ row }) {
      return (
        <div className="space-y-1">
          {row.original.racers.map((racer) => (
            <div
              key={racer.id}
              className="text-sm border-b last:border-b-0 pb-1 last:pb-0"
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">{racer.title}</span>
                <span>{competitorName(racer)}</span>
                <span className="text-neutral-600">{racer[timeField]}</span>
              </div>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'points',
    header: 'Race Points',
    cell: emphasised((row) => row.points),
  },
];
