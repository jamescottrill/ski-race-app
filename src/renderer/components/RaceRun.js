/* eslint-disable no-nested-ternary */
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
  Autocomplete,
  Grid,
  IconButton,
} from '@mui/material';
import { race } from 'eslint-plugin-promise/rules/lib/promise-statics';
import AddIcon from '@mui/icons-material/Add';
import {
  convertRaceTime,
  convertHumanTime,
  formatTime,
} from '../utils/TimeUtils';
import PersonModal from './PersonModal';
import { secondRunStartListPdf } from '../utils/SecondRunStartListPdf'

export default function RaceRun({
  raceId,
  competitionId,
  runId,
  totalRuns,
  edit = false,
  isSeedingRace = false,
}) {
  const [data, setData] = useState([]);
  const [people, setPeople] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedPersonField, setSelectedPersonField] = useState(null);
  const [runDetails, setRunDetails] = useState({
    courseSetter: '',
    numberGates: '',
    turningGates: '',
    startTime: '',
    forerunner1: '',
    forerunner2: '',
    forerunner3: '',
    forerunner4: '',
  });

  const handleOpenModal = (field) => {
    setSelectedPersonField(field);
    setModalOpen(true);
  };

  const fetchPeople = async () => {
    const query = `SELECT id, first_name, last_name FROM people`;
    try {
      const result = await window.api.select(query);
      setPeople(result);
    } catch (error) {
      console.error('Failed to fetch people:', error);
    }
  };

  const initRunDetails = async () => {
    const query = `SELECT
    course_setter AS courseSetter,
    number_gates AS numberGates,
    turning_gates AS turningGates,
    start_time AS startTime,
    forerunner_a AS forerunnerA,
    forerunner_b AS forerunnerB,
    forerunner_c AS forerunnerC,
    forerunner_d AS forerunnerD,
    c.competition_name,
    c.competition_description,
    r.race_name,
    r.venue,
    r.race_date,
    r.course_name
    FROM race_run rr
    LEFT JOIN races r ON r.race_id = rr.race_id
    LEFT JOIN competitions c ON c.id = rr.competition_id
    WHERE rr.race_id = ? AND run_number = ?
     `;
    const params = [raceId, runId];
    const results = await window.api.select(query, params);
    if (results && results.length > 0) {
      setRunDetails(results[0]);
    }
  };
  const initialData = async () => {
    let initQuery;
    if (runId === 1) {
      initQuery = `
        SELECT rr.racer_id
             , rc.bib_number
             , rr.racer_id
             , p.first_name
             , p.last_name
             , rr.race_time
             , rr.dsq_gate
             , rr.dsq_reason
             , rr.is_dnf
             , rr.is_dns
             , rr.is_dsq
             , rr.is_ns
             , NULL as prev_race_time
        FROM race_results rr
               INNER JOIN people p ON p.id = rr.racer_id
               INNER JOIN race_competitor rc ON
          rc.race_id = rr.race_id
            AND rc.competition_id = rr.competition_id
            AND rc.racer_id = rr.racer_id
        WHERE rr.run_number = ?
          AND rr.race_id = ?
          AND rr.competition_id = ?
        ORDER BY bib_number
      `;
    } else {
      initQuery = `
      SELECT rr.racer_id
        , rc.bib_number
        , rr.racer_id
        , p.first_name
        , p.last_name
        , cc.title
        , p.dob
        , p.gender
        , cc.is_junior
        , cc.is_novice
        , cc.is_veteran
        , cc.is_reserve
        , cc.regiment
        , rr.race_time
        , rr.dsq_gate
        , rr.dsq_reason
        , rr.is_dnf
        , rr.is_dns
        , rr.is_dsq
        , rr.is_ns
        , rr1.race_time AS prev_race_time
      FROM race_results rr
      INNER JOIN people p ON p.id = rr.racer_id
      LEFT JOIN competition_competitor cc ON cc.racer_id = p.id
--       LEFT JOIN competition_team_members ctm ON ctm.racer_id = p.id
--       LEFT JOIN competition_team ct ON ct.team_id = ctm.team_id
      INNER JOIN race_competitor rc ON
      rc.race_id = rr.race_id
      AND rc.competition_id = rr.competition_id
      AND rc.racer_id = rr.racer_id
      LEFT JOIN race_results rr1 ON rr1.racer_id = rr.racer_id AND rr1.run_number = rr.run_number - 1 AND rr1.race_id = rr.race_id
      WHERE rr.run_number = ?
        AND rr.race_id = ?
        AND rr.competition_id = ?
--         AND NOT COALESCE(ct.is_female, FALSE)
--         AND NOT COALESCE(ct.is_corps, FALSE)
      ORDER BY prev_race_time ASC NULLS LAST , bib_number ASC
              `;
    }
    const initParams = [runId, raceId, competitionId];
    try {
      let results;
      results = await window.api.select(initQuery, initParams);
      if (runId > 1) {
        const top = results.slice(0, 15).reverse();
        const rest = results.slice(15);
        results = [...top, ...rest];
      }
      const mapped = results.map((result) => {
        return {
          id: `${result.racer_id}/${runId}`,
          bibNumber: result.bib_number,
          firstName: result.first_name,
          first_name: result.first_name,
          lastName: result.last_name,
          last_name: result.last_name,
          team: result.team_name,
          title: result.title,
          raceTime: convertRaceTime(result.race_time),
          status: result.is_dns
            ? 'DNS'
            : result.is_dnf
              ? 'DNF'
              : result.is_dsq
                ? 'DSQ'
                : result.is_ns
                  ? 'NS'
                  : result.race_time
                      ? 'Finished'
                      : '',
          gateDisqualified: result.dsq_gate,
          dsqReason: result.dsq_reason,
          gender: result.gender || null,
          is_junior: result.is_junior || null,
          is_senior: result.is_senior || null,
          is_veteran: result.is_veteran || null,
          is_novice: result.is_novice || null,
          is_reserve: result.is_reserve || null,
        };
      });
      setData(mapped);
      setLoaded(true);
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
      setLoaded(true);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Update formData based on user input
    const updatedFormData = {
      ...runDetails,
      [name]: type === 'checkbox' ? checked : value,
    };
    setRunDetails(updatedFormData);
  };

  const handleSavePerson = async (personId) => {
    await fetchPeople(); // Refresh the list of people after adding a new one
    setRunDetails({
      ...runDetails,
      [selectedPersonField]: personId, // Automatically select the new person
    });
    setModalOpen(false); // Close the modal after saving
    setSelectedPersonField(null);
  };

  const handlePrintStartlist = async () => {
    secondRunStartListPdf(runDetails, data);
  };

  const handleTimeChange = (id, value) => {
    const updatedData = data.map((row) =>
      row.id === id ? { ...row, raceTime: value } : row,
    );
    setData(updatedData);
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

  const handleStatusChange = (id, value, newData = undefined) => {
    const nData = newData ?? data;
    const updatedData = nData.map((row) =>
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
      handleUpdatedField('is_ns', false, id);
    } else if (value === 'DNF') {
      handleUpdatedField('is_dns', false, id);
      handleUpdatedField('is_dnf', true, id);
      handleUpdatedField('is_dsq', false, id);
      handleUpdatedField('is_ns', false, id);
    } else if (value === 'DSQ') {
      handleUpdatedField('is_dns', false, id);
      handleUpdatedField('is_dnf', false, id);
      handleUpdatedField('is_dsq', true, id);
      handleUpdatedField('is_ns', false, id);
    } else if (value === 'NS') {
      handleUpdatedField('is_dns', false, id);
      handleUpdatedField('is_dnf', false, id);
      handleUpdatedField('is_dsq', false, id);
      handleUpdatedField('is_ns', true, id);
    } else {
      if (row.is_dns) handleUpdatedField('is_dns', false, id);
      if (row.is_dnf) handleUpdatedField('is_dnf', false, id);
      if (row.is_dsq) handleUpdatedField('is_dsq', false, id);
      if (row.is_ns) handleUpdatedField('is_ns', false, id);
    }
  };

  const handleTimeBlur = (id, val) => {
    let value = val.padStart(6, '0');
    const timeRegex = /^([0-5]?[0-9])(:|\.)?([0-5][0-9])\.?\d{0,2}$/;
    if (!timeRegex.test(value) && value !== '') return;
    value = formatTime(value);
    const updatedData = data.map((row) =>
      row.id === id ? { ...row, raceTime: value } : row,
    );
    handleUpdatedField('race_time', convertHumanTime(value), id);
    const row = data.filter((r) => r.id === id)[0];
    if (row.status === '' && value !== '') {
      handleStatusChange(id, 'Finished', updatedData);
    } else {
      setData(updatedData);
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
    if (isSeedingRace) {
      saveResults(data);
    } else {
      saveResults(completedRacers);
    }
  };

  const saveResults = async (results) => {
    const nextRun = runId + 1;
    const completeQuery = `UPDATE race_run SET is_complete = true WHERE race_id = ? AND run_number = ?`;
    await window.api.select(completeQuery, [raceId, runId]);
    if (runId === totalRuns) {
      window.alert('All results saved.');
      return;
    }
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
      const promises = [];
      results.forEach((result) => {
        const res = window.api.insert(raceQuery, [
          competitionId,
          raceId,
          result.id.split('/')[0],
          nextRun,
        ]);
        promises.push(res);
      });
      const complete = await Promise.all(promises);
      alert(`Results saved successfully.`);
    } catch (error) {
      console.error(`Failed to save results:`, error);
    }
  };

  const handleAutocompleteChange = (event, newValue) => {
    setRunDetails({
      ...runDetails,
      [event.target.parentElement.id.split('-')[0]]: newValue
        ? newValue.id
        : '',
    });
  };

  const handleSaveCourseDetails = async () => {
    const query1 = `
      UPDATE race_run
      SET course_setter  = ?,
          number_gates   = ?,
          turning_gates  = ?,
          start_time     = ?,
          forerunner_a   = ?,
          forerunner_b   = ?,
          forerunner_c   = ?,
          forerunner_d   = ?
      WHERE race_id = ? AND run_number = ?;
    `;
    const params1 = [
      runDetails.courseSetter,
      runDetails.numberGates,
      runDetails.turningGates,
      runDetails.startTime,
      runDetails.forerunner1,
      runDetails.forerunner2,
      runDetails.forerunner3,
      runDetails.forerunner4,
      raceId,
      runId,
    ];
    try {
      await window.api.insert(query1, params1);
    } catch (e) {
      window.alert(e);
    }
  };

  useEffect(() => {
    fetchPeople();
    initialData();
    initRunDetails();
  }, []);

  return (
    <>
      <div className="block justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Course Details</h3>
        <Grid container spacing={2}>
          <Grid item xs={11}>
            <Autocomplete
              id="courseSetter"
              name="courseSetter"
              label="Course Setter"
              options={people}
              getOptionLabel={(option) =>
                `${option.first_name} ${option.last_name}`
              }
              onChange={handleAutocompleteChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="courseSetter"
                  inputProps={{
                    ...params.inputProps,
                  }}
                />
              )}
              value={
                runDetails.courseSetter
                  ? people.find((e) => e.id === runDetails.courseSetter)
                  : null
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          </Grid>
          <Grid item xs={1}>
            <IconButton onClick={() => handleOpenModal('courseSetter')}>
              <AddIcon />
            </IconButton>
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="Number of Gates"
              name="numberGates"
              id="numberGates"
              type="number"
              variant="outlined"
              onChange={handleChange}
              placeholder="Enter total number of gates"
              value={runDetails.numberGates}
            />
          </Grid>
          <Grid item xs={4}>
          <TextField
            label="Number of Turning Gates"
            name="turningGates"
            id="turningGates"
            type="number"
            variant="outlined"
            onChange={handleChange}
            placeholder="Enter number of turning gates"
            value={runDetails.turningGates}
          />
          </Grid>
          <Grid item xs={4}>
          <TextField
            label="Start Time"
            variant="outlined"
            type="text"
            name="startTime"
            id="startTime"
            onChange={handleChange}
            placeholder="HH:MM"
            value={runDetails.startTime}
            helperText="Use HH:MM format"
          />
          </Grid>
          {[...Array(4)].map((_, index) => (
            <>
            <Grid item xs={8}>
            <Autocomplete
              id={`forerunner${index + 1}`}
              name={`forerunner${index + 1}`}
              options={people}
              getOptionLabel={(option) =>
                `${option.first_name} ${option.last_name}`
              }
              onChange={handleAutocompleteChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={`Forerunner ${index + 1}`}
                  inputProps={{
                    ...params.inputProps,
                  }}
                />
              )}
              value={
                runDetails[`forerunner${index + 1}`]
                  ? people.find(
                      (e) => e.id === runDetails[`forerunner${index + 1}`],
                    )
                  : null
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
            </Grid>
            <Grid item xs={1}>
              <IconButton onClick={() => handleOpenModal(`forerunner${index + 1}`)}>
                <AddIcon />
              </IconButton>
            </Grid>
            </>
          ))}
        </Grid>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveCourseDetails}
          className=" block text-white py-2 px-4 rounded shadow-lg mt-4"
        >
          Save Course Details
        </Button>
        {runId == 2 && (
        <Button
        variant="contained"
        color="primary"
        onClick={handlePrintStartlist}
        className="block text-white py-2 px-4 rounded shadow-lg mt-4"
      >Export Start List</Button>
      )
      }
      </div>
      <TableContainer component={Paper}>
        {data.length > 0 && (
          <>
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
                    <TableCell align="center">{row.bibNumber}</TableCell>
                    <TableCell align="center">
                      {row.lastName.toUpperCase()} {row.firstName}
                    </TableCell>
                    <TableCell align="center">
                      <TextField
                        value={row.raceTime}
                        onChange={(e) =>
                          handleTimeChange(row.id, e.target.value)
                        }
                        onBlur={(e) => handleTimeBlur(row.id, e.target.value)}
                        placeholder="MM:SS.SS"
                        inputProps={{ className: 'race-time-input' }}
                        type="text"
                        disabled={!edit}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Select
                        value={row.status}
                        onChange={(e) =>
                          handleStatusChange(row.id, e.target.value)
                        }
                        displayEmpty
                        disabled={!edit}
                      >
                        <MenuItem value="Finished">
                          <em>Finished</em>
                        </MenuItem>
                        <MenuItem value="DNS">DNS</MenuItem>
                        <MenuItem value="DNF">DNF</MenuItem>
                        <MenuItem value="DSQ">DSQ</MenuItem>
                        <MenuItem value="NS">Non-Starter</MenuItem>
                      </Select>
                    </TableCell>
                    <TableCell align="center">
                      {row.status === 'DSQ' ? (
                        <TextField
                          type="number"
                          value={row.gateDisqualified}
                          onChange={(e) =>
                            handleGateChange(row.id, e.target.value)
                          }
                          placeholder="Gate #"
                          inputProps={{ min: 1 }}
                          disabled={!edit}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {row.status === 'DSQ' ? (
                        <TextField
                          value={row.dsqReason}
                          onChange={(e) =>
                            handleDsqReason(row.id, e.target.value)
                          }
                          placeholder="Missed Gate"
                          inputProps={{ min: 1 }}
                          disabled={!edit}
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSaveResults}
              className="text-white py-2 px-4 rounded shadow-lg w-full"
              disabled={!edit}
            >
              Save Results
            </Button>
          </>
        )}
        {data.length === 0 && loaded && (
          <div>
            No Competitors found, make sure you've marked the previous run as
            finished.
          </div>
        )}
        {data.length === 0 && !loaded && (
          <div>
            Loading, please wait...
          </div>
        )}
      </TableContainer>
      <PersonModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSavePerson}
      />
    </>
  );
}
