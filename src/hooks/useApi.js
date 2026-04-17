import { useState, useCallback } from 'react';
import { get, post, put, del } from '../lib/api';

export const useApi = () => {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const request = useCallback(async (method, endpoint, body = null, options = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            let response;
            switch (method.toLowerCase()) {
                case 'get':
                    response = await get(endpoint, options);
                    break;
                case 'post':
                    response = await post(endpoint, body, options);
                    break;
                case 'put':
                    response = await put(endpoint, body, options);
                    break;
                case 'delete':
                    response = await del(endpoint, options);
                    break;
                default:
                    throw new Error(`Unknown method: ${method}`);
            }

            setData(response.data);
            return response;
        } catch (err) {
            setError(err.message || 'Request failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return {
        data,
        error,
        isLoading,
        request,
        reset,
        get: (endpoint, options) => request('get', endpoint, null, options),
        post: (endpoint, body, options) => request('post', endpoint, body, options),
        put: (endpoint, body, options) => request('put', endpoint, body, options),
        del: (endpoint, options) => request('delete', endpoint, null, options),
    };
};

export default useApi;
