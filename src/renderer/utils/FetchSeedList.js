/* eslint-disable camelcase, prefer-destructuring, @typescript-eslint/no-unused-vars, no-case-declarations  */
import * as dfd from 'danfojs';
import { seedPointsOneRun, seedPointsTwoRun } from '../queries/SeedPoints';
import { seedingPoints } from '../queries/SeedResults';
import { raceQuery } from '../components/RaceResultTwoRun';
import { raceQueryOneRun } from '../components/RaceResult';
import { round } from './MathFx';
// import { race } from 'eslint-plugin-promise/rules/lib/promise-statics';

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

const getRaceResult = async (competitionId, raceId) => {
  try {
    const query = `SELECT number_runs FROM races WHERE race_id = ? AND competition_id = ?`;
    const results = await window.api.select(query, [raceId, competitionId]);

    if (!results || results.length === 0) {
      throw new Error(`Race not found: ${raceId}`);
    }

    const numRuns = results[0].number_runs;
    let query2;
    let values;
    if (numRuns === 1) {
      query2 = raceQueryOneRun;
      values = [raceId];
    } else {
      query2 = raceQuery;
      values = [raceId, raceId];
    }
    const results2 = await window.api.select(query2, values);
    return results2;
  } catch (error) {
    console.error('Failed to get race result:', error);
    throw new Error(`Failed to get race result for race ${raceId}: ${error.message}`);
  }
};

const getSeedingRace = async (competitionId) => {
  try {
    const query = `SELECT race_id FROM races WHERE competition_id = ? AND is_seeding = 1`;
    const results = await window.api.select(query, [competitionId]);

    if (!results || results.length === 0) {
      return null;
    }

    return results[0].race_id;
  } catch (error) {
    console.error('Failed to get seeding race:', error);
    return null;
  }
};

