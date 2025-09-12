import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

/**
 * Session Management API
 * Handles server-side session operations for authentication
 */

/**
 * GET /api/auth/session
 * Get current session information
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const authToken = cookieStore.get('authToken')?.value;

    if (!authToken) {
      return NextResponse.json(
        { 
          user: null, 
          isAuthenticated: false,
          message: 'No authentication token found'
        },
        { status: 200 }
      );
    }

    // Verify the token using Firebase Admin SDK
    const user = await verifyAuthToken(authToken);

    if (!user) {
      // Clear invalid token
      const response = NextResponse.json(
        { 
          user: null, 
          isAuthenticated: false,
          message: 'Invalid or expired token'
        },
        { status: 200 }
      );

      response.cookies.delete('authToken');
      return response;
    }

    return NextResponse.json({
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
      },
      isAuthenticated: true,
      message: 'Session valid'
    });

  } catch (error) {
    console.error('Session verification error:', error);
    
    return NextResponse.json(
      { 
        user: null, 
        isAuthenticated: false,
        error: 'Session verification failed',
        message: 'Unable to verify session'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/session
 * Create or update session with new token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid token',
          message: 'Authentication token is required'
        },
        { status: 400 }
      );
    }

    // Verify the token using Firebase Admin SDK
    const user = await verifyAuthToken(token);

    if (!user) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid token',
          message: 'Token verification failed'
        },
        { status: 401 }
      );
    }

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
      },
      message: 'Session created successfully'
    });

    // Set secure HTTP-only cookie
    response.cookies.set('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Session creation error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Session creation failed',
        message: 'Unable to create session'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Clear session and logout
 */
export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Session cleared successfully'
    });

    // Clear the authentication cookie
    response.cookies.delete('authToken');

    return response;

  } catch (error) {
    console.error('Session deletion error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Session deletion failed',
        message: 'Unable to clear session'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/auth/session
 * Refresh session with new token
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid token',
          message: 'Authentication token is required'
        },
        { status: 400 }
      );
    }

    // Verify the new token
    const user = await verifyAuthToken(token);

    if (!user) {
      // Clear invalid token
      const response = NextResponse.json(
        { 
          success: false,
          error: 'Invalid token',
          message: 'Token verification failed'
        },
        { status: 401 }
      );

      response.cookies.delete('authToken');
      return response;
    }

    // Update session with new token
    const response = NextResponse.json({
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
      },
      message: 'Session refreshed successfully'
    });

    // Update the authentication cookie
    response.cookies.set('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Session refresh error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Session refresh failed',
        message: 'Unable to refresh session'
      },
      { status: 500 }
    );
  }
}
