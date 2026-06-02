import { describe, it, expect, vi } from 'vitest';
import { createAgentTools } from '../agent-tools.factory.js';

describe('createAgentTools', () => {
  it('creates three operational tools', () => {
    const agentQuery = {
      queryVehicleStatus: vi.fn(),
      queryTelemetryHistory: vi.fn(),
      getActiveAlerts: vi.fn(),
    };

    const tools = createAgentTools(agentQuery);
    expect(tools.map((t) => t.name)).toEqual([
      'query_vehicle_status',
      'query_telemetry_history',
      'get_active_alerts',
    ]);
  });

  it('delegates query_vehicle_status to agent query port', async () => {
    const agentQuery = {
      queryVehicleStatus: vi.fn().mockResolvedValue([{ plate: 'ABC-123' }]),
      queryTelemetryHistory: vi.fn(),
      getActiveAlerts: vi.fn(),
    };

    const tool = createAgentTools(agentQuery)[0];
    const output = await tool.invoke({ sql_filter: 'in_critical_zone' });
    expect(agentQuery.queryVehicleStatus).toHaveBeenCalledWith('in_critical_zone');
    expect(output).toContain('ABC-123');
  });
});
