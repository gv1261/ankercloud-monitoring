import axios, { AxiosInstance, AxiosError } from 'axios';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('authToken', token);
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    localStorage.removeItem('authToken');
  }
};

// Load token on initialization
if (typeof window !== 'undefined') {
  const savedToken = localStorage.getItem('authToken');
  if (savedToken) {
    setAuthToken(savedToken);
  }
}

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    config.params = {
      ...config.params,
      _t: Date.now(),
    };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// API methods
export const api = {
  // Auth endpoints
  auth: {
    login: async (email: string, password: string) => {
      const response = await apiClient.post('/auth/login', { email, password });
      if (response.data.token) {
        setAuthToken(response.data.token);
      }
      return response.data;
    },

    register: async (email: string, password: string, fullName: string) => {
      const response = await apiClient.post('/auth/register', { email, password, fullName });
      if (response.data.token) {
        setAuthToken(response.data.token);
      }
      return response.data;
    },

    logout: async () => {
      await apiClient.post('/auth/logout');
      setAuthToken(null);
    },

    verify: async () => {
      const response = await apiClient.get('/auth/verify');
      return response.data;
    },

    createApiKey: async (name: string, permissions?: string[]) => {
      const response = await apiClient.post('/auth/api-keys', { name, permissions });
      return response.data;
    },

    getApiKeys: async () => {
      const response = await apiClient.get('/auth/api-keys');
      return response.data;
    },
  },

  // Resources endpoints
  resources: {
    getAll: async (filters?: { type?: string; status?: string; tags?: string[] }) => {
      const response = await apiClient.get('/resources', { params: filters });
      return response.data;
    },

    getById: async (id: string) => {
      const response = await apiClient.get(`/resources/${id}`);
      return response.data;
    },

    createServer: async (data: any) => {
      const response = await apiClient.post('/resources/servers', data);
      return response.data;
    },

    createWebsite: async (data: any) => {
      const response = await apiClient.post('/resources/websites', data);
      return response.data;
    },

    createNetwork: async (data: any) => {
      const response = await apiClient.post('/resources/networks', data);
      return response.data;
    },

    update: async (id: string, data: any) => {
      const response = await apiClient.put(`/resources/${id}`, data);
      return response.data;
    },

    delete: async (id: string) => {
      const response = await apiClient.delete(`/resources/${id}`);
      return response.data;
    },

    getSummary: async (id: string, period?: string) => {
      const response = await apiClient.get(`/resources/${id}/summary`, { params: { period } });
      return response.data;
    },
  },

  // Metrics endpoints
  metrics: {
    getByResourceId: async (resourceId: string, startTime?: string, endTime?: string, interval?: string) => {
      const response = await apiClient.get(`/metrics/${resourceId}`, {
        params: { startTime, endTime, interval },
      });
      return response.data;
    },

    getLatest: async (resourceIds: string[]) => {
      const response = await apiClient.post('/metrics/latest', { resourceIds });
      return response.data;
    },
  },

  // Alerts endpoints
  alerts: {
    getPolicies: async () => {
      const response = await apiClient.get('/alerts/policies');
      return response.data;
    },

    createPolicy: async (data: any) => {
      const response = await apiClient.post('/alerts/policies', data);
      return response.data;
    },

    deletePolicy: async (id: string) => {
      const response = await apiClient.delete(`/alerts/policies/${id}`);
      return response.data;
    },

    getChannels: async () => {
      const response = await apiClient.get('/alerts/channels');
      return response.data;
    },

    createChannel: async (data: any) => {
      const response = await apiClient.post('/alerts/channels', data);
      return response.data;
    },

    getIncidents: async (filters?: { state?: string; severity?: string; resourceId?: string }) => {
      const response = await apiClient.get('/alerts/incidents', { params: filters });
      return response.data;
    },

    acknowledgeIncident: async (id: string, notes?: string) => {
      const response = await apiClient.post(`/alerts/incidents/${id}/acknowledge`, { notes });
      return response.data;
    },

    resolveIncident: async (id: string, notes?: string) => {
      const response = await apiClient.post(`/alerts/incidents/${id}/resolve`, { notes });
      return response.data;
    },
  },

  // Health check
  health: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

// WebSocket connection for real-time updates
export class RealtimeConnection {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, (data: any) => void> = new Map();

  connect(token: string) {
    const wsUrl = API_BASE_URL.replace('http', 'ws').replace('/api', '/ws');

    this.ws = new WebSocket(`${wsUrl}/metrics`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      // Authenticate
      this.send({ type: 'auth', token });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'metric' && data.resourceId) {
          const callback = this.subscriptions.get(data.resourceId);
          if (callback) {
            callback(data);
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect(token);
    };
  }

  private reconnect(token: string) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      this.connect(token);
    }, 5000);
  }

  subscribe(resourceId: string, callback: (data: any) => void) {
    this.subscriptions.set(resourceId, callback);
    this.send({ type: 'subscribe', resourceId, resourceType: 'server' });
  }

  unsubscribe(resourceId: string) {
    this.subscriptions.delete(resourceId);
    this.send({ type: 'unsubscribe', resourceId, resourceType: 'server' });
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
  }
}

export const realtimeConnection = new RealtimeConnection();

export default api;
