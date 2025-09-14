// Quick test script for SQLite database integration
import { SQLiteDatabaseManager } from './database/sqlite-manager';

async function testDatabase() {
  console.log('🧪 Testing SQLite Database Integration...\n');
  
  const dbManager = new SQLiteDatabaseManager('./test_adk_chat.db');
  
  try {
    // Test 1: Connection
    console.log('1. Testing database connection...');
    const isConnected = await dbManager.testConnection();
    console.log(isConnected ? '✅ Database connected' : '❌ Connection failed');
    
    if (!isConnected) {
      return;
    }
    
    // Test 2: Create thread
    console.log('\n2. Testing thread creation...');
    const threadId = await dbManager.createThread('math-assistant', 'Test Chat');
    console.log(`✅ Created thread: ${threadId}`);
    
    // Test 3: Add messages
    console.log('\n3. Testing message storage...');
    const userMsgId = await dbManager.addMessage(threadId, 'user', 'Calculate 5 + 3');
    console.log(`✅ Added user message: ${userMsgId}`);
    
    const assistantMsgId = await dbManager.addMessage(threadId, 'assistant', 'The result is 8');
    console.log(`✅ Added assistant message: ${assistantMsgId}`);
    
    // Test 4: Add tool call
    console.log('\n4. Testing tool call storage...');
    const toolCallId = await dbManager.addToolCall(
      assistantMsgId, 
      'calculator', 
      { operation: 'add', a: 5, b: 3 }
    );
    console.log(`✅ Added tool call: ${toolCallId}`);
    
    await dbManager.updateToolCall(toolCallId, { result: 8 });
    console.log(`✅ Updated tool call with result`);
    
    // Test 5: Retrieve data
    console.log('\n5. Testing data retrieval...');
    const threads = await dbManager.getThreads('math-assistant');
    console.log(`✅ Retrieved ${threads.length} threads for math-assistant`);
    
    const messages = await dbManager.getMessages(threadId);
    console.log(`✅ Retrieved ${messages.length} messages for thread`);
    console.log('Messages:', messages.map(m => ({ role: m.role, content: m.content })));
    
    // Test 6: Test persistence (simulate restart)
    console.log('\n6. Testing persistence (new connection)...');
    const dbManager2 = new SQLiteDatabaseManager('./test_adk_chat.db');
    const threadsAfterRestart = await dbManager2.getThreads();
    console.log(`✅ After restart: ${threadsAfterRestart.length} threads found`);
    
    console.log('\n🎉 All database tests passed!');
    
    // Cleanup
    dbManager.close();
    dbManager2.close();
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

testDatabase();