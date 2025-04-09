// Instagram Transcript API route

import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chrome from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createReadStream } from 'fs';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';

// Even shorter timeout for serverless environment
const NAVIGATION_TIMEOUT = 8000; // 8 seconds
const FUNCTION_TIMEOUT = 9000;   // 9 seconds - just under Vercel's 10s limit

// Debug environment variables
console.log('Environment check:');
console.log('OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL:', process.env.VERCEL);

// Initialize OpenAI client conditionally
let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('OpenAI client initialized successfully');
  } else {
    console.log('No OpenAI API key found. Transcription will be unavailable.');
  }
} catch (error) {
  console.error('Error initializing OpenAI client:', error);
}

// Helper to download a file
async function downloadFile(url: string, filePath: string): Promise<void> {
  if (!url || url === "https://example.com/video.mp4") {
    throw new Error("Invalid video URL");
  }

  console.log(`Attempting to download from URL: ${url.substring(0, 50)}...`);
  
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

// Function to extract transcript and metrics from Instagram using Puppeteer
async function extractInstagramData(url: string) {
  console.log(`Attempting to extract data from: ${url}`);
  
  if (!url.includes('instagram.com')) {
    throw new Error('Not a valid Instagram URL');
  }

  let browser;
  let videoUrl = null;
  let transcriptFromAudio = "Audio transcription not available.";
  
  try {
    console.log('Setting up browser for serverless environment...');
    
    // Configure chromium
    const executablePath = await chrome.executablePath();
    console.log(`Chromium executable path: ${executablePath}`);
    
    // Launch a headless browser with minimal resources
    browser = await puppeteer.launch({
      args: [
        ...chrome.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--single-process'
      ],
      executablePath,
      headless: true
    });
    
    console.log('Browser launched successfully');
    const page = await browser.newPage();
    
    // Set viewport size to a mobile view
    await page.setViewport({ width: 375, height: 812 });
    
    // Set user agent to mimic mobile device
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    
    console.log(`Navigating to: ${url}`);
    
    // Navigate to the Instagram post URL with a timeout
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT })
      .catch(() => console.log('Navigation timeout, continuing with partial page load'));
    
    console.log('Page loaded, extracting data...');
    
    try {
      // Wait briefly for content
      await page.waitForSelector('article', { timeout: 3000 })
        .catch(() => console.log('Article selector not found'));
    } catch (error) {
      console.log('Error waiting for selectors, continuing anyway');
    }
    
    // Extract data from Instagram
    let caption = "No caption found";
    
    try {
      caption = await page.evaluate(() => {
        const captionElement = document.querySelector('div[data-block="true"]') || 
                              document.querySelector('h1') || 
                              document.querySelector('article div > span');
        return captionElement ? captionElement.textContent || "No caption found" : "No caption found";
      });
    } catch (error) {
      console.error('Error extracting caption:', error);
    }
    
    console.log('Extracted caption:', caption);
    
    // Try to extract video URL using multiple methods
    try {
      // Method 1: Try to get video elements directly
      videoUrl = await page.evaluate(() => {
        const videoElements = document.querySelectorAll('video');
        console.log('Found video elements:', videoElements.length);
        
        if (videoElements.length > 0) {
          for (const video of videoElements) {
            if ((video as HTMLVideoElement).src) return (video as HTMLVideoElement).src;
          }
        }
        
        // Method 2: Look for video source elements
        const sources = document.querySelectorAll('source');
        console.log('Found source elements:', sources.length);
        
        for (const source of sources) {
          if ((source as HTMLSourceElement).src) return (source as HTMLSourceElement).src;
        }
        
        // Method 3: Check for video in iframes
        const iframes = document.querySelectorAll('iframe');
        console.log('Found iframes:', iframes.length);
        
        // Method 4: Look for specific Instagram video classes
        const mediaContainers = document.querySelectorAll('[role="button"] img');
        console.log('Found media containers:', mediaContainers.length);
        
        if (mediaContainers.length > 0) {
          // Try to find parent element with URL property
          for (const img of mediaContainers) {
            if ((img as HTMLImageElement).src && (img as HTMLImageElement).src.includes('video')) {
              return (img as HTMLImageElement).src.replace('/img/', '/video/');
            }
          }
        }
        
        return null;
      });
      
      console.log('Video URL found:', videoUrl);
      
      // If no video URL found by direct methods, try alternative approaches
      if (!videoUrl) {
        console.log('Trying alternative video extraction methods...');
        
        // Try to extract from network requests
        try {
          const cdnUrls = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('*'))
              .map(el => el.getAttribute('src') || el.getAttribute('href'))
              .filter(url => url && 
                     (url.includes('.mp4') || 
                      url.includes('instagram.com/p/') || 
                      url.includes('cdninstagram')))
              .filter(Boolean);
          });
          
          console.log('Potential CDN URLs found:', cdnUrls);
          
          if (cdnUrls.length > 0) {
            // Try to find best video URL
            for (const url of cdnUrls) {
              if (url && typeof url === 'string' && url.includes('.mp4')) {
                videoUrl = url;
                break;
              }
            }
          }
        } catch (error) {
          console.error('Error extracting video from network requests:', error);
        }
      }
      
      // If video URL found, download and transcribe
      if (videoUrl) {
        console.log(`Found video URL: ${videoUrl.substring(0, 50)}...`);
        
        // Check if OpenAI client is available before attempting transcription
        if (!openai) {
          console.log('Skipping transcription: OpenAI API key not set');
          transcriptFromAudio = "Audio transcription unavailable. Please set OPENAI_API_KEY in environment variables.";
        } else {
          try {
            // Create temporary directory in /tmp for Vercel serverless
            const tmpDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'public/media');
            console.log(`Using temporary directory: ${tmpDir}`);
            
            const videoId = randomUUID();
            const videoPath = path.join(tmpDir, `${videoId}.mp4`);
            
            // Download video
            await downloadFile(videoUrl, videoPath);
            console.log('Video downloaded successfully');
            
            // Check if file exists and has content
            const fileStats = await fs.promises.stat(videoPath);
            console.log(`Video file size: ${fileStats.size} bytes`);
            
            if (fileStats.size > 0) {
              // Transcribe with OpenAI
              console.log('Starting transcription...');
              const transcription = await transcribeAudio(videoPath);
              transcriptFromAudio = transcription;
              console.log('Transcription completed');
            } else {
              throw new Error('Downloaded video file is empty');
            }
            
            // Clean up
            try {
              await fs.promises.unlink(videoPath);
              console.log('Temporary file cleaned up');
            } catch (err) {
              console.error('Error cleaning up video file:', err);
            }
          } catch (downloadError) {
            console.error('Error during video download or processing:', downloadError);
            transcriptFromAudio = "Error processing video. Please try a different Instagram post.";
          }
        }
      } else {
        console.log('No video URL found on page - transcription unavailable');
        transcriptFromAudio = "No video found on this Instagram post, or video is not accessible.";
      }
    } catch (videoError) {
      console.error('Error extracting video URL:', videoError);
    }
    
    // Return response with all data
    return {
      transcript: caption,
      views: "100K", // Placeholder
      likes: "10K",  // Placeholder
      comments: "500", // Placeholder
      videoUrl: videoUrl || "https://example.com/video.mp4", // Use real URL or placeholder
      transcriptFromAudio
    };
    
  } catch (error) {
    console.error('Error during extraction:', error);
    throw new Error(`Failed to extract data: ${(error instanceof Error) ? error.message : String(error)}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

// Function to transcribe audio using OpenAI
async function transcribeAudio(filePath: string): Promise<string> {
  try {
    console.log(`Transcribing audio from: ${filePath}`);
    
    // Check if OpenAI client is available
    if (!openai) {
      throw new Error('OpenAI client not initialized. Please set OPENAI_API_KEY environment variable.');
    }
    
    // Verify file exists before sending to API
    const fileExists = await fs.promises.access(filePath)
      .then(() => true)
      .catch(() => false);
      
    if (!fileExists) {
      throw new Error(`File not found at path: ${filePath}`);
    }
    
    const fileSize = (await fs.promises.stat(filePath)).size;
    console.log(`File size before transcription: ${fileSize} bytes`);
    
    if (fileSize === 0) {
      throw new Error('File is empty');
    }
    
    // Use OpenAI's API to transcribe the audio
    console.log('Sending file to OpenAI for transcription...');
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(filePath),
      model: "whisper-1",
      language: "en",
    });
    
    console.log('Transcription received from OpenAI');
    return transcription.text;
  } catch (error) {
    console.error('Error during transcription:', error);
    throw new Error(`Failed to transcribe audio: ${(error instanceof Error) ? error.message : String(error)}`);
  }
}

// Wrap the handler to ensure proper error handling
export async function POST(request: NextRequest) {
  console.log('Received POST request to /api/transcript');
  
  try {
    // Parse request body with error handling
    let igLink;
    try {
      const body = await request.json();
      igLink = body.igLink;
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          transcript: "Error: Invalid request format",
          views: "Error",
          likes: "Error",
          comments: "Error",
          videoUrl: "",
          transcriptFromAudio: ""
        },
        { status: 200 }
      );
    }
    
    if (!igLink) {
      console.log('No Instagram link provided');
      return NextResponse.json({
        error: 'Instagram link is required',
        transcript: "Error: Instagram link is required",
        views: "Error",
        likes: "Error",
        comments: "Error",
        videoUrl: "",
        transcriptFromAudio: ""
      }, { status: 200 });
    }
    
    console.log(`Processing Instagram link: ${igLink}`);
    
    // Set up a timeout for the entire operation
    const timeoutData = {
      transcript: "Instagram content is taking longer than expected to load. Check back in a moment.",
      views: "Loading...",
      likes: "Loading...",
      comments: "Loading...",
      videoUrl: "https://example.com/video.mp4",
      transcriptFromAudio: "Transcription loading..."
    };
    
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise(resolve => {
      timeoutId = setTimeout(() => resolve(timeoutData), 8000);
    });
    
    // Try to get real data
    const resultPromise = extractInstagramData(igLink);
    
    // Race the actual operation against the timeout
    const data = await Promise.race([resultPromise, timeoutPromise]);
    
    // Clear timeout if the real data won
    if (timeoutId) clearTimeout(timeoutId);
    
    console.log('Successfully returned data');
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error processing request:', error);
    
    // Always return a proper JSON response with data structure
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to extract data',
      transcript: "Error occurred while extracting data. Please try again.",
      views: "Error",
      likes: "Error",
      comments: "Error",
      videoUrl: "https://example.com/video.mp4",
      transcriptFromAudio: "Error occurred during transcription"
    }, { status: 200 });
  }
} 