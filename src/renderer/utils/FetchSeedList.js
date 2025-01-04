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

const getPreviousSeedList = async (competitionId, raceIds, numRaces) => {
  let races;
  if (numRaces === 3) {
    // In this case, getting the previous number of races, we may need to add the seeding race back in.
    races = raceIds.slice(0, numRaces - 1);
    if (sR.length > 0) {
      races.unshift(sR[0].race_id);
    }
  } else {
    races = raceIds.slice(0, numRaces - 1);
  }
  const res = await fetchSeedList(competitionId, races);
  return res;
};

const calculateRacerSeedPoints = async (
  row,
  raceIds,
  competitionId,
  seedResultDf,
) => {
  // Extract all UUID keys (assuming UUIDs are non-standard alphanumeric)
  const racePoints = Object.keys(row)
    .filter((key) => key !== 'racer_id' && key !== 'seed_points') // Filter out racer_id and seed_points
    .map((key) => row[key]);
  const numRaces = racePoints.length;
  const nonNullRaces = racePoints.filter((x) => x !== null);
  let finalSeedPoints;
  switch (numRaces) {
    case 1:
      finalSeedPoints = nonNullRaces[0];
      break;
    case 2:
      // Seeding after the first Championship Race: better of initial points and first race.
      // Initial points includes both the arrival seed points and the results of the seeding race
      // This means that initial seed points will never be null, so we can apply Math.min safely
      finalSeedPoints = Math.min.apply(Math, nonNullRaces);
      break;
    case 3:
      // Seeding after the second Championship Race: sum of the best two divided by 2
      // Seeding after the third championship Race: sum of the best two divided by 2, Initial Seed Points Dropped
      if (nonNullRaces.length < 2) {
        /*
        If the competitor has failed to complete 2 races (i.e. only has initial, or only has 1st)
        we need to use the penalty points. This is explained below:
        The competitor’s position on the current seed list will be matched to the race
        points awarded to the competitor who finished in that position in the race. To these
        race points will be added a penalty of 20% or 10 points whichever is the greater. This
        will give them race points for the race (or first run in the Seeding Giant Slalom race). A
        competitor whose seed position is below the number of the last finisher in the race will
        be awarded either the same race points as the last finisher plus a penalty of 20%, or
        his own seed points, whichever are greater.
        There is also an exception for competitors who do not start due to injury: - this hasn't been coded yet…
        If a competitor does not start in any one race, either through sickness,
        injury, reasons beyond his control, or the ruling of the Race Jury (e.g. Rule 704.8.3), his
        position on the current seed list will be matched to the race points awarded to the competitor
        who finished in that position in the race. A competitor will not be allowed to take advantage
        of this rule more than once at any meeting.
        Rule 704.8.3 - Didn't complete a DH training run.
         */
        // eslint-disable-next-line no-use-before-define
        // const previousSeedList = await getPreviousSeedList(
        //   competitionId,
        //   raceIds,
        //   3,
        // );
        const previousRaces = raceIds.slice(0, 2);
        const sR = await window.api.select(
          `SELECT race_id FROM races WHERE competition_id = ? AND is_seeding LIMIT 1`,
          [competitionId],
        );
        const sRId = sR[0].race_id;
        if (!raceIds.includes(sRId)) {
          previousRaces.unshift(sRId);
        }
        const previousSeedList = await fetchSeedList(competitionId, previousRaces);
        const competitorRanking = previousSeedList.findIndex(
          (x) => x.racer_id === row.racer_id,
        );
        for (let i = 0; i < raceIds.length; i++) {
          const raceId = raceIds[i];
          const hasResult = row[raceId] !== null;
          if (hasResult) {
            continue;
          }
          const sortedDf = seedResultDf
            .sortValues(raceId, { inplace: false, ascending: true })
            .column(raceId)
            .dropNa();
          let sPoints = dfd.toJSON(sortedDf)[raceId][competitorRanking];
          if (!sPoints) {
            sPoints =
              dfd.toJSON(sortedDf)[raceId][
                dfd.toJSON(sortedDf)[raceId].length - 1
              ] * 1.2;
            const userSeed = previousSeedList.find((x) => x.racer_id === row.racer_id);
            const userSeedPoints = userSeed.seed_points;
            if (sPoints < userSeedPoints) {
              sPoints = userSeedPoints;
            }
          } else {
            sPoints *= 1.2;
            if (sPoints < 10) {
              sPoints = 10;
            }
          }
          nonNullRaces.push(sPoints);
          row[raceId] = `${sPoints}*`;
          break;
        }
      }
      const bestTwo = nonNullRaces.sort((a, b) => a - b).slice(0, 2);
      finalSeedPoints = (bestTwo[0] + bestTwo[1]) / 2;
      break;
    case 4:
      // Seeding after the fourth Championship Race: sum of the best three divided by 3
      if (nonNullRaces.length < 3) {
        const previousRaces = raceIds.slice(0, 3);
        const previousSeedList = await fetchSeedList(competitionId, previousRaces);
        const competitorRanking = previousSeedList.findIndex(
          (x) => x.racer_id === row.racer_id,
        );
        for (let i = 0; i < raceIds.length; i++) {
          const raceId = raceIds[i];
          const hasResult = row[raceId] !== null;
          if (hasResult) {
            continue;
          }
          const sortedDf = seedResultDf
            .sortValues(raceId, { inplace: false, ascending: true })
            .column(raceId)
            .dropNa();
          let sPoints = dfd.toJSON(sortedDf)[raceId][competitorRanking];
          if (!sPoints) {
            sPoints = dfd.toJSON(sortedDf)[raceId].pop() * 1.2;
            const userSeedPoints = previousSeedList.find(
              (x) => x.racer_id === row.racer_id,
            ).seed_points;
            if (sPoints < userSeedPoints) {
              sPoints = userSeedPoints;
            }
          } else {
            sPoints *= 1.2;
            if (sPoints < 10) {
              sPoints = 10;
            }
          }
          nonNullRaces.push(sPoints);
          row[raceId] = `${sPoints}*`;
          if(nonNullRaces.length === 3) break;
        }
      }

      const bestThree4 = nonNullRaces.sort((a, b) => a - b).slice(0, 3);
      finalSeedPoints = (bestThree4[0] + bestThree4[1] + bestThree4[2]) / 3;
      break;
    case 5:
      // Seeding after the 5th Championship race. Sum of the best three divided by 3
      if (nonNullRaces.length < 3) {
        const previousRaces = raceIds.slice(0, 3);
        const previousSeedList = await fetchSeedList(competitionId, previousRaces);
        const competitorRanking = previousSeedList.findIndex(
          (x) => x.racer_id === row.racer_id,
        );
        for (let i = 0; i < raceIds.length; i++) {
          const raceId = raceIds[i];
          const hasResult = row[raceId] !== null;
          if (hasResult) {
            continue;
          }
          const sortedDf = seedResultDf
            .sortValues(raceId, { inplace: false, ascending: true })
            .column(raceId)
            .dropNa();
          let sPoints = dfd.toJSON(sortedDf)[raceId][competitorRanking];
          if (!sPoints) {
            sPoints = dfd.toJSON(sortedDf)[raceId].pop() * 1.2;
            const userSeedPoints = previousSeedList.find(
              (x) => x.racer_id === row.racer_id,
            ).seed_points;
            if (sPoints < userSeedPoints) {
              sPoints = userSeedPoints;
            }
          } else {
            sPoints *= 1.2;
            if (sPoints < 10) {
              sPoints = 10;
            }
          }
          nonNullRaces.push(sPoints);
          row[raceId] = `${sPoints}*`;
          if(nonNullRaces.length === 3) break;
        }
      }
      // Seeding after the fifth Championship Race: sum of the best three divided by 3
      const bestThree5 = nonNullRaces.sort((a, b) => a - b).slice(0, 3);
      finalSeedPoints = (bestThree5[0] + bestThree5[1] + bestThree5[2]) / 3;
      break;
    default:
      const numMinusTwo = numRaces - 2;
      if (nonNullRaces.length < numMinusTwo) {
        const previousRaces = raceIds.slice(0, numMinusTwo);
        const previousSeedList = await fetchSeedList(competitionId, previousRaces);
        const competitorRanking = previousSeedList.findIndex(
          (x) => x.racer_id === row.racer_id,
        );
        for (let i = 0; i < raceIds.length; i++) {
          const raceId = raceIds[i];
          const hasResult = row[raceId] !== null;
          if (hasResult) {
            continue;
          }
          const sortedDf = seedResultDf
            .sortValues(raceId, { inplace: false, ascending: true })
            .column(raceId)
            .dropNa();
          let sPoints = dfd.toJSON(sortedDf)[raceId][competitorRanking];
          if (!sPoints) {
            sPoints = dfd.toJSON(sortedDf)[raceId].pop() * 1.2;
            const userSeedPoints = previousSeedList.find(
              (x) => x.racer_id === row.racer_id,
            ).seed_points;
            if (sPoints < userSeedPoints) {
              sPoints = userSeedPoints;
            }
          } else {
            sPoints *= 1.2;
            if (sPoints < 10) {
              sPoints = 10;
            }
          }
          nonNullRaces.push(sPoints);
          row[raceId] = `${sPoints}*`;
          if(nonNullRaces.length === numMinusTwo) break;
        }
      }
      // Seeding after the fifth or more races: sum of the best (n - 2) divided by (n - 2)
      const bestNMinusTwo = nonNullRaces
        .sort((a, b) => a - b)
        .slice(0, numRaces - 2);
      finalSeedPoints =
        bestNMinusTwo.reduce((acc, val) => acc + val, 0) / bestNMinusTwo.length;
      break;
  }
  row.seed_points = finalSeedPoints;
  return row;
};

