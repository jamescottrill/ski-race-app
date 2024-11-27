const getRaceDetails = async (raceId, competitionId) => {
  const query = `
      SELECT
        women_separate AS is_women_separate
        , is_seeding
        , is_team
        , 15 AS randomise_top
        , 5 AS randomise_top_women
        , venue
        , course_name
        , weather
        , snow
        , temp_start
        , temp_finish
        , homologation
        , start_altitude
        , finish_altitude
        , start_altitude - finish_altitude AS altitude_difference
        , race_date
        , race_name
        , c.competition_name
        , c.competition_description
      FROM races r
        LEFT JOIN people td ON r.tech_delegate = td.id
        LEFT JOIN people cor ON r.chief_of_race = td.id
        LEFT JOIN people rf ON r.referee = td.id
        LEFT JOIN people ar ON r.asst_referee = td.id
        LEFT JOIN competitions c ON r.competition_id = c.id
      WHERE race_id = ? AND competition_id = ?
    `;
  try {
    const result = await window.api.select(query, [raceId, competitionId]);
    if (result && result[0]) {
      return result[0];
    }
  } catch (error) {
    console.error('Failed to fetch race details:', error);
  }
  return null;
};

export { getRaceDetails };
