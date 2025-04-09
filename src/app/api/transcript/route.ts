// Instagram Transcript API route

import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chrome from '@sparticuz/chromium';

// Shorter timeout for serverless environment
const NAVIGATION_TIMEOUT = 25000; // 25 seconds
const FUNCTION_TIMEOUT = 30000; // 30 seconds - just under Vercel's 60s limit to have time for cleanup

// Function to extract transcript and metrics from Instagram using Puppeteer
async function extractInstagramData(url: string) {
  console.log(`Attempting to extract data from: ${url}`);
  
  if (!url.includes('instagram.com')) {
    throw new Error('Not a valid Instagram URL');
  }

  // Create a timeout promise to prevent function from hanging
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Operation timed out')), FUNCTION_TIMEOUT)
  );

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
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
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
    await Promise.race([
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT }),
      timeoutPromise
    ]);
    
    console.log('Page loaded, extracting data...');
    
    // Wait for content to load
    await page.waitForSelector('article', { timeout: 5000 }).catch(() => console.log('Article selector not found'));
    
    // Give a bit more time for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract data from Instagram
    const extractedData = await page.evaluate(() => {
      // Caption extraction
      const captionElement = document.querySelector('div[data-block="true"]') || 
                             document.querySelector('h1') || 
                             document.querySelector('article div > span');
      
      // Likes/Views extraction
      const statsElements = Array.from(document.querySelectorAll('section span'));
      
      let likesElement = null;
      let viewsElement = null;
      let commentsElement = null;
      
      for (const el of statsElements) {
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('like') || text.includes('heart')) {
          likesElement = el;
        } else if (text.includes('view')) {
          viewsElement = el;
        } else if (text.includes('comment')) {
          commentsElement = el;
        }
      }
      
      // Video URL extraction - this is difficult due to Instagram's security
      // but we can try to find video elements
      const videoElements = document.querySelectorAll('video');
      const videoUrl = videoElements.length > 0 ? videoElements[0].src : null;
      
      return {
        transcript: captionElement ? captionElement.textContent : "No caption found",
        views: viewsElement ? viewsElement.textContent : null,
        likes: likesElement ? likesElement.textContent : null,
        comments: commentsElement ? commentsElement.textContent : null,
        videoUrl: videoUrl || "https://example.com/video.mp4" // Fallback for demo
      };
    });
    
    console.log('Extracted data:', extractedData);
    
    return {
      ...extractedData,
      // Add a transcription placeholder since we can't easily extract the audio in this implementation
      transcriptFromAudio: "This is a placeholder for audio transcription. In a production environment, we would use OpenAI Whisper to transcribe the actual audio from the video."
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
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    if (!igLink) {
      console.log('No Instagram link provided');
      return NextResponse.json(
        { error: 'Instagram link is required' },
        { status: 400 }
      );
    }
    
    console.log(`Processing Instagram link: ${igLink}`);
    
    // Create a timeout for the entire handler
    const responsePromise = extractInstagramData(igLink);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('API timeout - Instagram extraction took too long')), FUNCTION_TIMEOUT);
    });
    
    // Race the actual operation against the timeout
    const data = await Promise.race([responsePromise, timeoutPromise]);
    
    console.log('Successfully extracted data:', data);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error processing request:', error);
    
    // Always return a proper JSON response
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract data' },
      { status: 500 }
    );
  }
} 