const calculateRacerSeedPoints = async (
  row,
  raceIds,
  competitionId,
  prevSL,
) => {
  // Use raceIds.length as the authoritative race count (not derived from row keys)
  // This prevents mismatch when 'initial' is added as a virtual race
  const numRaces = raceIds.length;

  // Extract race points from the row for the races we're tracking
  const nonNullRaces = raceIds
    .map((raceId) => row[raceId])
    .filter((x) => x !== null && x !== undefined && !Number.isNaN(x));
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
        There is also an exception for competitors who do not start due to injury:
        If a competitor does not start in any one race, either through sickness,
        injury, reasons beyond his control, or the ruling of the Race Jury (e.g. Rule 704.8.3), his
        position on the current seed list will be matched to the race points awarded to the competitor
        who finished in that position in the race. A competitor will not be allowed to take advantage
        of this rule more than once at any meeting.
        Rule 704.8.3 - Didn't complete a DH training run.
         */
        // eslint-disable-next-line no-use-before-define
        // Racers get the seed results they should have had from the most recent, non-successful race.
        let previousRaces = raceIds.slice(0, 2);
        const sR = await window.api.select(
          `SELECT race_id
           FROM races
           WHERE competition_id = ?
             AND is_seeding
           LIMIT 1`,
          [competitionId],
        );
        const sRId = sR && sR.length > 0 ? sR[0].race_id : null;
        if (sRId && !raceIds.includes(sRId)) {
          previousRaces.unshift(sRId);
        }
        let previousSeedList = await fetchSeedList(
          competitionId,
          previousRaces,
        );
        // This gets the previously calculated seed list, because once a competitor has artificial seed points,
        // they keep them for the rest of the competition.
        // They never need to get the first race as it's either the initial seeding points,
        // or if they've missed all they'll have previous seed points from the race
        let mostRecentRace = raceIds[2];
        if (row[mostRecentRace] !== null) {
          // If we're not using the most recent race then we also need to get the seed list at the time of the previous race.
          // so that we have the competitors correct position in the seed list.
          mostRecentRace = raceIds[1];
          previousRaces = previousRaces.slice(0, 2);
          if (sRId && !raceIds.includes(sRId)) {
            previousRaces.unshift(sRId);
          }
          previousSeedList = await fetchSeedList(competitionId, previousRaces);
        }
        const competitorRanking = previousSeedList.findIndex(
          (x) => x.racer_id === row.racer_id,
        );
        const results = await getRaceResult(competitionId, mostRecentRace);

        const competitorResult = results.findIndex(
          (x) => x.racer_id === row.racer_id,
        );
        const finishedResults = results.filter((x) => {
          return (
            x.seed_points !== null &&
            !x.is_ns &&
            !x.is_dnf &&
            !x.is_dsq &&
            !x.is_dns
          );
        });
        let sPoints;
        if (finishedResults[competitorRanking]) {
          sPoints = finishedResults[competitorRanking].seed_points;
        } else {
          sPoints = finishedResults[finishedResults.length - 1].seed_points;
        }
        let penaltyAdd = 10;
        let penaltyMultiply = 1.2;
        try {
          if (results[competitorResult] && results[competitorResult].is_ns) {
            penaltyAdd = 0;
            penaltyMultiply = 1;
          }
        } catch (e) {
          console.error('Failed to check NS status for competitor:', row.racer_id, e);
        }
        if (sPoints < 50) {
          sPoints += penaltyAdd;
        } else {
          sPoints *= penaltyMultiply;
        }
        nonNullRaces.push(round(sPoints));
        row[mostRecentRace] = round(sPoints);
        row[`${mostRecentRace}-penalty`] = true;
        // row[mostRecentRace] = `${round(sPoints)}*`;


        if (nonNullRaces.length < 2) {
          for (const raceId of raceIds) {
            if (previousSeedList[competitorRanking][raceId] !== null) {
              row[raceId] = round(previousSeedList[competitorRanking][raceId]);
              if(previousSeedList[competitorRanking][`${raceId}-penalty`]){
                row[`${raceId}-penalty`] = true;
              }
              nonNullRaces.push(
                round(previousSeedList[competitorRanking][raceId]),
              );
              break;
            }
          }
        }
      }
      const bestTwo = nonNullRaces.sort((a, b) => a - b).slice(0, 2);
      finalSeedPoints = (bestTwo[0] + bestTwo[1]) / 2;
      break;
    case 4:
      // Seeding after the fourth Championship Race: sum of the best three divided by 3
      // ALWAYS copy over previous penalty points first
      const competitorRanking4 = prevSL.findIndex(
        (x) => x.racer_id === row.racer_id,
      );
      const compSL4 = prevSL[competitorRanking4];
      if(compSL4 === undefined) {
      console.log(competitorRanking4);
      console.log(prevSL);
      console.log(row);
      break;
      }
      raceIds.forEach((raceId) => {
        if (compSL4[raceId] === null || compSL4[raceId] === undefined) {
          return
        }
        if (
          compSL4[raceId] !== undefined &&
          compSL4[raceId] !== null &&
          !Number.isNaN(compSL4[raceId]) &&
          (row[raceId] === null || Number.isNaN(row[raceId]))
        ) {
          row[raceId] = round(compSL4[raceId]);
          if (compSL4[`${raceId}-penalty`]) {
            row[`${raceId}-penalty`] = true;
          }
          nonNullRaces.push(round(compSL4[raceId]));
        }
      });

      // THEN check if new penalty points are needed for the current race
      if (nonNullRaces.length < 3) {
        const mostRecentRace = raceIds[3];
        if (
          row[mostRecentRace] === null ||
          isNaN(row[mostRecentRace]) ||
          row[mostRecentRace] === undefined
        ) {
          const results = await getRaceResult(competitionId, mostRecentRace);
          const competitorResult = results.findIndex(
            (x) => x.racer_id === row.racer_id,
          );
          const finishedResults = results.filter((x) => {
            return (
              x.seed_points !== null &&
              !x.is_ns &&
              !x.is_dnf &&
              !x.is_dsq &&
              !x.is_dns
            );
          });
          let sPoints;
          if (finishedResults[competitorRanking4]) {
            sPoints = finishedResults[competitorRanking4].seed_points;
          } else {
            sPoints = finishedResults[finishedResults.length - 1].seed_points;
          }
          let penaltyAdd = 10;
          let penaltyMultiply = 1.2;
          try {
            if (results[competitorResult] && results[competitorResult].is_ns) {
              penaltyAdd = 0;
              penaltyMultiply = 1;
            }
          } catch (e) {
            console.error('Failed to check NS status for competitor:', row.racer_id, e);
          }
          if (sPoints < 50) {
            sPoints += penaltyAdd;
          } else {
            sPoints *= penaltyMultiply;
          }
          nonNullRaces.push(round(sPoints));
          row[mostRecentRace] = round(sPoints);
          row[`${mostRecentRace}-penalty`] = true;
        }
      }
      const bestThree4 = nonNullRaces
        .sort((a, b) => (a === null) - (b === null) || a - b)
        .slice(0, 3);
      finalSeedPoints = (bestThree4[0] + bestThree4[1] + bestThree4[2]) / 3;
      finalSeedPoints = round(finalSeedPoints);
      break;
    default:
      const numMinusTwo = numRaces - 2;

      const competitorRanking = prevSL.findIndex(
        (x) => x.racer_id === row.racer_id,
      );
      const compSL = prevSL[competitorRanking];
      raceIds.forEach((raceId) => {
        if (
          compSL[raceId] !== undefined &&
          compSL[raceId] !== null &&
          !Number.isNaN(compSL[raceId]) &&
          (row[raceId] === null || Number.isNaN(row[raceId]))
        ) {
          const sp = round(compSL[raceId]);
          if (sp !== null) {
            row[raceId] = sp;
            if (compSL[`${raceId}-penalty`]) {
              row[`${raceId}-penalty`] = true;
            }
            nonNullRaces.push(sp);
          }
        }
      });

      if (nonNullRaces.length < numMinusTwo) {
        const mostRecentRace = raceIds[raceIds.length - 1];
        const previousRaces = raceIds.slice(0, raceIds.length - 1);
        if (
          row[mostRecentRace] === null ||
          isNaN(row[mostRecentRace]) ||
          row[mostRecentRace] === undefined
        ) {
          // The racer doesn't have a result for the most recent races, so give penalty points here;
          const results = await getRaceResult(competitionId, mostRecentRace);
          const competitorResult = results.findIndex(
            (x) => x.racer_id === row.racer_id,
          );
          const finishedResults = results.filter((x) => {
            return (
              x.seed_points !== null &&
              !x.is_ns &&
              !x.is_dnf &&
              !x.is_dsq &&
              !x.is_dns
            );
          });
          let sPoints;
          if (finishedResults[competitorRanking]) {
            sPoints = finishedResults[competitorRanking].seed_points;
          } else {
            sPoints = finishedResults[finishedResults.length - 1].seed_points;
          }
          let penaltyAdd = 10;
          let penaltyMultiply = 1.2;
          try {
            if (results[competitorResult] && results[competitorResult].is_ns) {
              penaltyAdd = 0;
              penaltyMultiply = 1;
            }
          } catch (e) {
            console.error('Failed to check NS status for competitor:', row.racer_id, e);
          }
          if (sPoints < 50) {
            sPoints += penaltyAdd;
          } else {
            sPoints *= penaltyMultiply;
          }
          nonNullRaces.push(round(sPoints));
          row[mostRecentRace] = round(sPoints);
          row[`${mostRecentRace}-penalty`] = true;
        }
      }
      // Seeding after the fifth or more races: sum of the best (n - 2) divided by (n - 2)
      const bestNMinusTwo = nonNullRaces
        .sort((a, b) => a - b || Number.isNaN(a) - Number.isNaN(b))
        .slice(0, numRaces - 2);
      finalSeedPoints =
        bestNMinusTwo.reduce((acc, val) => acc + val, 0) / bestNMinusTwo.length;
      break;
  }
  row.seed_points = round(finalSeedPoints);
  return row;
};

