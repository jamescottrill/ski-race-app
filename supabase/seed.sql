-- Local development and test data: one published demo meeting with a two-run
-- giant slalom, four competitors, one team and results for run 1. Applied by
-- `supabase db reset`; never applied to a hosted project.

insert into seasons (id, starts_on, ends_on) values ('2025-26', '2025-07-01', '2026-06-30');

insert into meetings (id, slug, name, description, level, season_id, starts_on, ends_on, venue, is_published, published_at)
values ('0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', 'demo-meeting', 'Demo Qualifying Championship', 'Seed data for local development',
        'qualifying', '2025-26', '2026-01-05', '2026-01-10', 'Serre Chevalier', true, now());

insert into competitors (id, service_number, first_name, last_name, title, birth_year, gender, country) values
  ('11111111-1111-4111-8111-111111111111', '30000001', 'Ann', 'Able', 'Capt', 1994, 'F', 'GBR'),
  ('22222222-2222-4222-8222-222222222222', '30000002', 'Ben', 'Baker', 'LCpl', 2004, 'M', 'GBR'),
  ('33333333-3333-4333-8333-333333333333', '30000003', 'Carl', 'Clark', 'Sgt', 1988, 'M', 'GBR'),
  ('44444444-4444-4444-8444-444444444444', '30000004', 'Dan', 'Davies', 'Pte', 2001, 'M', 'GBR');

insert into meeting_entries (id, meeting_id, competitor_id, title, regiment, arrival_corps_seed, is_senior, is_junior, is_veteran, is_novice, is_female, do_not_publish) values
  ('a1111111-1111-4111-8111-111111111111', '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', '11111111-1111-4111-8111-111111111111', 'Capt', '1 RHA', 150.25, true, false, false, false, true, false),
  ('a2222222-2222-4222-8222-222222222222', '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', '22222222-2222-4222-8222-222222222222', 'LCpl', '1 RHA', 220.00, false, true, false, true, false, false),
  ('a3333333-3333-4333-8333-333333333333', '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', '33333333-3333-4333-8333-333333333333', 'Sgt', '2 RTR', 95.50, false, false, true, false, false, false),
  ('a4444444-4444-4444-8444-444444444444', '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', '44444444-4444-4444-8444-444444444444', 'Pte', '2 RTR', null, true, false, false, false, false, true);

insert into teams (id, meeting_id, name, team_type) values
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', '1 RHA A', 'unit');

insert into races (id, meeting_id, name, race_date, race_type, is_individual, is_seeding, number_runs, venue, course_name, officials, sequence) values
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', '0b8e1c2d-3f4a-4b5c-8d6e-7f8091a2b3c4', 'Seeding Giant Slalom', '2026-01-05', 'GS', true, true, 2,
   'Serre Chevalier', 'Luc Alphand', '{"tech_delegate": "Maj BAKER B GBR", "referee": null, "asst_referee": null, "chief_of_race": "Lt Col DAVIES D GBR"}', 1);

insert into race_runs (race_id, run_number, course_setter, number_gates, turning_gates, start_time, forerunners, is_complete) values
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 1, 'Capt EVANS Edward GBR', 42, 40, '09:30', '{"FOX GBR","GREEN GBR"}', false),
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 2, null, null, null, null, '{}', false);

insert into team_members (team_id, race_id, entry_id) values
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', null, 'a1111111-1111-4111-8111-111111111111'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', null, 'a2222222-2222-4222-8222-222222222222');

insert into start_list_entries (race_id, entry_id, bib_number, seed_points) values
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'a3333333-3333-4333-8333-333333333333', 1, 95.50),
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'a1111111-1111-4111-8111-111111111111', 2, 150.25),
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'a2222222-2222-4222-8222-222222222222', 3, 220.00),
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 'a4444444-4444-4444-8444-444444444444', 4, null);

insert into results (race_id, run_number, entry_id, race_time, is_dns, is_dnf, is_dsq, is_ns, dsq_gate) values
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 1, 'a3333333-3333-4333-8333-333333333333', 58.41, false, false, false, false, null),
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 1, 'a1111111-1111-4111-8111-111111111111', 61.23, false, false, false, false, null),
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 1, 'a2222222-2222-4222-8222-222222222222', null, false, true, false, false, null),
  ('c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f', 1, 'a4444444-4444-4444-8444-444444444444', null, false, false, true, false, 17);
