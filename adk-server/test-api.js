// Simple API test script to verify ADK server functionality
const http = require('http');

async function testADKServer() {
  console.log('🧪 Testing ADK Server API Endpoints...\n');
  
  const baseUrl = 'http://localhost:8080';
  
  // Helper function to make HTTP requests
  function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8080,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  try {
    // Test 1: Get agents
    console.log('1. Testing GET /agents...');
    const agentsResponse = await makeRequest('/agents');
    if (agentsResponse.status === 200) {
      console.log(`✅ Found ${agentsResponse.data.agents.length} agents:`);
      agentsResponse.data.agents.forEach(agent => {
        console.log(`   - ${agent.id}: ${agent.name} (${agent.tools.length} tools)`);
      });
    } else {
      console.log(`❌ Failed: ${agentsResponse.status}`);
      return;
    }

    // Test 2: Create thread
    console.log('\n2. Testing POST /threads...');
    const threadResponse = await makeRequest('/threads', 'POST', {
      agent_id: 'math-assistant',
      title: 'Test Conversation'
    });
    
    if (threadResponse.status === 201) {
      const threadId = threadResponse.data.id;
      console.log(`✅ Created thread: ${threadId}`);

      // Test 3: Send message
      console.log('\n3. Testing POST /threads/{id}/messages...');
      const messageResponse = await makeRequest(`/threads/${threadId}/messages`, 'POST', {
        message: 'Calculate 15 * 23'
      });

      if (messageResponse.status === 200) {
        console.log(`✅ Sent message, got response:`);
        console.log(`   Role: ${messageResponse.data.role}`);
        console.log(`   Content: ${messageResponse.data.content}`);
        console.log(`   Tool calls: ${messageResponse.data.tool_calls?.length || 0}`);
      } else {
        console.log(`❌ Message failed: ${messageResponse.status}`);
      }

      // Test 4: Get messages
      console.log('\n4. Testing GET /threads/{id}/messages...');
      const messagesResponse = await makeRequest(`/threads/${threadId}/messages`);
      
      if (messagesResponse.status === 200) {
        console.log(`✅ Retrieved ${messagesResponse.data.messages.length} messages`);
        messagesResponse.data.messages.forEach((msg, i) => {
          console.log(`   ${i+1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
        });
      } else {
        console.log(`❌ Get messages failed: ${messagesResponse.status}`);
      }

    } else {
      console.log(`❌ Thread creation failed: ${threadResponse.status}`);
    }

    // Test 5: Get threads
    console.log('\n5. Testing GET /threads...');
    const threadsResponse = await makeRequest('/threads');
    if (threadsResponse.status === 200) {
      console.log(`✅ Found ${threadsResponse.data.threads.length} total threads`);
    } else {
      console.log(`❌ Get threads failed: ${threadsResponse.status}`);
    }

    console.log('\n🎉 ADK Server API tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the ADK server is running on http://localhost:8080');
    console.log('   Start it with: npm run dev:sqlite');
  }
}

testADKServer();