const getPeople = async (competitionId) => {
  const people = await window.api.select(
    `SELECT cc.*
     , p.first_name
     , p.last_name
     , p.dob
     , p.gender
     , cc.regiment AS team_name
    FROM competition_competitor cc
      LEFT JOIN people p ON cc.racer_id = p.id
--     LEFT JOIN competition_team_members ctm ON cc.racer_id = ctm.racer_id AND cc.competition_id = ctm.competition_id
--     LEFT JOIN competition_team ct ON ctm.team_id = ct.team_id AND ctm.competition_id = ct.competition_id
    WHERE cc.competition_id = ?
--     AND NOT COALESCE(ct.is_hc, FALSE)
--     AND NOT COALESCE(ct.is_female, FALSE)
    `
    ,
    [competitionId],
  );
  return new dfd.DataFrame(people);
};

const fetchSeedList = async (competitionId, raceIds) => {
  const peopleDf = await getPeople(competitionId);
  const raceTypePromises = [];
  raceIds.forEach((race) => {
    const raceType = `SELECT race_id AS raceId, is_seeding AS isSeeding, number_runs AS numRuns FROM races WHERE race_id = ? AND competition_id = ?`;
    const results = window.api.select(raceType, [race, competitionId]);
    raceTypePromises.push(results);
  });
  if (raceIds.length === 0) {
    const query = `SELECT COALESCE(cc.arrival_corps_seed, 2000) AS seed_points, cc.racer_id, p.first_name, p.last_name, p.title, p.dob, p.gender FROM competition_competitor cc LEFT JOIN people p ON p.id = cc.racer_id WHERE competition_id = ? ORDER BY seed_points`;
    return window.api.select(query, [competitionId]);
  }
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

  async function processArray(array) {
    const result = await Promise.all(
      array.map(async (x) => {
        const res = await calculateRacerSeedPoints(
          x,
          raceIds,
          competitionId,
          pivotDf,
        );
        return res;
      }),
    );
    return result;
  }

  const totalSeed = await processArray(pivotData);

  const totalSeedDf = new dfd.DataFrame(totalSeed);
  const finalResults = dfd.merge({
    left: peopleDf,
    right: totalSeedDf,
    on: ['racer_id'],
    how: 'left',
  });
  finalResults.sortValues('seed_points', { inplace: true, ascending: true });
  // Add position as a column to deal with ties
  const ranks = [];
  let rank = 1;
  let previousValue = 0;

  finalResults.seed_points.values.forEach((value, index) => {
    if (value !== previousValue) {
      rank = index + 1;
    }
    ranks.push(rank);
    previousValue = value;
  });

  const withPostition = finalResults.addColumn('position', ranks);
  return dfd.toJSON(withPostition);
};

export { fetchSeedList, raceMultipliers };
