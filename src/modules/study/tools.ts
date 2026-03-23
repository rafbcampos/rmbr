import { z } from 'zod';
import type { McpToolDefinition, ToolArgs, ToolResult } from '../../core/module-contract.ts';
import { ENRICHMENT_PROMPTS } from '../../core/prompts.ts';
import { getString, getNumber, extractFields, extractPagination } from '../../shared/tool-args.ts';
import { entityToToolResult, paginatedToToolResult } from '../../shared/tool-result.ts';
import { StudyService } from './service.ts';
import { parseStudyStatus } from './types.ts';

const STUDY_ENRICH_SPECS = [
  { name: 'title', type: 'string' as const },
  { name: 'domain', type: 'string' as const },
  { name: 'goal_id', type: 'number' as const },
];

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
      const { hasEnrichment, fields } = extractFields(args, STUDY_ENRICH_SPECS);
      if (hasEnrichment) {
        const enriched = StudyService.enrich(db, topic.id, fields);
        return entityToToolResult(enriched);
      }
      return entityToToolResult(topic);
    },
  },
  {
    name: 'rmbr_study_list',
    description: 'List study topics with optional filters',
    schema: {
      status: z.string().optional(),
      domain: z.string().optional(),
      goal_id: z.number().optional(),
      include_deleted: z.boolean().optional().describe('Include soft-deleted study topics'),
      page: z.number().optional(),
      page_size: z.number().optional(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const filters = {
        ...(typeof args.status === 'string' ? { status: parseStudyStatus(args.status) } : {}),
        ...(typeof args.domain === 'string' ? { domain: args.domain } : {}),
        ...(typeof args.goal_id === 'number' ? { goalId: args.goal_id } : {}),
        ...(args.include_deleted === true ? { includeDeleted: true } : {}),
      };
      return paginatedToToolResult(StudyService.list(db, filters, extractPagination(args)));
    },
  },
  {
    name: 'rmbr_study_get',
    description: 'Get a single study topic by id',
    schema: {
      id: z.number(),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      return entityToToolResult(StudyService.getById(db, getNumber(args, 'id')));
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
      return entityToToolResult(topic);
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
      return entityToToolResult(topic);
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
      return entityToToolResult(topic);
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
      return { found: true, ...entityToToolResult(topic) };
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
      const { fields } = extractFields(args, STUDY_ENRICH_SPECS);
      return entityToToolResult(StudyService.enrich(db, getNumber(args, 'id'), fields));
    },
  },
  {
    name: 'rmbr_study_delete',
    description: 'Soft-delete a study topic',
    schema: {
      id: z.number().describe('The study topic ID'),
    },
    annotations: { destructiveHint: true },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      StudyService.softDeleteEntity(db, id);
      return { id, deleted: true };
    },
  },
  {
    name: 'rmbr_study_restore',
    description: 'Restore a soft-deleted study topic',
    schema: {
      id: z.number().describe('The study topic ID'),
    },
    handler: async (db, args: ToolArgs): Promise<ToolResult> => {
      const id = getNumber(args, 'id');
      StudyService.restoreEntity(db, id);
      return entityToToolResult(StudyService.getById(db, id));
    },
  },
];
