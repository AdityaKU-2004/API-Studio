import { db, ApiStudioDatabase } from '../database/database';
import {
  SavedProtocolConfig,
  WebSocketMessageTemplate,
  SavedSseEventMetadata,
} from '../types';

export class ProtocolConfigRepository {
  constructor(private database: ApiStudioDatabase = db) {}

  async getAllConfigs(): Promise<SavedProtocolConfig[]> {
    return this.database.protocolConfigs.toArray();
  }

  async getConfigByRequestId(requestId: string): Promise<SavedProtocolConfig | undefined> {
    return this.database.protocolConfigs.where('requestId').equals(requestId).first();
  }

  async saveConfig(config: SavedProtocolConfig): Promise<string> {
    await this.database.protocolConfigs.put(config);
    return config.id;
  }

  async deleteConfig(id: string): Promise<void> {
    await this.database.protocolConfigs.delete(id);
  }

  async getAllWsTemplates(): Promise<WebSocketMessageTemplate[]> {
    const list = await this.database.wsMessageTemplates.toArray();
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async saveWsTemplate(template: WebSocketMessageTemplate): Promise<string> {
    await this.database.wsMessageTemplates.put(template);
    return template.id;
  }

  async deleteWsTemplate(id: string): Promise<void> {
    await this.database.wsMessageTemplates.delete(id);
  }

  async getSseEventLogs(requestId?: string): Promise<SavedSseEventMetadata[]> {
    const list = requestId
      ? await this.database.sseEventLogs.where('requestId').equals(requestId).toArray()
      : await this.database.sseEventLogs.toArray();
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  async saveSseEventLog(meta: SavedSseEventMetadata, maxRetained = 50): Promise<string> {
    await this.database.transaction('rw', this.database.sseEventLogs, async () => {
      await this.database.sseEventLogs.put(meta);
      const count = await this.database.sseEventLogs.count();
      if (count > maxRetained) {
        const excess = count - maxRetained;
        const oldest = await this.database.sseEventLogs
          .orderBy('timestamp')
          .limit(excess)
          .primaryKeys();
        await this.database.sseEventLogs.bulkDelete(oldest);
      }
    });
    return meta.id;
  }
}

export const protocolConfigRepository = new ProtocolConfigRepository();
