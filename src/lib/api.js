import axios from 'axios';
import chalk from 'chalk';
import { getApiKey } from './config.js';

// Production API Base URL (Overrideable via SNIPPKIT_API_URL env var for local development)
export const DEFAULT_API_BASE_URL = 'https://snippkit.com';
export const getApiBaseUrl = () => process.env.SNIPPKIT_API_URL || DEFAULT_API_BASE_URL;

const apiClient = axios.create({
    headers: { 'Content-Type': 'application/json' },
});

// Dynamic Base URL Request Interceptor
apiClient.interceptors.request.use(
    (config) => {
        config.baseURL = getApiBaseUrl();
        const token = getApiKey();

        if (token && !config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor
apiClient.interceptors.response.use(
    (response) => {
        // Detect HTML page response (e.g. Next.js route fallback) and reject as invalid API endpoint
        const contentType = response.headers?.['content-type'] || '';
        if (contentType.includes('text/html')) {
            const err = new Error('Invalid API Endpoint (received HTML page instead of JSON API response)');
            err.response = { status: 404, data: { error: 'Invalid API route endpoint' } };
            return Promise.reject(err);
        }
        return response;
    },
    (error) => {
        // Return rejected error gracefully without process.exit(1)
        if (error.response && error.response.status === 401 && !error.config?.url?.includes('/me')) {
            error.isAuthError = true;
        }
        return Promise.reject(error);
    }
);

export default apiClient;