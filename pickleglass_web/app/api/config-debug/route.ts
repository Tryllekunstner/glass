import { NextRequest, NextResponse } from 'next/server';
import { getConfigurationSummary, isDevelopment } from '../../../utils/config';

/**
 * Configuration Debug API Endpoint
 * 
 * This endpoint provides configuration status information for debugging purposes.
 * It only returns sensitive information in development mode.
 */
export async function GET(request: NextRequest) {
  try {
    const configSummary = getConfigurationSummary();
    
    // Add request information for debugging
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      isDevelopment: isDevelopment(),
      configuration: configSummary,
      headers: {
        userAgent: request.headers.get('user-agent'),
        host: request.headers.get('host'),
        origin: request.headers.get('origin')
      }
    };

    // In development, include more detailed information
    if (isDevelopment()) {
      debugInfo.configuration = {
        ...configSummary,
        availableEnvVars: Object.keys(process.env)
          .filter(key => key.startsWith('NEXT_PUBLIC_'))
          .reduce((acc, key) => {
            acc[key] = process.env[key] ? '✅ Set' : '❌ Missing';
            return acc;
          }, {} as Record<string, string>)
      };
    }

    return NextResponse.json(debugInfo, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Configuration debug error:', error);
    
    return NextResponse.json({
      error: 'Configuration validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}

// Only allow GET requests
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
