// API client for backend communication

const API_BASE = '/api';

const api = {
  // Fetch all alerts with optional filters
  async getAlerts(filters = {}) {
    const params = new URLSearchParams();

    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.search) params.append('search', filters.search);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    try {
      const response = await fetch(`${API_BASE}/alerts?${params}`);
      if (!response.ok) throw new Error(`Failed to fetch alerts: ${response.status} ${response.statusText}`);
      return await response.json();
    } catch (err) {
      throw new Error(`Network error fetching alerts: ${err.message}`);
    }
  },

  // Fetch a specific alert by ID (with optional enrichment)
  async getAlert(id, options = {}) {
    const params = new URLSearchParams();
    if (options.enrich === false) params.append('enrich', '0');
    if (options.includeRaw) params.append('raw', '1');
    const qs = params.toString();
    try {
      const response = await fetch(`${API_BASE}/alerts/${id}${qs ? `?${qs}` : ''}`);
      if (!response.ok) throw new Error(`Failed to fetch alert: ${response.status} ${response.statusText}`);
      return await response.json();
    } catch (err) {
      throw new Error(`Network error fetching alert: ${err.message}`);
    }
  },

  // Check health status
  async healthCheck() {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  },

  // Fetch metadata from mediaservice
  async getMetadata(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    return response.json();
  }
};
