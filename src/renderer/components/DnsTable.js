import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';

export default function OtherResultTable({ data }) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>Start Number</TableCell>
          <TableCell>Rank</TableCell>
          <TableCell>Name</TableCell>
        </TableRow>
      </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.bibNumber}</TableCell>
              <TableCell>{row.title}</TableCell>
              <TableCell>{row.lastName.toUpperCase()} {row.firstName}</TableCell>
            </TableRow>
          ))}
        </TableBody>
    </Table>
  );
}
