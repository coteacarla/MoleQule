import axios from 'axios';
import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useUIStore } from '../store/uiStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';
const TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000');

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: add user_id to query params
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const activeUserId = useUIStore.getState().activeUserId;
        
        if (activeUserId) {
          // Add user_id to GET requests as query param
          if (config.method === 'get') {
            config.params = { ...config.params, user_id: activeUserId };
          }
          // Add user_id to POST/PUT/DELETE requests in body
          else if (config.method === 'post' || config.method === 'put' || config.method === 'delete') {
            if (config.data && typeof config.data === 'object') {
              config.data = { ...config.data, user_id: activeUserId };
            }
          }
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: handle errors globally
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ error?: string; message?: string }>) => {
        if (error.response?.status === 401) {
          // Handle unauthorized (clear credentials)
          console.error('Unauthorized - credentials may be invalid');
        }
        
        // Extract error message from response body if available
        if (error.response?.data) {
          const errorData = error.response.data;
          const message = errorData.error || errorData.message || error.message;
          // Create a new error with the server's error message
          const enhancedError = new Error(message);
          (enhancedError as any).response = error.response;
          (enhancedError as any).status = error.response.status;
          return Promise.reject(enhancedError);
        }
        
        return Promise.reject(error);
      }
    );
  }

  getInstance() {
    return this.client;
  }
}

export const apiClient = new ApiClient().getInstance();