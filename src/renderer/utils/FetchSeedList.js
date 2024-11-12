/* eslint-disable camelcase, prefer-destructuring, @typescript-eslint/no-unused-vars, no-case-declarations  */
import * as dfd from 'danfojs';
import { seedPointsOneRun, seedPointsTwoRun } from '../queries/SeedPoints';
import { seedingPoints } from '../queries/SeedResults';

const raceMultipliers = {
  Downhill: 1250,
  Slalom: 730,
  'Giant Slalom': 1010,
  'Super G': 1190,
  'Alpine Combined': 1360,
};

const DEFAULT_SEED_POINTS = 2000;

const calculateRacerSeedPoints = (row, df) => {
  // Extract all UUID keys (assuming UUIDs are non-standard alphanumeric)
  const racePoints = Object.keys(row)
    .filter((key) => key !== 'racer_id' && key !== 'seed_points') // Filter out racer_id and seed_points
    .map((key) => row[key]);
  const numRaces = racePoints.length;
  let finalSeedPoints;
  switch (numRaces) {
    case 1:
      finalSeedPoints = racePoints[0];
      break;
    case 2:
      // Seeding after the first Championship Race: better of initial points and first race
      finalSeedPoints = Math.min(racePoints[0], racePoints[1]);
      break;
    case 3:
      // Seeding after the second Championship Race: sum of the best two divided by 2
      // Seeding after the third championship Race: sum of the best two divided by 2, Initial Seed Points Dropped
      const bestTwo = racePoints.sort((a, b) => a - b).slice(0, 2);
      finalSeedPoints = (bestTwo[0] + bestTwo[1]) / 2;
      break;
    case 4:
      // Seeding after the fourth Championship Race: sum of the best three divided by 3
      const bestThree4 = racePoints.sort((a, b) => a - b).slice(0, 3);
      finalSeedPoints = (bestThree4[0] + bestThree4[1] + bestThree4[2]) / 3;
      break;
    case 5:
      // Seeding after the fifth Championship Race: sum of the best three divided by 3
      const bestThree5 = racePoints.sort((a, b) => a - b).slice(0, 3);
      finalSeedPoints = (bestThree5[0] + bestThree5[1] + bestThree5[2]) / 3;
      break;
    default:
      // Seeding after the fifth or more races: sum of the best (n - 2) divided by (n - 2)
      const bestNMinusTwo = racePoints
        .sort((a, b) => a - b)
        .slice(0, numRaces - 2);
      finalSeedPoints =
        bestNMinusTwo.reduce((acc, val) => acc + val, 0) / bestNMinusTwo.length;
      break;
  }
  row.seed_points = finalSeedPoints;
  return row;
};

const calculateTotalSeedPoints = async (dataFrame) => {};

const fetchSeedList = async (competitionId, raceIds) => {
  const people = await window.api.select(
    'SELECT rc.*, p.first_name, p.last_name, p.title, p.dob, p.gender FROM race_competitor rc LEFT JOIN people p ON rc.racer_id = p.id WHERE competition_id = ?',
    [competitionId],
  );
  const peopleDf = new dfd.DataFrame(people);
  const raceTypePromises = [];
  raceIds.forEach((race) => {
    const raceType = `SELECT race_id AS raceId, is_seeding AS isSeeding, number_runs AS numRuns FROM races WHERE race_id = ? AND competition_id = ?`;
    const results = window.api.select(raceType, [race, competitionId]);
    raceTypePromises.push(results);
  });
  const resultsPromise = [];
  const raceTypes = await Promise.all(raceTypePromises);
  raceTypes.forEach((raceType) => {
    let query;
    let values;
    if (raceType[0].isSeeding) {
      query = seedingPoints;
      values = [raceType[0].raceId, raceType[0].raceId];
    } else if (raceType[0].numRuns === 1) {
      query = seedPointsOneRun;
      values = [raceType[0].raceId];
    } else if (raceType[0].numRuns === 2) {
      query = seedPointsTwoRun;
      values = [raceType[0].raceId, raceType[0].raceId];
    }
    const results = window.api.select(query, values);
    resultsPromise.push(results);
  });

  const seedPointResults = await Promise.all(resultsPromise);
  // Step 3: Process results into a dataframe.
  const seedData = [];
  seedPointResults.forEach((raceResults) => {
    raceResults.forEach(({ race_id, racer_id, seed_point }) => {
      seedData.push({ race_id, racer_id, seed_point });
    });
  });
  if (seedData.length === 0) return [];
  const df = new dfd.DataFrame(seedData);
  // Step 4: Pivot the data manually
  const uniqueRacers = [...new Set(df.racer_id.values)];
  const uniqueRaces = [...new Set(df.race_id.values)];

  // Create an initial structure for the result
  const pivotData = uniqueRacers.map((racerId) => {
    const row = { racer_id: racerId };
    uniqueRaces.forEach((raceId) => {
      row[raceId] = null; // Initialize with null values
    });
    row.seed_points = 0;
    return row;
  });

  // Fill in the seed points for each racer and race
  df.values.forEach(([race_id, racer_id, seed_point]) => {
    const row = pivotData.find((row) => row.racer_id === racer_id);
    if (row) {
      row[race_id] = seed_point;
    }
  });
  const pivotDf = new dfd.DataFrame(pivotData);
  const totalSeed = pivotData.map((x) => {
    return calculateRacerSeedPoints(x, pivotDf);
  });
  const totalSeedDf = new dfd.DataFrame(totalSeed);
  const finalResults = dfd.merge({
    left: peopleDf,
    right: totalSeedDf,
    on: ['racer_id'],
    how: 'left',
  });
  finalResults.sortValues('seed_points', { inplace: true, ascending: true });
  return dfd.toJSON(finalResults);
};

export { fetchSeedList, raceMultipliers };
