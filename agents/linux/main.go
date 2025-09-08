package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
	"gopkg.in/yaml.v2"
)

// Config represents the agent configuration
type Config struct {
	APIEndpoint string `yaml:"api_endpoint"`
	APIKey      string `yaml:"api_key"`
	ResourceID  string `yaml:"resource_id"`
	Interval    int    `yaml:"interval"` // in seconds
	Hostname    string `yaml:"hostname"`
}

// ServerMetrics represents the metrics to send
type ServerMetrics struct {
	ResourceID string    `json:"resourceId"`
	Metrics    Metrics   `json:"metrics"`
	Processes  []Process `json:"processes,omitempty"`
	Services   []Service `json:"services,omitempty"`
	Timestamp  string    `json:"timestamp"`
}

// Metrics contains system metrics
type Metrics struct {
	CPUUsagePercent    float64 `json:"cpuUsagePercent"`
	MemoryUsedMB       uint64  `json:"memoryUsedMb"`
	MemoryTotalMB      uint64  `json:"memoryTotalMb"`
	MemoryUsagePercent float64 `json:"memoryUsagePercent"`
	DiskUsedMB         uint64  `json:"diskUsedMb"`
	DiskTotalMB        uint64  `json:"diskTotalMb"`
	DiskUsagePercent   float64 `json:"diskUsagePercent"`
	NetworkInBytes     uint64  `json:"networkInBytes"`
	NetworkOutBytes    uint64  `json:"networkOutBytes"`
	ProcessCount       int     `json:"processCount"`
	LoadAvg1m          float64 `json:"loadAvg1m"`
	LoadAvg5m          float64 `json:"loadAvg5m"`
	LoadAvg15m         float64 `json:"loadAvg15m"`
	UptimeSeconds      uint64  `json:"uptimeSeconds"`
}

// Process represents a running process
type Process struct {
	Name       string  `json:"name"`
	PID        int32   `json:"pid"`
	CPUPercent float64 `json:"cpuPercent"`
	MemoryMB   uint64  `json:"memoryMb"`
	Status     string  `json:"status"`
}

// Service represents a system service
type Service struct {
	Name        string `json:"name"`
	Status      string `json:"status"`
	StartupType string `json:"startupType,omitempty"`
}

var (
	configFile = flag.String("config", "/etc/ankercloud/agent.yaml", "Path to configuration file")
	debug      = flag.Bool("debug", false, "Enable debug logging")
)

func main() {
	flag.Parse()

	// Load configuration
	config, err := loadConfig(*configFile)
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	if *debug {
		log.Printf("Configuration loaded: %+v", config)
	}

	// Set up signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Create ticker for periodic collection
	ticker := time.NewTicker(time.Duration(config.Interval) * time.Second)
	defer ticker.Stop()

	log.Printf("AnkerCloud Linux Agent started. Reporting every %d seconds to %s", config.Interval, config.APIEndpoint)

	// Initial collection
	collectAndSend(config)

	// Main loop
	for {
		select {
		case <-ticker.C:
			collectAndSend(config)
		case sig := <-sigChan:
			log.Printf("Received signal %v, shutting down...", sig)
			return
		}
	}
}

func loadConfig(path string) (*Config, error) {
	// Check if config file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		// Create default config
		return createDefaultConfig()
	}

	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Set hostname if not specified
	if config.Hostname == "" {
		hostname, _ := os.Hostname()
		config.Hostname = hostname
	}

	return &config, nil
}

func createDefaultConfig() (*Config, error) {
	hostname, _ := os.Hostname()

	config := &Config{
		APIEndpoint: "http://localhost:3001/api/ingest/server",
		APIKey:      os.Getenv("ANKERCLOUD_API_KEY"),
		ResourceID:  os.Getenv("ANKERCLOUD_RESOURCE_ID"),
		Interval:    30,
		Hostname:    hostname,
	}

	if config.APIKey == "" || config.ResourceID == "" {
		return nil, fmt.Errorf("ANKERCLOUD_API_KEY and ANKERCLOUD_RESOURCE_ID environment variables must be set")
	}

	return config, nil
}

