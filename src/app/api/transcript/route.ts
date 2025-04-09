// Instagram Transcript API route

import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chrome from '@sparticuz/chromium';

// Even shorter timeout for serverless environment
const NAVIGATION_TIMEOUT = 8000; // 8 seconds
const FUNCTION_TIMEOUT = 9000;   // 9 seconds - just under Vercel's 10s limit

// Function to extract transcript and metrics from Instagram using Puppeteer
async function extractInstagramData(url: string) {
  console.log(`Attempting to extract data from: ${url}`);
  
  if (!url.includes('instagram.com')) {
    throw new Error('Not a valid Instagram URL');
  }

  let browser;
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
    
    // Return simplified response
    return {
      transcript: caption,
      views: "100K", // Placeholder
      likes: "10K",  // Placeholder
      comments: "500", // Placeholder
      videoUrl: "https://example.com/video.mp4", // Placeholder
      transcriptFromAudio: "Audio transcription would appear here if video was processed."
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