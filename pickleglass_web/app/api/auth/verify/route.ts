import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ authenticated: false, error: 'No token provided' }, { status: 401 });
    }
    
    const user = await verifyAuthToken(token);
    
    if (user) {
      return NextResponse.json({ 
        authenticated: true, 
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified
        }
      });
    } else {
      return NextResponse.json({ authenticated: false, error: 'Invalid token' }, { status: 401 });
    }
  } catch (error) {
    console.error('Auth verification error:', error);
    return NextResponse.json({ authenticated: false, error: 'Verification failed' }, { status: 500 });
  }
}
