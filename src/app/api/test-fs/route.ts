import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Determine temp directory
    const tmpDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'public/media');
    const testId = randomUUID();
    const testPath = path.join(tmpDir, `${testId}.txt`);
    
    console.log(`Testing file system access at: ${testPath}`);
    
    // Create directory if it doesn't exist
    await fs.promises.mkdir(path.dirname(testPath), { recursive: true });
    
    // Write test file
    await fs.promises.writeFile(testPath, 'Test file content for file system access verification');
    
    // Read file to verify
    const content = await fs.promises.readFile(testPath, 'utf8');
    
    // Clean up
    await fs.promises.unlink(testPath);
    
    return NextResponse.json({
      success: true,
      message: 'File system access is working',
      file_path: testPath,
      content_length: content.length,
      temp_directory: tmpDir
    });
  } catch (error) {
    console.error('Error testing file system:', error);
    
    return NextResponse.json({
      success: false,
      message: 'File system access is not working',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 