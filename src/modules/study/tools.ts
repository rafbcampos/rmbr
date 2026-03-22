import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import * as StudyService from './service.ts';
import type { StudyTopic } from './types.ts';
import { parseStudyStatus } from './types.ts';
import { getString, getNumber } from '../../shared/tool-args.ts';

function studyTopicToToolResult(topic: StudyTopic): ToolResult {
  return {
    id: topic.id,
    raw_input: topic.raw_input,
    title: topic.title,
    status: topic.status,
    domain: topic.domain,
    notes: topic.notes,
    resources: topic.resources,
    goal_id: topic.goal_id,
    enrichment_status: topic.enrichment_status,
    created_at: topic.created_at,
    updated_at: topic.updated_at,
  };
}

export const studyTools: readonly McpToolDefinition[] = [
  {
    name: 'rmbr_study_create',
    description: `Create a new study topic. Provide enrichment fields to create a fully enriched entity in one step. ${ENRICHMENT_PROMPTS.study}`,
    schema: {
      raw_input: z.string().describe('The raw study topic input'),
      title: z.string().optional().describe('Clear topic title'),
      domain: z.string().optional().describe('Lowercase domain classification'),
      goal_id: z.number().optional().describe('Associated goal ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const topic = StudyService.create(db, getString(args, 'raw_input'));
      const hasEnrichment =
        typeof args.title === 'string' ||
        typeof args.domain === 'string' ||
        typeof args.goal_id === 'number';
      if (hasEnrichment) {
        const enriched = StudyService.enrich(db, topic.id, {
          title: typeof args.title === 'string' ? args.title : undefined,
          domain: typeof args.domain === 'string' ? args.domain : undefined,
          goal_id: typeof args.goal_id === 'number' ? args.goal_id : undefined,
        });
        return studyTopicToToolResult(enriched);
      }
      return studyTopicToToolResult(topic);
    },
  },
  {
    name: 'rmbr_study_list',
    description: 'List study topics with optional filters',
    schema: {
      status: z.string().optional(),
      domain: z.string().optional(),
      goal_id: z.number().optional(),
      page: z.number().optional(),
      page_size: z.number().optional(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const filters: StudyService.StudyFilters = {
        ...(typeof args.status === 'string' ? { status: parseStudyStatus(args.status) } : {}),
        ...(typeof args.domain === 'string' ? { domain: args.domain } : {}),
        ...(typeof args.goal_id === 'number' ? { goalId: args.goal_id } : {}),
      };
      const hasFilters =
        filters.status !== undefined ||
        filters.domain !== undefined ||
        filters.goalId !== undefined;
      const pageVal = args.page;
      const pageSizeVal = args.page_size;
      const pagination =
        typeof pageVal === 'number' || typeof pageSizeVal === 'number'
          ? {
              page: typeof pageVal === 'number' ? pageVal : 1,
              pageSize: typeof pageSizeVal === 'number' ? pageSizeVal : 20,
            }
          : undefined;
      const result = StudyService.list(db, hasFilters ? filters : undefined, pagination);
      return {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        data: result.data.map(studyTopicToToolResult),
      };
    },
  },
  {
    name: 'rmbr_study_get',
    description: 'Get a single study topic by id',
    schema: {
      id: z.number(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const topic = StudyService.getById(db, getNumber(args, 'id'));
      return studyTopicToToolResult(topic);
    },
  },
  {
    name: 'rmbr_study_transition',
    description: 'Transition a study topic to a new status',
    schema: {
      id: z.number(),
      status: z.string(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const topic = StudyService.transition(
        db,
        getNumber(args, 'id'),
        parseStudyStatus(getString(args, 'status')),
      );
      return studyTopicToToolResult(topic);
    },
  },
  {
    name: 'rmbr_study_add_note',
    description: 'Add a note to a study topic',
    schema: {
      id: z.number(),
      note: z.string(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const topic = StudyService.addNote(db, getNumber(args, 'id'), getString(args, 'note'));
      return studyTopicToToolResult(topic);
    },
  },
  {
    name: 'rmbr_study_add_resource',
    description: 'Add a resource URL to a study topic',
    schema: {
      id: z.number(),
      resource: z.string(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const topic = StudyService.addResource(
        db,
        getNumber(args, 'id'),
        getString(args, 'resource'),
      );
      return studyTopicToToolResult(topic);
    },
  },
  {
    name: 'rmbr_study_next',
    description: 'Get the next queued study topic',
    schema: {},
    handler: async (db): Promise<ToolResult> => {
      const topic = StudyService.getNext(db);
      if (!topic) {
        return { found: false };
      }
      return { found: true, ...studyTopicToToolResult(topic) };
    },
  },
  {
    name: 'rmbr_study_enrich',
    description: `Enrich a study topic with structured data. ${ENRICHMENT_PROMPTS.study}`,
    schema: {
      id: z.number(),
      title: z.string().optional(),
      domain: z.string().optional(),
      goal_id: z.number().optional(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const fields: StudyService.EnrichFields = {
        title: typeof args.title === 'string' ? args.title : undefined,
        domain: typeof args.domain === 'string' ? args.domain : undefined,
        goal_id: typeof args.goal_id === 'number' ? args.goal_id : undefined,
      };
      const topic = StudyService.enrich(db, getNumber(args, 'id'), fields);
      return studyTopicToToolResult(topic);
    },
  },
];
