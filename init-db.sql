-- Initialize the ADK Chat database
-- This script sets up the basic schema and any initial data

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The actual tables will be created by the ADK server when it starts
-- This is just to ensure the database is properly set up

-- Create a simple health check table
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO health_check (created_at) VALUES (CURRENT_TIMESTAMP);