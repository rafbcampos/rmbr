import { describe, it, expect, beforeEach } from 'bun:test';
import type { DrizzleDatabase } from '../../../src/core/drizzle.ts';
import { createTestDb } from '../../helpers/db.ts';
import { goalsMigrations as migrations } from '../../../src/modules/goals/schema.ts';
import * as GoalService from '../../../src/modules/goals/service.ts';
import { GoalStatus, Quarter, EnrichmentStatus } from '../../../src/core/types.ts';
import { NotFoundError, InvalidTransitionError } from '../../../src/core/errors.ts';

describe('GoalService', () => {
  let db: DrizzleDatabase;

  beforeEach(() => {
    db = createTestDb(migrations);
  });

  describe('create', () => {
    it('should create a goal with raw input', () => {
      const goal = GoalService.create(db, 'Improve test coverage');
      expect(goal.id).toBe(1);
      expect(goal.raw_input).toBe('Improve test coverage');
      expect(goal.status).toBe(GoalStatus.Draft);
      expect(goal.title).toBeNull();
      expect(goal.quarter).toBeNull();
      expect(goal.year).toBeNull();
      expect(goal.kpis).toBe('[]');
      expect(goal.enrichment_status).toBe(EnrichmentStatus.Raw);
    });

    it('should create multiple goals with incrementing ids', () => {
      const goal1 = GoalService.create(db, 'Goal 1');
      const goal2 = GoalService.create(db, 'Goal 2');
      expect(goal1.id).toBe(1);
      expect(goal2.id).toBe(2);
    });
  });

  describe('list', () => {
    it('should return empty list when no goals exist', () => {
      const result = GoalService.list(db);
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should list all goals', () => {
      GoalService.create(db, 'Goal 1');
      GoalService.create(db, 'Goal 2');
      const result = GoalService.list(db);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', () => {
      GoalService.create(db, 'Draft goal');
      const activeGoal = GoalService.create(db, 'Active goal');
      GoalService.transition(db, activeGoal.id, GoalStatus.Active);

      const result = GoalService.list(db, { status: GoalStatus.Active });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.status).toBe(GoalStatus.Active);
    });

    it('should filter by quarter and year', () => {
      const goal = GoalService.create(db, 'Q1 goal');
      GoalService.enrich(db, goal.id, { quarter: 'Q1', year: 2026 });
      GoalService.create(db, 'No quarter goal');

      const result = GoalService.list(db, { quarter: Quarter.Q1, year: 2026 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.quarter).toBe(Quarter.Q1);
    });

    it('should paginate results', () => {
      for (let i = 0; i < 5; i++) {
        GoalService.create(db, `Goal ${i}`);
      }
      const result = GoalService.list(db, undefined, { page: 1, pageSize: 2 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('getById', () => {
    it('should return a goal by id', () => {
      const created = GoalService.create(db, 'Test goal');
      const found = GoalService.getById(db, created.id);
      expect(found.id).toBe(created.id);
      expect(found.raw_input).toBe('Test goal');
    });

    it('should throw NotFoundError for non-existent id', () => {
      expect(() => GoalService.getById(db, 999)).toThrow(NotFoundError);
    });
  });

  describe('transition', () => {
    it('should transition from draft to active', () => {
      const goal = GoalService.create(db, 'Draft goal');
      const updated = GoalService.transition(db, goal.id, GoalStatus.Active);
      expect(updated.status).toBe(GoalStatus.Active);
    });

    it('should transition from active to completed', () => {
      const goal = GoalService.create(db, 'Goal');
      GoalService.transition(db, goal.id, GoalStatus.Active);
      const completed = GoalService.transition(db, goal.id, GoalStatus.Completed);
      expect(completed.status).toBe(GoalStatus.Completed);
    });

    it('should transition from active to abandoned', () => {
      const goal = GoalService.create(db, 'Goal');
      GoalService.transition(db, goal.id, GoalStatus.Active);
      const abandoned = GoalService.transition(db, goal.id, GoalStatus.Abandoned);
      expect(abandoned.status).toBe(GoalStatus.Abandoned);
    });

    it('should reject invalid transition from draft to completed', () => {
      const goal = GoalService.create(db, 'Goal');
      expect(() => GoalService.transition(db, goal.id, GoalStatus.Completed)).toThrow(
        InvalidTransitionError,
      );
    });

    it('should reject invalid transition from draft to abandoned', () => {
      const goal = GoalService.create(db, 'Goal');
      expect(() => GoalService.transition(db, goal.id, GoalStatus.Abandoned)).toThrow(
        InvalidTransitionError,
      );
    });

    it('should reject transition from completed', () => {
      const goal = GoalService.create(db, 'Goal');
      GoalService.transition(db, goal.id, GoalStatus.Active);
      GoalService.transition(db, goal.id, GoalStatus.Completed);
      expect(() => GoalService.transition(db, goal.id, GoalStatus.Active)).toThrow(
        InvalidTransitionError,
      );
    });

    it('should reject transition from abandoned', () => {
      const goal = GoalService.create(db, 'Goal');
      GoalService.transition(db, goal.id, GoalStatus.Active);
      GoalService.transition(db, goal.id, GoalStatus.Abandoned);
      expect(() => GoalService.transition(db, goal.id, GoalStatus.Active)).toThrow(
        InvalidTransitionError,
      );
    });

    it('should throw NotFoundError for non-existent goal', () => {
      expect(() => GoalService.transition(db, 999, GoalStatus.Active)).toThrow(NotFoundError);
    });
  });

  describe('enrich', () => {
    it('should enrich a goal with title, quarter, year, and kpis', () => {
      const goal = GoalService.create(db, 'Raw goal');
      const enriched = GoalService.enrich(db, goal.id, {
        title: 'Enriched Goal',
        quarter: 'Q2',
        year: 2026,
        kpis: '["metric1", "metric2"]',
      });

      expect(enriched.title).toBe('Enriched Goal');
      expect(enriched.quarter).toBe(Quarter.Q2);
      expect(enriched.year).toBe(2026);
      expect(enriched.kpis).toBe('["metric1", "metric2"]');
      expect(enriched.enrichment_status).toBe(EnrichmentStatus.Enriched);
    });

    it('should throw NotFoundError when enriching non-existent goal', () => {
      expect(() => GoalService.enrich(db, 999, { title: 'x' })).toThrow(NotFoundError);
    });
  });

  describe('addStarNarrative', () => {
    it('should add a STAR narrative to a goal', () => {
      const goal = GoalService.create(db, 'Goal with STAR');
      const narrative = GoalService.addStarNarrative(db, goal.id, {
        situation: 'Team was struggling with deployments',
        task: 'Automate the deployment pipeline',
        action: 'Built CI/CD pipeline with GitHub Actions',
        result: 'Deployment time reduced by 80%',
      });

      expect(narrative.id).toBe(1);
      expect(narrative.goal_id).toBe(goal.id);
      expect(narrative.situation).toBe('Team was struggling with deployments');
      expect(narrative.task).toBe('Automate the deployment pipeline');
      expect(narrative.action).toBe('Built CI/CD pipeline with GitHub Actions');
      expect(narrative.result).toBe('Deployment time reduced by 80%');
    });

    it('should throw NotFoundError for non-existent goal', () => {
      expect(() =>
        GoalService.addStarNarrative(db, 999, {
          situation: 's',
          task: 't',
          action: 'a',
          result: 'r',
        }),
      ).toThrow(NotFoundError);
    });
  });

  describe('getStarNarratives', () => {
    it('should return all STAR narratives for a goal', () => {
      const goal = GoalService.create(db, 'Goal');
      GoalService.addStarNarrative(db, goal.id, {
        situation: 's1',
        task: 't1',
        action: 'a1',
        result: 'r1',
      });
      GoalService.addStarNarrative(db, goal.id, {
        situation: 's2',
        task: 't2',
        action: 'a2',
        result: 'r2',
      });

      const narratives = GoalService.getStarNarratives(db, goal.id);
      expect(narratives).toHaveLength(2);
    });

    it('should return empty array for goal with no narratives', () => {
      const goal = GoalService.create(db, 'Goal');
      const narratives = GoalService.getStarNarratives(db, goal.id);
      expect(narratives).toHaveLength(0);
    });

    it('should throw NotFoundError for non-existent goal', () => {
      expect(() => GoalService.getStarNarratives(db, 999)).toThrow(NotFoundError);
    });
  });

  describe('getQuarterlyReviewData', () => {
    it('should gather goals and narratives for a quarter', () => {
      const goal = GoalService.create(db, 'Q1 goal');
      GoalService.enrich(db, goal.id, { quarter: 'Q1', year: 2026 });
      GoalService.addStarNarrative(db, goal.id, {
        situation: 's',
        task: 't',
        action: 'a',
        result: 'r',
      });

      const data = GoalService.getQuarterlyReviewData(db, Quarter.Q1, 2026);
      expect(data.goals).toHaveLength(1);
      expect(data.starNarratives).toHaveLength(1);
      expect(data.existingReview).toBeNull();
    });

    it('should return empty data for quarter with no goals', () => {
      const data = GoalService.getQuarterlyReviewData(db, Quarter.Q3, 2026);
      expect(data.goals).toHaveLength(0);
      expect(data.starNarratives).toHaveLength(0);
      expect(data.existingReview).toBeNull();
    });

    it('should include existing review if present', () => {
      GoalService.saveQuarterlyReview(db, {
        quarter: Quarter.Q1,
        year: 2026,
        what_went_well: 'Great progress',
        improvements: 'Need more tests',
        kpi_summary: 'All green',
        generated_narrative: 'Narrative text',
      });

      const data = GoalService.getQuarterlyReviewData(db, Quarter.Q1, 2026);
      expect(data.existingReview).not.toBeNull();
      expect(data.existingReview?.what_went_well).toBe('Great progress');
    });
  });

  describe('saveQuarterlyReview', () => {
    it('should create a new quarterly review', () => {
      const review = GoalService.saveQuarterlyReview(db, {
        quarter: Quarter.Q2,
        year: 2026,
        what_went_well: 'Shipped features',
        improvements: 'Better testing',
        kpi_summary: 'Met targets',
        generated_narrative: 'Full narrative',
      });

      expect(review.id).toBe(1);
      expect(review.quarter).toBe(Quarter.Q2);
      expect(review.year).toBe(2026);
      expect(review.what_went_well).toBe('Shipped features');
    });

    it('should upsert an existing quarterly review', () => {
      GoalService.saveQuarterlyReview(db, {
        quarter: Quarter.Q1,
        year: 2026,
        what_went_well: 'Original',
        improvements: 'Original',
        kpi_summary: 'Original',
        generated_narrative: 'Original',
      });

      const updated = GoalService.saveQuarterlyReview(db, {
        quarter: Quarter.Q1,
        year: 2026,
        what_went_well: 'Updated',
        improvements: 'Updated',
        kpi_summary: 'Updated',
        generated_narrative: 'Updated',
      });

      expect(updated.what_went_well).toBe('Updated');
      expect(updated.improvements).toBe('Updated');
    });
  });
});
