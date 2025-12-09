import axios from 'axios';
import chalk from 'chalk';
import { getApiKey } from './config.js';

// ⚠️ CHANGE THIS to your production URL
const API_BASE_URL = 'https://snippkit.com/api/cli';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// 1. REQUEST INTERCEPTOR
apiClient.interceptors.request.use(
    (config) => {
        const token = getApiKey();

        // ✅ FIX: Only inject token if header is NOT already set.
        // This allows the 'login' command to pass a specific key without being overwritten.
        if (token && !config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// 2. RESPONSE INTERCEPTOR
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        // ✅ FIX: Don't crash process if we are just verifying credentials (/me)
        // We want the login function to handle the error UI (spinner.fail)
        if (error.config && error.config.url.includes('/me')) {
            return Promise.reject(error);
        }

        if (error.response && error.response.status === 401) {
            console.error(chalk.red('\n❌ Authentication failed. Session expired or invalid key.'));
            console.error(chalk.yellow('Run: snix login\n'));
            // Only exit for normal commands, not during auth flow
            process.exit(1);
        }
        return Promise.reject(error);
    }
);

export default apiClient;