func collectAndSend(config *Config) {
	metrics, err := collectMetrics()
	if err != nil {
		log.Printf("Failed to collect metrics: %v", err)
		return
	}

	// Get top processes
	processes := getTopProcesses(5)

	// Get services status (simplified for now)
	services := getServices()

	data := ServerMetrics{
		ResourceID: config.ResourceID,
		Metrics:    *metrics,
		Processes:  processes,
		Services:   services,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
	}

	if err := sendMetrics(config, data); err != nil {
		log.Printf("Failed to send metrics: %v", err)
	} else if *debug {
		log.Printf("Successfully sent metrics")
	}
}

func collectMetrics() (*Metrics, error) {
	metrics := &Metrics{}

	// CPU usage
	cpuPercent, err := cpu.Percent(1*time.Second, false)
	if err == nil && len(cpuPercent) > 0 {
		metrics.CPUUsagePercent = cpuPercent[0]
	}

	// Memory
	vmStat, err := mem.VirtualMemory()
	if err == nil {
		metrics.MemoryUsedMB = vmStat.Used / 1024 / 1024
		metrics.MemoryTotalMB = vmStat.Total / 1024 / 1024
		metrics.MemoryUsagePercent = vmStat.UsedPercent
	}

	// Disk (root partition)
	diskStat, err := disk.Usage("/")
	if err == nil {
		metrics.DiskUsedMB = diskStat.Used / 1024 / 1024
		metrics.DiskTotalMB = diskStat.Total / 1024 / 1024
		metrics.DiskUsagePercent = diskStat.UsedPercent
	}

	// Network
	netIO, err := net.IOCounters(false)
	if err == nil && len(netIO) > 0 {
		metrics.NetworkInBytes = netIO[0].BytesRecv
		metrics.NetworkOutBytes = netIO[0].BytesSent
	}

	// Process count
	pids, err := process.Pids()
	if err == nil {
		metrics.ProcessCount = len(pids)
	}

	// Load average
	loadAvg, err := loadAverage()
	if err == nil {
		metrics.LoadAvg1m = loadAvg[0]
		metrics.LoadAvg5m = loadAvg[1]
		metrics.LoadAvg15m = loadAvg[2]
	}

	// Uptime
	hostInfo, err := host.Info()
	if err == nil {
		metrics.UptimeSeconds = hostInfo.Uptime
	}

	return metrics, nil
}

func loadAverage() ([]float64, error) {
	// Read from /proc/loadavg
	data, err := ioutil.ReadFile("/proc/loadavg")
	if err != nil {
		return []float64{0, 0, 0}, err
	}

	var load1, load5, load15 float64
	fmt.Sscanf(string(data), "%f %f %f", &load1, &load5, &load15)

	return []float64{load1, load5, load15}, nil
}

func getTopProcesses(limit int) []Process {
	var topProcesses []Process

	processes, err := process.Processes()
	if err != nil {
		return topProcesses
	}

	for i, p := range processes {
		if i >= limit {
			break
		}

		name, _ := p.Name()
		cpuPercent, _ := p.CPUPercent()
		memInfo, _ := p.MemoryInfo()
		status, _ := p.Status()

		var memoryMB uint64
		if memInfo != nil {
			memoryMB = memInfo.RSS / 1024 / 1024
		}

		topProcesses = append(topProcesses, Process{
			Name:       name,
			PID:        p.Pid,
			CPUPercent: cpuPercent,
			MemoryMB:   memoryMB,
			Status:     status[0],
		})
	}

	return topProcesses
}

func getServices() []Service {
	// This is a simplified version
	// In production, you would check systemd services
	return []Service{
		{
			Name:   "ankercloud-agent",
			Status: "running",
		},
	}
}

func sendMetrics(config *Config, data ServerMetrics) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal metrics: %w", err)
	}

	req, err := http.NewRequest("POST", config.APIEndpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", config.APIKey)

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return fmt.Errorf("server returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}