const filterByWithdrawalStatus = async (people, competitionId, raceIds) => {
  if (!raceIds || raceIds.length === 0) {
    return people.filter(p => !p.is_withdrawn);
  }

  const realRaceIds = raceIds.filter(r => r !== 'initial');
  if (realRaceIds.length === 0) {
    return people.filter(p => !p.is_withdrawn);
  }

  const raceDates = await window.api.select(
    `SELECT race_id, race_date FROM races WHERE race_id IN (${realRaceIds.map(() => '?').join(',')})`,
    realRaceIds,
  );
  const maxRaceDate = Math.max(...raceDates.map(r => new Date(r.race_date).getTime()));

  const allRaceDates = await window.api.select(
    `SELECT race_id, race_date FROM races WHERE competition_id = ?`,
    [competitionId],
  );
  const dateMap = Object.fromEntries(allRaceDates.map(r => [r.race_id, new Date(r.race_date).getTime()]));

  return people.filter(p => {
    if (!p.is_withdrawn) return true;
    if (!p.last_included_race_id) return false;
    const lastIncludedDate = dateMap[p.last_included_race_id];
    return lastIncludedDate && lastIncludedDate >= maxRaceDate;
  });
};

const getPeople = async (competitionId, raceIds = []) => {
  try {
    const people = await window.api.select(
      `SELECT cc.*
       , p.first_name
       , p.last_name
       , p.birth_year
       , p.gender
       , cc.regiment AS team_name
      FROM competition_competitor cc
        LEFT JOIN people p ON cc.racer_id = p.id
      WHERE cc.competition_id = ?
      `,
      [competitionId],
    );
    const filteredPeople = await filterByWithdrawalStatus(people, competitionId, raceIds);
    return new dfd.DataFrame(filteredPeople);
  } catch (error) {
    console.error('Failed to get people for competition:', competitionId, error);
    throw new Error(`Failed to get people: ${error.message}`);
  }
};

