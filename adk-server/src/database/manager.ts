import { Pool } from "pg";

export class DatabaseManager {
  constructor(private db: Pool) {}

  async initialize() {
    // Create threads table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tool_calls table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS tool_calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        tool_name VARCHAR(255) NOT NULL,
        tool_input JSONB NOT NULL,
        tool_output JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE
      )
    `);

    // Create attachments table
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        content_type VARCHAR(255) NOT NULL,
        file_path VARCHAR(1000) NOT NULL,
        file_size BIGINT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_message_id ON tool_calls(message_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
      CREATE INDEX IF NOT EXISTS idx_threads_agent_id ON threads(agent_id);
      CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at);
    `);

    console.log("Database schema initialized successfully");
  }

  async createThread(agentId: string, title?: string) {
    if (!title) {
      title = "New Chat";
    }
    const result = await this.db.query(
      "INSERT INTO threads (agent_id, title) VALUES ($1, $2) RETURNING *",
      [agentId, title],
    );
    return result.rows[0];
  }

  async getThreads(agentId?: string, limit: number = 50) {
    let query = "SELECT * FROM threads";
    let params: any[] = [];

    if (agentId) {
      query += " WHERE agent_id = $1";
      params.push(agentId);
    }

    query += " ORDER BY updated_at DESC LIMIT $" + (params.length + 1);
    params.push(limit);

    const result = await this.db.query(query, params);
    return result.rows;
  }

  async getThread(threadId: string) {
    const result = await this.db.query("SELECT * FROM threads WHERE id = $1", [
      threadId,
    ]);
    return result.rows[0];
  }

  async addMessage(
    threadId: string,
    role: string,
    content: string,
    metadata: any = {},
  ) {
    const result = await this.db.query(
      "INSERT INTO messages (thread_id, role, content, metadata) VALUES ($1, $2, $3, $4) RETURNING *",
      [threadId, role, content, JSON.stringify(metadata)],
    );

    // Update thread timestamp
    await this.db.query(
      "UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [threadId],
    );

    return result.rows[0];
  }

  async getMessages(threadId: string, limit: number = 100) {
    const result = await this.db.query(
      "SELECT * FROM messages WHERE thread_id = $1 ORDER BY created_at ASC LIMIT $2",
      [threadId, limit],
    );
    return result.rows;
  }

  async addToolCall(messageId: string, toolName: string, toolInput: any) {
    const result = await this.db.query(
      "INSERT INTO tool_calls (message_id, tool_name, tool_input) VALUES ($1, $2, $3) RETURNING *",
      [messageId, toolName, JSON.stringify(toolInput)],
    );
    return result.rows[0];
  }

  async updateToolCall(
    toolCallId: string,
    toolOutput: any,
    status: string = "completed",
  ) {
    const result = await this.db.query(
      "UPDATE tool_calls SET tool_output = $1, status = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *",
      [JSON.stringify(toolOutput), status, toolCallId],
    );
    return result.rows[0];
  }

  async getToolCalls(messageId: string) {
    const result = await this.db.query(
      "SELECT * FROM tool_calls WHERE message_id = $1 ORDER BY created_at ASC",
      [messageId],
    );
    return result.rows;
  }
}
