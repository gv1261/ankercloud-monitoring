-- AnkerCloud Monitoring Database Schema
-- PostgreSQL with TimescaleDB extension

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Create schema for better organization
CREATE SCHEMA IF NOT EXISTS ankercloud;
SET search_path TO ankercloud, public;

-- =====================================================
-- USERS AND AUTHENTICATION
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user', -- admin, user, viewer
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    last_used TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- =====================================================
-- RESOURCES (Servers, Websites, Networks)
-- =====================================================

CREATE TYPE resource_type AS ENUM ('server', 'website', 'network', 'database');
CREATE TYPE resource_status AS ENUM ('online', 'offline', 'warning', 'critical', 'unknown');

CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type resource_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    status resource_status DEFAULT 'unknown',
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    UNIQUE(user_id, name, type)
);

CREATE INDEX idx_resources_user ON resources(user_id);
CREATE INDEX idx_resources_type ON resources(type);
CREATE INDEX idx_resources_status ON resources(status);
CREATE INDEX idx_resources_tags ON resources USING gin(tags);

-- Server-specific information
CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id UUID UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
    hostname VARCHAR(255),
    ip_address INET,
    os_type VARCHAR(50), -- linux, windows, macos
    os_version VARCHAR(255),
    cpu_cores INTEGER,
    total_memory_mb BIGINT,
    total_disk_mb BIGINT,
    agent_version VARCHAR(50),
    agent_last_seen TIMESTAMPTZ
);

-- Website monitoring configuration
CREATE TABLE websites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id UUID UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    method VARCHAR(10) DEFAULT 'GET',
    expected_status_code INTEGER DEFAULT 200,
    timeout_seconds INTEGER DEFAULT 30,
    check_interval_seconds INTEGER DEFAULT 300, -- 5 minutes
    headers JSONB DEFAULT '{}'::jsonb,
    body TEXT,
    ssl_check BOOLEAN DEFAULT true,
    keyword_check TEXT
);

-- Network monitoring configuration
CREATE TABLE network_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id UUID UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
    check_type VARCHAR(50) NOT NULL, -- ping, port, traceroute
    target_host VARCHAR(255) NOT NULL,
    target_port INTEGER,
    check_interval_seconds INTEGER DEFAULT 60,
    timeout_seconds INTEGER DEFAULT 10
);

-- Database monitoring configuration
CREATE TABLE database_monitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id UUID UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
    db_type VARCHAR(50) NOT NULL, -- postgresql, mysql, mongodb, sqlserver
    connection_string TEXT, -- encrypted
    check_interval_seconds INTEGER DEFAULT 300,
    custom_queries JSONB DEFAULT '[]'::jsonb
);

-- =====================================================
-- ALERT POLICIES AND NOTIFICATIONS
-- =====================================================

CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE alert_state AS ENUM ('active', 'resolved', 'acknowledged');

CREATE TABLE alert_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    condition VARCHAR(10) NOT NULL, -- gt, lt, eq, ne, gte, lte
    threshold NUMERIC,
    duration_seconds INTEGER DEFAULT 300, -- How long condition must be true
    severity alert_severity DEFAULT 'warning',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_policies_resource ON alert_policies(resource_id);

