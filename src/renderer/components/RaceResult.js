// eslint-disable no-nested-ternary
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
  Button,
} from '@mui/material';

export default function RaceResult({
  raceId,
  competitionId,
  runId,
  edit = false,
}) {
  const [data, setData] = useState([]);
  const [runs, setRuns] = useState([1]);

  const initialData = async () => {
    let raceQuery;
    let raceQueryValues;
      raceQuery = `
        SELECT
            race_id
            , racer_id
            , race_time
        FROM race_results rr
        JOIN people p ON p.id = rr.racer_id
        WHERE race_id = ?
      `;
      raceQueryValues = [raceId];
    }
    }
    try{
      const results = await window.api.select(raceQuery, raceQueryValues);
    } catch (e){
      console.error('Failed to fetch competitors:', error);
    }
      const mapped = results.map((result) => {
        return {
          id: `${result.racer_id}/results`,
          bibNumber: result.bib_number,
          firstName: result.first_name,
          lastName: result.last_name,
          raceTime: result.race_time,
        };
      });
      setData(mapped);
    }
  };

  const handleUpdatedField = async (key, value, racerId) => {
    const racerUid = racerId.split('/')[0];
    const query = `
    UPDATE race_results
    SET ${key} = ?
    WHERE race_id = ? AND competition_id = ? AND  racer_id = ? AND run_number = ?
    `;
    const params = [value, raceId, competitionId, racerUid, runId];
    try {
      await window.api.insert(query, params);
    } catch (error) {
      console.error('Failed to update result:', error);
    }
  };

  const handleTimeChange = (id, value) => {
    const updatedData = data.map((row) =>
      row.id === id ? { ...row, raceTime: value } : row,
    );
    const timeRegex = /^([0-5]?[0-9])(:|\.)?([0-5][0-9])\.?\d{0,2}$/;
    if (!timeRegex.test(value)) return;
    setData(updatedData);
    handleUpdatedField('race_time', value, id);
    if(!updatedData.is_dsq && !updatedData.is_dnf && !updatedData.is_dns) {
      handleStatusChange(id, 'Finished');
    }
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
    const row = data.filter((r) => r.id === id)[0];
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
      if (row.is_dns) handleUpdatedField('is_dns', false, id);
      if (row.is_dnf) handleUpdatedField('is_dnf', false, id);
      if (row.is_dsq) handleUpdatedField('is_dsq', false, id);
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

  const handleSaveResults = () => {
    const completedRacers = data.filter((racer) => racer.status === 'Finished');
    if (completedRacers.length === 0) {
      alert('No completed racers found.');
      return;
    }
    saveResults(completedRacers);
  }

  const saveResults = async (results) => {
    const nextRun = runId + 1;
    const dropQuery = `DELETE FROM race_results WHERE competition_id = ? AND race_id = ? AND run_number = ?`;
    const dropParams = [competitionId, raceId, nextRun];
    try {
      await window.api.insert(dropQuery, dropParams);
    } catch (error) {
      console.error('Failed to delete previous results:', error);
    }
    const raceQuery = `
      INSERT INTO race_results (competition_id, race_id, racer_id, run_number)
      VALUES (?, ?, ?, ?);
    `;
    try {
      for (let i = 0; i < results.length; i++) {
        await window.api.insert(raceQuery, [
          competitionId,
          raceId,
          results[i].id.split('/')[0],
          nextRun
        ]);
      }
      alert(`Results saved successfully.`);
    } catch (error) {
      console.error(`Failed to save results:`, error);
    }

  };

  useEffect(() => {
    initialData();
  }, []);

  return (
    <TableContainer component={Paper}>
      {data.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="center">Position</TableCell>
              <TableCell align="center">Start Number</TableCell>
              <TableCell align="center">Rank</TableCell>
              <TableCell align="center">Name</TableCell>
              <TableCell align="center">Team</TableCell>

              <TableCell align="center">Race Time (MM:SS.SS)</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Gate Disqualified</TableCell>
              <TableCell align="center">Reason Disqualified</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id}>
                <TableCell align="center">{row.bibNumber}</TableCell>
                <TableCell align="center">
                  {row.lastName.toUpperCase()} {row.firstName}
                </TableCell>
                <TableCell align="center">
                  <TextField
                    value={row.raceTime}
                    onBlur={(e) => handleTimeChange(row.id, e.target.value)}
                    placeholder="MM:SS.SS"
                    inputProps={{className: 'race-time-input' }}
                    type="text"
                  />
                </TableCell>
                <TableCell align="center">
                  <Select
                    value={row.status}
                    onChange={(e) => handleStatusChange(row.id, e.target.value)}
                    displayEmpty
                  >
                    <MenuItem value="Finished">
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
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveResults}
            className="text-white py-2 px-4 rounded shadow-lg w-full"
          >
            Save Results
          </Button>
        </Table>
      )}
      {data.length === 0 && (
        <div>
          No Competitors found, make sure you've marked the previous run as
          finished.
        </div>
      )}
    </TableContainer>
  );
}
