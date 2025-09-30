const getRaceDetails = async (raceId, competitionId) => {
  const query = `
      SELECT
        r.women_separate AS women_separate
        , r.is_seeding
        , r.is_team
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
        , rr1.number_gates AS run1_number_gates
        , rr1.turning_gates AS run1_turning_gates
        , rr2.number_gates AS run2_number_gates
        , rr2.turning_gates AS run2_turning_gates
        , rr1.start_time AS run1_start_time
        , rr2.start_time AS run2_start_time
        , c.competition_name
        , c.competition_description
        , r.number_runs
        , CONCAT(td.title, ' ', UPPER(td.last_name), ' ', SUBSTR(td.first_name,1,1), ' ', UPPER(td.country)) AS tech_delegate
        , CONCAT(cor.title, ' ', UPPER(cor.last_name), ' ', SUBSTR(cor.first_name,1,1), ' ', UPPER(cor.country)) AS chief_of_race
        , CONCAT(rf.title, ' ', UPPER(rf.last_name), ' ', SUBSTR(rf.first_name,1,1), ' ', UPPER(rf.country)) AS referee
        , CONCAT(ar.title, ' ', UPPER(ar.last_name), ' ', SUBSTR(ar.first_name,1,1), ' ', UPPER(ar.country)) AS asst_referee
        , CONCAT(cs1.title, ' ', UPPER(cs1.last_name), ' ', cs1.first_name, ' ', UPPER(cs1.country)) AS course_setter_1
        , CONCAT(cs2.title, ' ', UPPER(cs2.last_name), ' ', cs2.first_name, ' ', UPPER(cs2.country)) AS course_setter_2
        , CONCAT(UPPER(fr1a.last_name), ' ', UPPER(fr1a.country)) AS forerunner_1_a
        , CONCAT(UPPER(fr1b.last_name), ' ', UPPER(fr1b.country)) AS forerunner_1_b
        , CONCAT(UPPER(fr1c.last_name), ' ', UPPER(fr1c.country)) AS forerunner_1_c
        , CONCAT(UPPER(fr1d.last_name), ' ', UPPER(fr1d.country)) AS forerunner_1_d
        , CONCAT(UPPER(fr2a.last_name), ' ', UPPER(fr2a.country)) AS forerunner_2_a
        , CONCAT(UPPER(fr2b.last_name), ' ', UPPER(fr2b.country)) AS forerunner_2_b
        , CONCAT(UPPER(fr2c.last_name), ' ', UPPER(fr2c.country)) AS forerunner_2_c
        , CONCAT(UPPER(fr2d.last_name), ' ', UPPER(fr2d.country)) AS forerunner_2_d
      FROM races r
        LEFT JOIN competitions c ON r.competition_id = c.id
        LEFT JOIN people td ON r.tech_delegate = td.id
        LEFT JOIN people cor ON r.chief_of_race = cor.id
        LEFT JOIN people rf ON r.referee = rf.id
        LEFT JOIN people ar ON r.asst_referee = ar.id
        LEFT JOIN race_run rr1 ON r.race_id = rr1.race_id AND rr1.run_number = 1
        LEFT JOIN people cs1 ON rr1.course_setter = cs1.id
        LEFT JOIN race_run rr2 ON r.race_id = rr2.race_id AND rr2.run_number = 2
        LEFT JOIN people cs2 ON rr2.course_setter = cs2.id
        LEFT JOIN people fr1a ON rr1.forerunner_a = fr1a.id
        LEFT JOIN people fr1b ON rr1.forerunner_b = fr1b.id
        LEFT JOIN people fr1c ON rr1.forerunner_c = fr1c.id
        LEFT JOIN people fr1d ON rr1.forerunner_d = fr1d.id
        LEFT JOIN people fr2a ON rr2.forerunner_a = fr2a.id
        LEFT JOIN people fr2b ON rr2.forerunner_b = fr2b.id
        LEFT JOIN people fr2c ON rr2.forerunner_c = fr2c.id
        LEFT JOIN people fr2d ON rr2.forerunner_d = fr2d.id
      WHERE r.race_id = ? AND r.competition_id = ?
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