CREATE TABLE notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- email, webhook, sms, slack
    configuration JSONB NOT NULL, -- encrypted sensitive data
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_policy_channels (
    alert_policy_id UUID REFERENCES alert_policies(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES notification_channels(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_policy_id, channel_id)
);

CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_policy_id UUID REFERENCES alert_policies(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    state alert_state DEFAULT 'active',
    severity alert_severity,
    triggered_value NUMERIC,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    notes TEXT
);

CREATE INDEX idx_incidents_resource ON incidents(resource_id);
CREATE INDEX idx_incidents_state ON incidents(state);
CREATE INDEX idx_incidents_triggered ON incidents(triggered_at DESC);

CREATE TABLE incident_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- triggered, acknowledged, resolved, note_added
    performed_by UUID REFERENCES users(id),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- METRICS TABLES (TimescaleDB)
-- =====================================================

-- Server metrics
CREATE TABLE server_metrics (
    time TIMESTAMPTZ NOT NULL,
    resource_id UUID NOT NULL,
    cpu_usage_percent NUMERIC(5,2),
    memory_used_mb BIGINT,
    memory_total_mb BIGINT,
    memory_usage_percent NUMERIC(5,2),
    disk_used_mb BIGINT,
    disk_total_mb BIGINT,
    disk_usage_percent NUMERIC(5,2),
    network_in_bytes BIGINT,
    network_out_bytes BIGINT,
    process_count INTEGER,
    load_avg_1m NUMERIC(6,2),
    load_avg_5m NUMERIC(6,2),
    load_avg_15m NUMERIC(6,2),
    uptime_seconds BIGINT
);

SELECT create_hypertable('server_metrics', 'time');
CREATE INDEX idx_server_metrics_resource ON server_metrics(resource_id, time DESC);

-- Process metrics
CREATE TABLE process_metrics (
    time TIMESTAMPTZ NOT NULL,
    resource_id UUID NOT NULL,
    process_name VARCHAR(255),
    pid INTEGER,
    cpu_percent NUMERIC(5,2),
    memory_mb BIGINT,
    status VARCHAR(50)
);

SELECT create_hypertable('process_metrics', 'time');
CREATE INDEX idx_process_metrics_resource ON process_metrics(resource_id, time DESC);

-- Service metrics (for Windows services, systemd units)
CREATE TABLE service_metrics (
    time TIMESTAMPTZ NOT NULL,
    resource_id UUID NOT NULL,
    service_name VARCHAR(255),
    status VARCHAR(50), -- running, stopped, failed
    startup_type VARCHAR(50)
);

SELECT create_hypertable('service_metrics', 'time');
CREATE INDEX idx_service_metrics_resource ON service_metrics(resource_id, time DESC);

-- Website metrics
CREATE TABLE website_metrics (
    time TIMESTAMPTZ NOT NULL,
    resource_id UUID NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    dns_time_ms INTEGER,
    connect_time_ms INTEGER,
    tls_time_ms INTEGER,
    ttfb_ms INTEGER, -- Time to first byte
    total_time_ms INTEGER,
    content_size_bytes BIGINT,
    is_available BOOLEAN,
    error_message TEXT,
    location VARCHAR(100) -- monitoring location
);

SELECT create_hypertable('website_metrics', 'time');
CREATE INDEX idx_website_metrics_resource ON website_metrics(resource_id, time DESC);

-- Network metrics
CREATE TABLE network_metrics (
    time TIMESTAMPTZ NOT NULL,
    resource_id UUID NOT NULL,
    check_type VARCHAR(50),
    latency_ms NUMERIC(8,2),
    packet_loss_percent NUMERIC(5,2),
    is_available BOOLEAN,
    hop_count INTEGER,
    error_message TEXT
);

SELECT create_hypertable('network_metrics', 'time');
CREATE INDEX idx_network_metrics_resource ON network_metrics(resource_id, time DESC);

-- Database metrics
CREATE TABLE database_metrics (
    time TIMESTAMPTZ NOT NULL,
    resource_id UUID NOT NULL,
    connections_active INTEGER,
    connections_idle INTEGER,
    queries_per_second NUMERIC(10,2),
    slow_queries INTEGER,
    replication_lag_seconds NUMERIC(10,2),
    database_size_mb BIGINT,
    is_available BOOLEAN,
    custom_metrics JSONB
);

SELECT create_hypertable('database_metrics', 'time');
CREATE INDEX idx_database_metrics_resource ON database_metrics(resource_id, time DESC);

-- IIS specific metrics for Windows
CREATE TABLE iis_metrics (
    time TIMESTAMPTZ NOT NULL,
    resource_id UUID NOT NULL,
    site_name VARCHAR(255),
    app_pool_name VARCHAR(255),
    requests_per_second NUMERIC(10,2),
    current_connections INTEGER,
    bytes_sent_per_second BIGINT,
    bytes_received_per_second BIGINT,
    errors_per_second NUMERIC(10,2),
    status VARCHAR(50)
);

SELECT create_hypertable('iis_metrics', 'time');
CREATE INDEX idx_iis_metrics_resource ON iis_metrics(resource_id, time DESC);

-- =====================================================
-- AUDIT AND SYSTEM TABLES
-- =====================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- =====================================================
-- DATA RETENTION POLICIES
-- =====================================================

-- Keep raw metrics for 7 days
SELECT add_retention_policy('server_metrics', INTERVAL '7 days');
SELECT add_retention_policy('process_metrics', INTERVAL '7 days');
SELECT add_retention_policy('service_metrics', INTERVAL '7 days');
SELECT add_retention_policy('website_metrics', INTERVAL '7 days');
SELECT add_retention_policy('network_metrics', INTERVAL '7 days');
SELECT add_retention_policy('database_metrics', INTERVAL '7 days');
SELECT add_retention_policy('iis_metrics', INTERVAL '7 days');

-- =====================================================
-- CONTINUOUS AGGREGATES FOR PERFORMANCE
-- =====================================================

-- 5-minute aggregates for server metrics
CREATE MATERIALIZED VIEW server_metrics_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    resource_id,
    AVG(cpu_usage_percent) as avg_cpu,
    MAX(cpu_usage_percent) as max_cpu,
    AVG(memory_usage_percent) as avg_memory,
    MAX(memory_usage_percent) as max_memory,
    AVG(disk_usage_percent) as avg_disk,
    MAX(network_in_bytes) as max_network_in,
    MAX(network_out_bytes) as max_network_out
FROM server_metrics
GROUP BY bucket, resource_id;

-- 1-hour aggregates for server metrics
CREATE MATERIALIZED VIEW server_metrics_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    resource_id,
    AVG(cpu_usage_percent) as avg_cpu,
    MAX(cpu_usage_percent) as max_cpu,
    MIN(cpu_usage_percent) as min_cpu,
    AVG(memory_usage_percent) as avg_memory,
    MAX(memory_usage_percent) as max_memory,
    AVG(disk_usage_percent) as avg_disk
FROM server_metrics
GROUP BY bucket, resource_id;

-- Website availability aggregates
CREATE MATERIALIZED VIEW website_availability_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    resource_id,
    COUNT(*) as total_checks,
    SUM(CASE WHEN is_available THEN 1 ELSE 0 END) as successful_checks,
    (SUM(CASE WHEN is_available THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC * 100) as availability_percent,
    AVG(response_time_ms) as avg_response_time,
    MAX(response_time_ms) as max_response_time,
    MIN(response_time_ms) as min_response_time
FROM website_metrics
GROUP BY bucket, resource_id;

-- Add refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('server_metrics_5m',
    start_offset => INTERVAL '10 minutes',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '5 minutes');

SELECT add_continuous_aggregate_policy('server_metrics_1h',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('website_availability_1h',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get resource status based on recent metrics
CREATE OR REPLACE FUNCTION get_resource_status(p_resource_id UUID)
RETURNS resource_status AS $$
DECLARE
    v_status resource_status;
    v_recent_metric RECORD;
BEGIN
    -- Check if resource has recent data (within 5 minutes)
    SELECT * INTO v_recent_metric
    FROM server_metrics
    WHERE resource_id = p_resource_id
    AND time > NOW() - INTERVAL '5 minutes'
    ORDER BY time DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN 'unknown';
    END IF;

    -- Simple status logic (can be enhanced)
    IF v_recent_metric.cpu_usage_percent > 90 OR
       v_recent_metric.memory_usage_percent > 90 OR
       v_recent_metric.disk_usage_percent > 90 THEN
        RETURN 'critical';
    ELSIF v_recent_metric.cpu_usage_percent > 75 OR
          v_recent_metric.memory_usage_percent > 75 OR
          v_recent_metric.disk_usage_percent > 75 THEN
        RETURN 'warning';
    ELSE
        RETURN 'online';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_alert_policies_updated_at BEFORE UPDATE ON alert_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
