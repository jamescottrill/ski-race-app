const raceMultipliers = {
  Downhill: 1250,
  Slalom: 730,
  'Giant Slalom': 1010,
  'Super G': 1190,
  'Alpine Combined': 1360,
};

const fetchSeedList = async (competitionId) => {
  try {
    // Fetch the race details to get the race type and multiplier
    const raceQuery = `
        SELECT DISTINCT r.race_id, race_type, is_seeding
        FROM races r
        INNER JOIN race_results rr
          ON r.race_id = rr.race_id AND
             r.competition_id = rr.competition_id
        WHERE r.competition_id = ?
      `;
    // Joining on race_results prevents created but not run races from being included
    // As soon as a race has a result it will impact the seed list.
    const raceResult = await window.api.select(raceQuery, [competitionId]);
    console.log(raceResult);
    if (raceResult.length > 0) {
      const raceType = raceResult[0].race_type;
      const multiplier = raceMultipliers[raceType];

      // Fetch run details for the race
      const runQuery = `
          SELECT run_number, race_time, is_training
          FROM race_results rr
          INNER JOIN races r
          ON r.race_id = rr.race_id
          WHERE rr.competition_id = ? AND rr.race_id = ? AND r.is_training = 0
        `;
      const runResult = await window.api.select(runQuery, [
        competitionId,
        raceResult[0].id,
      ]);

      // Fetch the winner's time for each run
      const winnerQuery = `
          SELECT run_number, MIN(race_time) AS winner_time
          FROM race_results rr
          INNER JOIN races r
          ON r.race_id = rr.race_id
          WHERE rr.competition_id = ? AND rr.race_id = ? AND r.is_training = 0
          GROUP BY run_number
        `;
      const winnerResult = await window.api.select(winnerQuery, [
        competitionId,
        raceResult[0].id,
      ]);

      let calculatedSeedList;

      if (raceResult[0].is_seeding) {
        // For seeding races, calculate seed points for each run and pick the best (closest to 0)
        const seedPointsByRun = runResult.map((run) => {
          const winnerTime = winnerResult.find(
            (w) => w.run_number === run.run_number,
          ).winner_time;
          const seedPoints = (run.race_time - winnerTime) * multiplier;
          return { run_number: run.run_number, seed_points: seedPoints };
        });

        const bestSeedPoints = Math.min(
          ...seedPointsByRun.map((sp) => sp.seed_points),
        );

        calculatedSeedList = seedPointsByRun.map((run, index) => ({
          id: run.id,
          first_name: run.first_name,
          last_name: run.last_name,
          title: run.title,
          seed_points: bestSeedPoints,
        }));
      } else {
        // For non-seeding races, sum the times of all runs and then calculate seed points
        const totalTime = runResult.reduce(
          (acc, run) => acc + run.race_time,
          0,
        );
        const winnerTimeSum = winnerResult.reduce(
          (acc, winner) => acc + winner.winner_time,
          0,
        );
        const seedPoints = (totalTime - winnerTimeSum) * multiplier;

        calculatedSeedList = runResult.map((competitor) => ({
          id: competitor.id,
          first_name: competitor.first_name,
          last_name: competitor.last_name,
          title: competitor.title,
          seed_points: seedPoints,
        }));
      }

      return calculatedSeedList;
    }
    // Fetch arrival seed points if no seeding race
    const seedQuery = `
          SELECT p.id, p.first_name, p.last_name, p.title, t.team_name, COALESCE(arrival_army_seed, arrival_corps_seed, 2000) AS seed_points
          FROM competition_competitor sl
          JOIN people p ON sl.racer_id = p.id
          JOIN competition_team t ON sl.team = t.team_id
          WHERE sl.competition_id = ?
          ORDER BY seed_points ASC
        `;
    const seedResult = await window.api.select(seedQuery, [competitionId]);
    return seedResult;
  } catch (error) {
    console.error('Failed to fetch seed list:', error);
  }
};

export { fetchSeedList, raceMultipliers };
