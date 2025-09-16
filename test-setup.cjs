#!/usr/bin/env node

/**
 * Simple test script to verify the ADK Chat UI setup
 */

const fs = require("fs");
const path = require("path");

console.log("🧪 Testing ADK Chat UI Setup...\n");

// Test 1: Check required files exist
const requiredFiles = [
  "package.json",
  "src/app/api/[..._path]/route.ts",
  "src/providers/client.ts",
  "src/providers/Stream.tsx",
  "src/providers/Thread.tsx",
  "src/components/agent-picker.tsx",
  "src/components/thread/index.tsx",
  "adk-server/package.json",
  "adk-server/src/server.ts",
  "adk-server/src/agents/math-assistant.ts",
  "adk-server/src/agents/web-researcher.ts",
  "docker-compose.yml",
  "Dockerfile",
  "adk-server/Dockerfile",
  "init-db.sql",
];

console.log("📁 Checking required files...");
let missingFiles = [];
for (const file of requiredFiles) {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    missingFiles.push(file);
  }
}

// Test 2: Check package.json configurations
console.log("\n📦 Checking package configurations...");
try {
  const frontendPkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  console.log(
    `✅ Frontend package.json: ${frontendPkg.name} v${frontendPkg.version}`,
  );

  const backendPkg = JSON.parse(
    fs.readFileSync("adk-server/package.json", "utf8"),
  );
  console.log(
    `✅ Backend package.json: ${backendPkg.name} v${backendPkg.version}`,
  );
} catch (error) {
  console.log(`❌ Package configuration error: ${error.message}`);
}

// Test 3: Check build outputs
console.log("\n🔨 Checking build outputs...");
if (fs.existsSync(".next")) {
  console.log("✅ Next.js build output (.next) exists");
} else {
  console.log("❌ Next.js build output missing - run: npm run build");
}

if (fs.existsSync("adk-server/dist")) {
  console.log("✅ ADK server build output (dist) exists");
} else {
  console.log(
    "❌ ADK server build output missing - run: cd adk-server && npm run build",
  );
}

// Test 4: Check critical file contents
console.log("\n🔍 Checking critical file contents...");

// Check API route
try {
  const apiRoute = fs.readFileSync("src/app/api/[..._path]/route.ts", "utf8");
  if (
    apiRoute.includes("handleADKRequest") &&
    apiRoute.includes("getADKInstance")
  ) {
    console.log("✅ API route configured for Local ADK");
  } else {
    console.log("❌ API route missing Local ADK configuration");
  }
} catch (error) {
  console.log("❌ Cannot read API route file");
}

// Check client provider
try {
  const client = fs.readFileSync("src/providers/client.ts", "utf8");
  if (client.includes("AdkApiClient") && client.includes("getAgents")) {
    console.log("✅ ADK client provider configured");
  } else {
    console.log("❌ ADK client provider missing configuration");
  }
} catch (error) {
  console.log("❌ Cannot read client provider file");
}

// Test 5: Summary
console.log("\n📋 Test Summary:");
if (missingFiles.length === 0) {
  console.log("✅ All required files present");
  console.log("✅ Setup appears complete!");

  console.log("\n🚀 Next steps:");
  console.log("1. Set up PostgreSQL database");
  console.log("2. Copy .env.example files and configure");
  console.log("3. Run: cd adk-server && npm run dev");
  console.log("4. Run: npm run dev (in another terminal)");
  console.log("5. Or use Docker: docker-compose up --build");
} else {
  console.log(`❌ ${missingFiles.length} files missing:`);
  missingFiles.forEach((file) => console.log(`   - ${file}`));
}

console.log("\n🎉 Test completed!");
