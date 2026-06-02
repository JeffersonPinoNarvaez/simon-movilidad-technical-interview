import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { IAgentQueryPort } from '@fleet-portal/domain';
import type { AlertType } from '@fleet-portal/domain';

export function createAgentTools(agentQuery: IAgentQueryPort): DynamicStructuredTool[] {
  return [
    new DynamicStructuredTool({
      name: 'query_vehicle_status',
      description:
        'Query current status of fleet vehicles. Use for location, speed, stopped time, vehicle count, or vehicles in critical zones. Filter examples: all, active, stopped, in_critical_zone, plate:ABC-123',
      schema: z.object({
        sql_filter: z
          .string()
          .describe('Allowed: all, active, stopped, offline, alert, in_critical_zone, or plate:PLATE'),
      }),
      func: async ({ sql_filter }) => {
        const result = await agentQuery.queryVehicleStatus(sql_filter);
        return JSON.stringify(result, null, 2);
      },
    }),
    new DynamicStructuredTool({
      name: 'query_telemetry_history',
      description:
        'Query historical telemetry with 5-minute time buckets for a vehicle or entire fleet.',
      schema: z.object({
        vehicle_id: z.string().uuid().optional(),
        hours_back: z.number().min(1).max(72).default(1),
      }),
      func: async ({ vehicle_id, hours_back }) => {
        const result = await agentQuery.queryTelemetryHistory(vehicle_id, hours_back);
        return JSON.stringify(result, null, 2);
      },
    }),
    new DynamicStructuredTool({
      name: 'get_active_alerts',
      description:
        'Get active alerts: stopped, speeding, fuel low, critical zone violations, or all.',
      schema: z.object({
        type: z
          .enum(['stopped', 'speeding', 'fuel', 'critical_zone', 'all'])
          .default('all'),
      }),
      func: async ({ type }) => {
        const result = await agentQuery.getActiveAlerts(type as AlertType | 'all');
        return JSON.stringify(result, null, 2);
      },
    }),
  ];
}
