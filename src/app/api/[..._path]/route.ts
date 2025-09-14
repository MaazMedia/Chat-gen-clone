// This file acts as a proxy for requests to your ADK server.
// It replaces the LangGraph proxy to work with Google ADK API.

const ADK_API_URL = process.env.ADK_API_URL ?? "http://localhost:8080";
const ADK_API_KEY = process.env.ADK_API_KEY ?? "";

async function proxyToADK(request: Request, method: string) {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').slice(3); // Remove /api prefix
  const adkPath = pathSegments.join('/');
  const adkUrl = `${ADK_API_URL}/${adkPath}${url.search}`;

  const headers = new Headers();
  
  // Copy relevant headers from the original request
  if (request.headers.get('content-type')) {
    headers.set('content-type', request.headers.get('content-type')!);
  }
  if (request.headers.get('accept')) {
    headers.set('accept', request.headers.get('accept')!);
  }
  
  // Add ADK API key if available
  if (ADK_API_KEY) {
    headers.set('authorization', `Bearer ${ADK_API_KEY}`);
  }

  let body: BodyInit | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await request.arrayBuffer();
  }

  const response = await fetch(adkUrl, {
    method,
    headers,
    body,
  });

  // Create response with proper headers for streaming
  const responseHeaders = new Headers();
  responseHeaders.set('access-control-allow-origin', '*');
  responseHeaders.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  responseHeaders.set('access-control-allow-headers', 'content-type, authorization');

  // Copy content-type and other important headers
  if (response.headers.get('content-type')) {
    responseHeaders.set('content-type', response.headers.get('content-type')!);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: Request) {
  return proxyToADK(request, 'GET');
}

export async function POST(request: Request) {
  return proxyToADK(request, 'POST');
}

export async function PUT(request: Request) {
  return proxyToADK(request, 'PUT');
}

export async function PATCH(request: Request) {
  return proxyToADK(request, 'PATCH');
}

export async function DELETE(request: Request) {
  return proxyToADK(request, 'DELETE');
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    },
  });
}

export const runtime = 'edge';
