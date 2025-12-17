import { QueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/utils/apiConfig";

// Configure the default query client for real-time synchronization
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - balanced performance
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false, // Disable to prevent unnecessary API calls
      refetchOnMount: false, // Disable refetch on mount - using SSE for real-time updates
      refetchInterval: false, // Disable automatic polling - using SSE for real-time updates
      queryFn: async ({ queryKey }) => {
        const [url] = queryKey as [string];
        const apiBaseUrl = getApiBaseUrl();
        const fullUrl = url.startsWith('http') ? url : `${apiBaseUrl}${url}`;
        const response = await fetch(fullUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.json();
      },
    },
    mutations: {
      retry: 1,
    },
  },
});

// Default fetcher function for API requests with timeout
const apiRequest = async (url: string, options?: RequestInit): Promise<any> => {
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  
  try {
    // Get the API base URL
    const apiBaseUrl = getApiBaseUrl();
    // Construct full URL - if url already starts with http, use it as-is, otherwise prepend base URL
    const fullUrl = url.startsWith('http') ? url : `${apiBaseUrl}${url}`;
    
    // Don't set Content-Type for FormData - let the browser set it with boundary
    const headers: Record<string, string> = {};
    
    // Only set Content-Type to application/json if body is not FormData
    if (!(options?.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(fullUrl, {
      headers: {
        ...headers,
        ...options?.headers,
      },
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try to get the error message from the response
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // If we can't parse the error response, use the default message
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses (like DELETE operations that return 204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as any).name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    throw error;
  }
};

// Enhanced mutation helper with automatic cache invalidation
export const createMutationWithSync = (
  url: string, 
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  invalidateKeys: string[] = []
) => {
  return {
    mutationFn: async (data?: any) => {
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      
      if (data && method !== 'DELETE') {
        options.body = JSON.stringify(data);
      }
      
      const result = await apiRequest(url, options);
      return result;
    },
    onSuccess: () => {
      // Invalidate only relevant queries to avoid unnecessary refetches
      if (invalidateKeys.length > 0) {
        invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      } else {
        // Only invalidate the specific endpoint that was modified
        const baseUrl = url.split('/').slice(0, -1).join('/');
        queryClient.invalidateQueries({ queryKey: [baseUrl] });
      }
    }
  };
};

export { apiRequest };