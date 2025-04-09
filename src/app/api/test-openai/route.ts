import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET(request: NextRequest) {
  try {
    // Create OpenAI client with API key
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    console.log('Testing OpenAI API key...');
    
    // Try a simple call to OpenAI API
    const models = await openai.models.list();
    
    return NextResponse.json({
      success: true,
      message: 'OpenAI API key is working',
      models_count: models.data.length,
      first_few_models: models.data.slice(0, 3).map(model => model.id)
    });
  } catch (error) {
    console.error('Error testing OpenAI:', error);
    
    return NextResponse.json({
      success: false,
      message: 'OpenAI API key is not working',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 