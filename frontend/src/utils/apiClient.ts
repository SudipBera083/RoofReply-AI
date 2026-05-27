import { useStore } from '@/store/useStore'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RequestOptions extends RequestInit {
  responseType?: 'json' | 'text' | 'blob' | 'response';
  skipAuth?: boolean;
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  if (!refresh) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh }),
    });

    if (res.ok) {
      const data = await res.json();
      const newAccess = data.access;
      
      // Update in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', newAccess);
      }
      
      // Update in store
      const user = useStore.getState().user;
      if (user) {
        useStore.getState().setAuth({ access: newAccess }, user);
      }
      
      return newAccess;
    }
  } catch (err) {
    console.error('Error refreshing access token:', err);
  }

  // If refresh fails, clear auth state
  useStore.getState().clearAuth();
  return null;
}

async function request(url: string, options: RequestOptions = {}): Promise<any> {
  const { responseType = 'json', skipAuth = false, ...fetchOptions } = options;
  
  // Build headers
  const headers = new Headers(fetchOptions.headers || {});
  
  // Set content type if body is present and not FormData
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach auth header if available and not skipped
  if (!skipAuth) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  try {
    let response = await fetch(fullUrl, {
      ...fetchOptions,
      headers,
    });

    // Handle token refresh on 401 Unauthorized
    if (response.status === 401 && !skipAuth) {
      console.log('401 detected, attempting silent token refresh...');
      const newAccess = await refreshAccessToken();
      
      if (newAccess) {
        // Retry request with new token
        headers.set('Authorization', `Bearer ${newAccess}`);
        response = await fetch(fullUrl, {
          ...fetchOptions,
          headers,
        });
      } else {
        // Refresh failed, redirect or toast
        useStore.getState().addToast('Session expired. Please log in again.', 'warning');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        throw new Error('Unauthorized');
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || JSON.stringify(errorData) || errorMessage;
      } catch (e) {
        // If not JSON, try text
        try {
          errorMessage = await response.text();
        } catch (_) {}
      }
      throw new Error(errorMessage);
    }

    // Return parsed response based on requested type
    if (responseType === 'response') return response;
    if (responseType === 'text') return await response.text();
    if (responseType === 'blob') return await response.blob();
    
    // Default JSON
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error: any) {
    const msg = error.message || 'Network connection failed.';
    console.error(`API Request Error on ${url}:`, msg);
    
    // Don't show toast for silent checks or public pages if not desired, 
    // but in general we show error toasts for operational debugging.
    if (!url.includes('/api/auth/me/') && !url.includes('/api/businesses/profile/me/')) {
      useStore.getState().addToast(msg, 'error');
    }
    throw error;
  }
}

export const apiClient = {
  get: (url: string, options?: RequestOptions) => request(url, { ...options, method: 'GET' }),
  post: (url: string, body?: any, options?: RequestOptions) => 
    request(url, { 
      ...options, 
      method: 'POST', 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  put: (url: string, body?: any, options?: RequestOptions) => 
    request(url, { 
      ...options, 
      method: 'PUT', 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  patch: (url: string, body?: any, options?: RequestOptions) => 
    request(url, { 
      ...options, 
      method: 'PATCH', 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    }),
  delete: (url: string, options?: RequestOptions) => request(url, { ...options, method: 'DELETE' }),
};
