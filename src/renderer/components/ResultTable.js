import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';

export default function ResultTable({ data }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Bib</TableCell>
          <TableCell>Rank</TableCell>
          <TableCell>Name</TableCell>
          <TableCell>Team</TableCell>
          <TableCell>Position</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={row.id}>
            <TableCell>{row.bibNumber}</TableCell>
            <TableCell>{row.title}</TableCell>
            <TableCell>
              {row.lastName.toUpperCase()} {row.firstName}
            </TableCell>
            <TableCell>{row.team}</TableCell>
            <TableCell>{i + 1}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
