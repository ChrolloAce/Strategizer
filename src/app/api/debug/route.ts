import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Debug environment variables and configuration
  const debug = {
    environment: {
      OPENAI_API_KEY_EXISTS: !!process.env.OPENAI_API_KEY,
      OPENAI_API_KEY_FIRST_CHARS: process.env.OPENAI_API_KEY ? 
        `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : null,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    },
    system: {
      tempDir: process.env.VERCEL ? '/tmp' : process.cwd(),
      now: new Date().toISOString(),
    }
  };

  return NextResponse.json(debug);
} 