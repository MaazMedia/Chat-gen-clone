import * as dotenv from "dotenv";
import Database from "better-sqlite3";
import * as path from "path";

dotenv.config();

export class SQLiteDatabaseManager {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(process.cwd(), "adk_chat.db");
    this.db = new Database(dbPath || defaultPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    console.log("Initializing SQLite database schema...");

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

    console.log("SQLite database schema initialized");
  }

  // Thread operations
  async createThread(agentId: string, title?: string): Promise<string> {
    console.log(`🆕 [SQLiteManager] createThread called with:`);
    console.log(`🤖 [SQLiteManager] Agent ID: ${agentId}`);
    console.log(
      `📝 [SQLiteManager] Title: ${title || 'No title (will use "New Chat")'}`,
    );

    const id = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🆔 [SQLiteManager] Generated thread ID: ${id}`);

    const finalTitle = title || "New Chat";
    console.log(`📝 [SQLiteManager] Final title: ${finalTitle}`);

    const stmt = this.db.prepare(`
      INSERT INTO threads (id, agent_id, title)
      VALUES (?, ?, ?)
    `);

    console.log(
      `💾 [SQLiteManager] Executing INSERT with values: [${id}, ${agentId}, ${finalTitle}]`,
    );

    try {
      const result = stmt.run(id, agentId, finalTitle);
      console.log(`✅ [SQLiteManager] Thread inserted successfully:`, result);
      console.log(
        `📊 [SQLiteManager] Changes: ${result.changes}, Last insert rowid: ${result.lastInsertRowid}`,
      );

      // Verify the thread was created
      const verifyStmt = this.db.prepare("SELECT * FROM threads WHERE id = ?");
      const createdThread = verifyStmt.get(id);
      console.log(
        `🔍 [SQLiteManager] Verification - created thread:`,
        createdThread,
      );

      return id;
    } catch (error) {
      console.error(`❌ [SQLiteManager] Error creating thread:`, error);
      throw error;
    }
  }

  async getThreads(agentId?: string): Promise<any[]> {
    console.log(
      `🔍 [SQLiteManager] getThreads called with agentId: ${agentId}`,
    );

    // Only return threads that have at least one message
    let query = `
      SELECT DISTINCT t.* 
      FROM threads t 
      INNER JOIN messages m ON t.id = m.thread_id
    `;
    let params: any[] = [];

    if (agentId) {
      query += " WHERE t.agent_id = ?";
      params.push(agentId);
    }

    query += " ORDER BY t.updated_at DESC";

    console.log(`📝 [SQLiteManager] Executing query: ${query}`);
    console.log(`📋 [SQLiteManager] Query params:`, params);

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params);

    console.log(`📊 [SQLiteManager] Query returned ${results.length} threads`);

    if (results.length > 0) {
      console.log(`🗂️  [SQLiteManager] Thread details:`, results);
    } else {
      console.log(`📭 [SQLiteManager] No threads with messages found`);

      // Let's also check how many total threads exist (without message filter)
      const allThreadsQuery = agentId
        ? "SELECT * FROM threads WHERE agent_id = ? ORDER BY updated_at DESC"
        : "SELECT * FROM threads ORDER BY updated_at DESC";
      const allThreadsStmt = this.db.prepare(allThreadsQuery);
      const allThreads = agentId
        ? allThreadsStmt.all(agentId)
        : allThreadsStmt.all();
      console.log(
        `📂 [SQLiteManager] Total threads in DB (including empty): ${allThreads.length}`,
      );

      if (allThreads.length > 0) {
        console.log(
          `📄 [SQLiteManager] All thread IDs:`,
          allThreads.map((t: any) => t.id),
        );
      }

      // Let's also check how many messages exist
      const messagesQuery =
        "SELECT thread_id, COUNT(*) as message_count FROM messages GROUP BY thread_id";
      const messagesStmt = this.db.prepare(messagesQuery);
      const messageCounts = messagesStmt.all();
      console.log(
        `💬 [SQLiteManager] Message counts per thread:`,
        messageCounts,
      );
    }

    return results;
  }

  async getThread(threadId: string): Promise<any | null> {
    const stmt = this.db.prepare("SELECT * FROM threads WHERE id = ?");
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

  async deleteThread(threadId: string): Promise<void> {
    console.log(`💾 Database: Attempting to delete thread ${threadId}`);

    // Check if thread exists first
    const checkStmt = this.db.prepare("SELECT id FROM threads WHERE id = ?");
    const existingThread = checkStmt.get(threadId);

    if (!existingThread) {
      console.log(`⚠️  Database: Thread ${threadId} not found`);
      throw new Error(`Thread ${threadId} not found`);
    }

    console.log(
      `📋 Database: Thread ${threadId} exists, proceeding with deletion`,
    );

    // Delete thread and all associated messages (CASCADE will handle messages)
    const stmt = this.db.prepare("DELETE FROM threads WHERE id = ?");
    const result = stmt.run(threadId);

    console.log(
      `✅ Database: Thread ${threadId} deleted successfully. Changes: ${result.changes}`,
    );
  }

  // Message operations
  async addMessage(
    threadId: string,
    role: string,
    content: string,
  ): Promise<string> {
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
      tool_calls: JSON.parse(msg.tool_calls).filter((tc: any) => tc !== null),
    }));
  }

  // Tool call operations
  async addToolCall(
    messageId: string,
    toolName: string,
    toolInput: any,
  ): Promise<string> {
    const id = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const stmt = this.db.prepare(`
      INSERT INTO tool_calls (id, message_id, tool_name, tool_input)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, messageId, toolName, JSON.stringify(toolInput));
    return id;
  }

  async updateToolCall(
    toolCallId: string,
    output: any,
    status: string = "completed",
  ): Promise<void> {
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
      const stmt = this.db.prepare("SELECT 1 as test");
      const result = stmt.get() as { test: number } | undefined;
      return result?.test === 1;
    } catch (error) {
      console.error("Database connection test failed:", error);
      return false;
    }
  }

  // Clean up
  close(): void {
    this.db.close();
  }
}
