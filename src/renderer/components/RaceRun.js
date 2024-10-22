import React, { useEffect, useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
} from '@mui/material';

export default function RaceRun({ raceId, competitionId, runId }) {
  const [data, setData] = useState([]);

  const initialData = async () => {
    const initQuery = `
    SELECT
      rr.racer_id, rc.bib_number, rc.racer_id, p.first_name, p.last_name,
      rr.race_time, rr.dsq_gate, rr.dsq_reason, rr.is_dnf, rr.is_dns, rr.is_dsq
    FROM  race_results rr
    INNER JOIN people p ON p.id = rr.racer_id
    INNER JOIN race_competitor rc ON rc.race_id = rr.racer_id
    WHERE rr.race_id = ? AND rr.competition_id = ? AND rr.run_id = ?
    `;
    const initParams = [raceId, competitionId, runId];
    try {
      const results = await window.api.select(initQuery, initParams);
      const mapped = results.map((result) => {
        return {
          bibNumber: result.bib_number,
          firstName: result.first_name,
          lastName: result.last_name,
          raceTime: result.race_time,
          status: result.is_dns
            ? 'DNS'
            : result.is_dnf
              ? 'DNF'
              : result.is_dsq
                ? 'DSQ'
                : 'Finished',
          gateDisqualified: result.dsq_gate,
          dsqReason: result.dsq_reason,
        };
      });
      console.log(mapped);
      setData(mapped);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    }
  };

  const handleUpdatedField = async (key, value, racerId) => {
    const query = `
    UPDATE race_results
    SET ${key} = ?
    WHERE race_id = ? AND competition_id = ? AND  racer_id = ? AND run_id = ?
    `;
    const params = [value, raceId, competitionId, racerId, runId];
    try {
      await window.api.insert(query, params);
    } catch (error) {
      console.error('Failed to create race:', error);
    }
  };

  const handleTimeChange = (id, value) => {
    const updatedData = data.map((row) =>
      row.id === id ? { ...row, raceTime: value } : row,
    );
    setData(updatedData);
    handleUpdatedField('race_time', value, raceId, competitionId, id);
    // }
  };

  const handleStatusChange = (id, value) => {
    const updatedData = data.map((row) =>
      row.id === id
        ? {
            ...row,
            status: value,
            gateDisqualified: value === 'DSQ' ? row.gateDisqualified : '',
            dsqReason: value === 'DSQ' ? row.dsqReason : '',
          }
        : row,
    );
    setData(updatedData);
    if (value === 'DNS') {
      handleUpdatedField('is_dns', true, id);
      handleUpdatedField('is_dnf', false, id);
      handleUpdatedField('is_dsq', false, id);
    } else if (value === 'DNF') {
      handleUpdatedField('is_dns', false, id);
      handleUpdatedField('is_dnf', true, id);
      handleUpdatedField('is_dsq', false, id);
    } else if (value === 'DSQ') {
      handleUpdatedField('is_dns', false, id);
      handleUpdatedField('is_dnf', false, id);
      handleUpdatedField('is_dsq', true, id);
    } else {
      handleUpdatedField('is_dns', false, id);
      handleUpdatedField('is_dnf', false, id);
      handleUpdatedField('is_dsq', false, id);
    }
  };

  const handleGateChange = (id, value) => {
    const updatedData = data.map((row) =>
      row.id === id ? { ...row, gateDisqualified: value } : row,
    );
    setData(updatedData);
    handleUpdatedField('dsq_gate', value, id);
  };

  const handleDsqReason = (id, value) => {
    const updatedData = data.map((row) =>
      row.id === id ? { ...row, dsqReason: value } : row,
    );
    setData(updatedData);
    handleUpdatedField('dsq_reason', value, id);
  };

  // const handleSave = () => {
  //   console.log('Saved data:', data);
  //   // Implement save logic here, e.g., sending the data to a backend API or saving to a database
  // };

  useEffect(() => {
    initialData();
  }, []);

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell align="center">Bib Number</TableCell>
            <TableCell align="center">Competitor</TableCell>
            <TableCell align="center">Race Time (MM:SS.SS)</TableCell>
            <TableCell align="center">Status</TableCell>
            <TableCell align="center">Gate Disqualified</TableCell>
            <TableCell align="center">Reason Disqualified</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell align="center">{row.bib_number}</TableCell>
              <TableCell align="center">
                {row.last_name.toUpperCase()} {row.first_name}
              </TableCell>
              <TableCell align="center">
                <TextField
                  value={row.raceTime}
                  onChange={(e) => handleTimeChange(row.id, e.target.value)}
                  placeholder="MM:SS.SS"
                  inputProps={{ min: 1 }}
                />
              </TableCell>
              <TableCell align="center">
                <Select
                  value={row.status}
                  onChange={(e) => handleStatusChange(row.id, e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>Finished</em>
                  </MenuItem>
                  <MenuItem value="DNS">DNS</MenuItem>
                  <MenuItem value="DNF">DNF</MenuItem>
                  <MenuItem value="DSQ">DSQ</MenuItem>
                </Select>
              </TableCell>
              <TableCell align="center">
                {row.status === 'DSQ' ? (
                  <TextField
                    type="number"
                    value={row.gateDisqualified}
                    onChange={(e) => handleGateChange(row.id, e.target.value)}
                    placeholder="Gate #"
                    inputProps={{ min: 1 }}
                  />
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell align="center">
                {row.status === 'DSQ' ? (
                  <TextField
                    value={row.dsqReason}
                    onChange={(e) => handleDsqReason(row.id, e.target.value)}
                    placeholder="Missed Gate"
                    inputProps={{ min: 1 }}
                  />
                ) : (
                  '-'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
