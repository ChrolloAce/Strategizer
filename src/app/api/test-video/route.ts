import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import OpenAI from 'openai';

// Sample video URL (Big Buck Bunny - open source)
const SAMPLE_VIDEO_URL = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

// Helper to download a file
async function downloadFile(url: string, filePath: string): Promise<void> {
  console.log(`Downloading from: ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
    
    const buffer = await response.arrayBuffer();
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, Buffer.from(buffer));
    console.log(`File downloaded to ${filePath}, size: ${buffer.byteLength} bytes`);
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'OpenAI API key is not set'
      }, { status: 400 });
    }
    
    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Set up temp directory and file paths
    const tmpDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'public/media');
    const videoId = randomUUID();
    const videoPath = path.join(tmpDir, `${videoId}.mp4`);
    
    console.log('Starting sample video test...');
    
    // Download sample video
    await downloadFile(SAMPLE_VIDEO_URL, videoPath);
    
    // Check if file exists and has content
    const fileStats = await fs.promises.stat(videoPath);
    console.log(`Video file size: ${fileStats.size} bytes`);
    
    if (fileStats.size === 0) {
      throw new Error('Downloaded video file is empty');
    }
    
    // We'll just get the first 10 seconds to save time and API costs
    // Create a shorter clip using Buffer operations (ideally you'd use ffmpeg)
    const videoData = await fs.promises.readFile(videoPath);
    const shortVideoPath = path.join(tmpDir, `${videoId}_short.mp4`);
    // Just take the first 500KB of data as a rough approximation
    await fs.promises.writeFile(shortVideoPath, videoData.slice(0, 500000));
    
    console.log('Sending file to OpenAI for transcription...');
    
    // Transcribe with OpenAI
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(shortVideoPath),
      model: "whisper-1",
      language: "en",
    });
    
    console.log('Transcription received');
    
    // Clean up
    try {
      await fs.promises.unlink(videoPath);
      await fs.promises.unlink(shortVideoPath);
      console.log('Temporary files cleaned up');
    } catch (err) {
      console.error('Error cleaning up video files:', err);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test video transcription successful',
      transcription: transcription.text
    });
  } catch (error) {
    console.error('Error in video test:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Test video transcription failed',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 