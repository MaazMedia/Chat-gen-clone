#!/usr/bin/env node

/**
 * Test script to verify ADK error handling implementation
 * Run this script to test the error handling without starting the full application
 */

import { createClient, AdkApiClient, ADKServerError } from '../src/providers/client.js';

async function testErrorHandling() {
  console.log('🧪 Testing ADK Error Handling Implementation...\n');

  // Test 1: Network Error (server not running)
  console.log('1. Testing with server not running...');
  try {
    const client = createClient('http://localhost:8080', undefined);
    const apiClient = new AdkApiClient(client);
    
    await apiClient.getAgents();
    console.log('❌ Expected error but got success');
  } catch (error) {
    if (error instanceof ADKServerError) {
      console.log('✅ Caught ADKServerError:', error.code);
      console.log('   Message:', error.message);
      console.log('   Status:', error.statusCode);
    } else {
      console.log('⚠️  Caught different error type:', error.constructor.name);
    }
  }

  // Test 2: Invalid URL
  console.log('\n2. Testing with invalid URL...');
  try {
    const client = createClient('http://invalid-url-12345', undefined);
    const apiClient = new AdkApiClient(client);
    
    await apiClient.getAgents();
    console.log('❌ Expected error but got success');
  } catch (error) {
    if (error instanceof ADKServerError) {
      console.log('✅ Caught ADKServerError:', error.code);
      console.log('   Message:', error.message);
    } else {
      console.log('⚠️  Caught different error type:', error.constructor.name);
    }
  }

  console.log('\n✅ Error handling test completed!');
  console.log('\n📋 What to test manually:');
  console.log('1. Start the frontend (npm run dev)');
  console.log('2. Keep ADK server stopped');
  console.log('3. Open browser and check for toast notifications');
  console.log('4. Verify no console crashes');
  console.log('5. Start ADK server and test retry functionality');
}

// Run test if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  testErrorHandling().catch(console.error);
}

export { testErrorHandling };