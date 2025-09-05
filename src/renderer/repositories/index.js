/**
 * Central export for all repository classes
 * Provides singleton instances for each repository
 */

import { CompetitorRepository } from './CompetitorRepository';
import { RaceRepository } from './RaceRepository';
import { TeamRepository } from './TeamRepository';
import { ResultRepository } from './ResultRepository';
import { PersonRepository } from './PersonRepository';
import { CompetitionRepository } from './CompetitionRepository';

// Create singleton instances
const competitorRepository = new CompetitorRepository();
const raceRepository = new RaceRepository();
const teamRepository = new TeamRepository();
const resultRepository = new ResultRepository();
const personRepository = new PersonRepository();
const competitionRepository = new CompetitionRepository();

// Export instances
export {
  competitorRepository,
  raceRepository,
  teamRepository,
  resultRepository,
  personRepository,
  competitionRepository
};

// Also export classes for custom instantiation if needed
export {
  CompetitorRepository,
  RaceRepository,
  TeamRepository,
  ResultRepository,
  PersonRepository,
  CompetitionRepository,
  BaseRepository
} from './BaseRepository';