import { useRouteError, isRouteErrorResponse } from "react-router-dom";

export function ErrorBoundary() {
  const error = useRouteError();
  
  let errorMessage: string;
  
  if (isRouteErrorResponse(error)) {
    errorMessage = error.data?.message || error.statusText;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    console.error(error);
    errorMessage = 'Unknown error';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-red-400 mb-4">Application Error</h1>
        <p className="text-gray-300 mb-4">
          Something went wrong while processing your request.
        </p>
        <div className="bg-gray-800 p-4 rounded font-mono text-sm text-red-300 overflow-auto">
          {errorMessage}
        </div>
        <button
          onClick={() => window.location.href = '/'}
          className="mt-6 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
}