const fetchSeedList = async (competitionId, raceIds) => {
  try {
    const peopleDf = await getPeople(competitionId, raceIds);

    // Check if 'initial' is already in raceIds (from a recursive call)
    const hasInitial = raceIds.includes('initial');
    // Filter out 'initial' for database queries - it's not a real race
    const realRaceIds = raceIds.filter((r) => r !== 'initial');
    //
    if (raceIds.length > 3 && hasInitial) {
      // Once we have more than 3 results, initial are dropped, so remove initial seed points
      raceIds = raceIds.filter((r) => r !== 'initial');
    }
    if (realRaceIds.length === 0 && !hasInitial) {
      const query = `SELECT cc.arrival_corps_seed AS seed_points, cc.racer_id, p.first_name, p.last_name, p.title, p.birth_year, p.gender FROM competition_competitor cc LEFT JOIN people p ON p.id = cc.racer_id WHERE competition_id = ? AND (cc.is_withdrawn = 0 OR cc.is_withdrawn IS NULL) ORDER BY seed_points`;
      return window.api.select(query, [competitionId]);
    }

    const raceTypePromises = [];
    realRaceIds.forEach((race) => {
      const raceType = `SELECT race_id AS raceId, is_seeding AS isSeeding, number_runs AS numRuns FROM races WHERE race_id = ? AND competition_id = ?`;
      const results = window.api.select(raceType, [race, competitionId]);
      raceTypePromises.push(results);
    });

  const resultsPromise = [];
  const raceTypes = await Promise.all(raceTypePromises);

  // Check if there's a seeding race among the races
  const hasSeedingRace = raceTypes.some((raceType) => raceType[0]?.isSeeding);

  // If no seeding race and 'initial' not already included, add initial seed points as a virtual "initial" race
  if (!hasSeedingRace && !hasInitial && raceIds.length <3) {
    const initialSeedQuery = `
      SELECT
        'initial' AS race_id,
        cc.racer_id,
        cc.arrival_corps_seed AS seed_point
      FROM competition_competitor cc
      WHERE cc.competition_id = ?
    `;
    const initialSeedResults = window.api.select(initialSeedQuery, [competitionId]);
    resultsPromise.push(initialSeedResults);
    // Add 'initial' to raceIds so numRaces is correct
    raceIds = ['initial', ...raceIds];
  } else if (hasInitial) {
    // 'initial' was passed in, so we need to fetch the initial seed data
    const initialSeedQuery = `
      SELECT
        'initial' AS race_id,
        cc.racer_id,
        cc.arrival_corps_seed AS seed_point
      FROM competition_competitor cc
      WHERE cc.competition_id = ?
    `;
    const initialSeedResults = window.api.select(initialSeedQuery, [competitionId]);
    resultsPromise.push(initialSeedResults);
  }

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

  // Filter pivotData to only include racers that are in peopleDf (properly filtered for withdrawals)
  const validRacerIds = new Set(peopleDf.racer_id.values);
  const filteredPivotData = pivotData.filter(row => validRacerIds.has(row.racer_id));

  const pivotDf = new dfd.DataFrame(filteredPivotData);

  async function processArray(array, pivDf) {
    const resultP = [];
    const previousRaces = raceIds.slice(0, raceIds.length - 1);
    const previousSeedList = await fetchSeedList(competitionId, previousRaces);

    const previousRaces2 = raceIds.slice(0, raceIds.length - 2);
    if (previousSeedList.length === 2) {
      const sRId = await getSeedingRace(competitionId);
      if (sRId && !raceIds.includes(sRId)) {
        previousRaces2.unshift(sRId);
      }
    }
    const previousSeedList2 = await fetchSeedList(
      competitionId,
      previousRaces2,
    );


    array.forEach((x) => {
        const res = calculateRacerSeedPoints(
          x,
          raceIds,
          competitionId,
          previousSeedList,
        );
        resultP.push(res);
    });
    try {
      const results = Promise.all(resultP);
      return results;
    } catch (error) {
      console.error(error);

    }
  }

  const totalSeed = await processArray(filteredPivotData, pivotDf);
  const totalSeedDf = new dfd.DataFrame(totalSeed);
  const finalResults = dfd.merge({
    left: peopleDf,
    right: totalSeedDf,
    on: ['racer_id'],
    how: 'left',
  });
  finalResults.sortValues('last_name', { inplace: true, ascending: true });
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
  } catch (error) {
    console.error('Failed to fetch seed list:', error);
    throw new Error(`Failed to fetch seed list: ${error.message}`);
  }
};

export { fetchSeedList, raceMultipliers };
