import * as dotenv from 'dotenv';
import Database from 'better-sqlite3';
import * as path from 'path';

dotenv.config();

export class SQLiteDatabaseManager {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(process.cwd(), 'adk_chat.db');
    this.db = new Database(dbPath || defaultPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    console.log('Initializing SQLite database schema...');
    
    // Create threads table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        title TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES threads (id) ON DELETE CASCADE
      )
    `);

    // Create tool_calls table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        tool_input TEXT NOT NULL,
        tool_output TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
      )
    `);

    // Create attachments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER,
        file_path TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
      )
    `);

    console.log('SQLite database schema initialized');
  }

  // Thread operations
  async createThread(agentId: string, title?: string): Promise<string> {
    const id = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stmt = this.db.prepare(`
      INSERT INTO threads (id, agent_id, title)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(id, agentId, title || 'New Chat');
    return id;
  }

  async getThreads(agentId?: string): Promise<any[]> {
    let query = 'SELECT * FROM threads';
    let params: any[] = [];
    
    if (agentId) {
      query += ' WHERE agent_id = ?';
      params.push(agentId);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  async getThread(threadId: string): Promise<any | null> {
    const stmt = this.db.prepare('SELECT * FROM threads WHERE id = ?');
    return stmt.get(threadId) || null;
  }

  async updateThreadTimestamp(threadId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE threads 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(threadId);
  }

  // Message operations
  async addMessage(threadId: string, role: string, content: string): Promise<string> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, thread_id, role, content)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, threadId, role, content);
    await this.updateThreadTimestamp(threadId);
    return id;
  }

  async getMessages(threadId: string): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT m.*, 
             json_group_array(
               CASE WHEN tc.id IS NOT NULL 
                    THEN json_object(
                      'id', tc.id,
                      'tool_name', tc.tool_name,
                      'tool_input', tc.tool_input,
                      'tool_output', tc.tool_output,
                      'status', tc.status
                    )
                    ELSE NULL END
             ) as tool_calls
      FROM messages m
      LEFT JOIN tool_calls tc ON m.id = tc.message_id
      WHERE m.thread_id = ?
      GROUP BY m.id
      ORDER BY m.created_at ASC
    `);
    
    const messages = stmt.all(threadId);
    
    // Parse tool_calls JSON and filter out nulls
    return messages.map((msg: any) => ({
      ...msg,
      tool_calls: JSON.parse(msg.tool_calls).filter((tc: any) => tc !== null)
    }));
  }

  // Tool call operations
  async addToolCall(messageId: string, toolName: string, toolInput: any): Promise<string> {
    const id = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stmt = this.db.prepare(`
      INSERT INTO tool_calls (id, message_id, tool_name, tool_input)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, messageId, toolName, JSON.stringify(toolInput));
    return id;
  }

  async updateToolCall(toolCallId: string, output: any, status: string = 'completed'): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE tool_calls 
      SET tool_output = ?, status = ?
      WHERE id = ?
    `);
    
    stmt.run(JSON.stringify(output), status, toolCallId);
  }

  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      const stmt = this.db.prepare('SELECT 1 as test');
      const result = stmt.get() as { test: number } | undefined;
      return result?.test === 1;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  // Clean up
  close(): void {
    this.db.close();
  }
}