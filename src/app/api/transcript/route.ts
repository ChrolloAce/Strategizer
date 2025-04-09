// Instagram Transcript API route

import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chrome from '@sparticuz/chromium';

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
    
    // Additional logging for debugging
    console.log('Chrome args:', chrome.args);
    
    // Launch a headless browser with minimal args and chromium
    browser = await puppeteer.launch({
      args: [...chrome.args, '--no-sandbox', '--disable-setuid-sandbox'],
      executablePath,
      headless: true
    });
    
    console.log('Browser launched successfully');
    const page = await browser.newPage();
    
    // Set viewport size to a mobile view to better access Instagram 
    await page.setViewport({ width: 375, height: 812 });
    
    // Set user agent to mimic mobile device
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
    
    console.log(`Navigating to: ${url}`);
    // Navigate to the Instagram post URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log('Page loaded, extracting data...');
    
    // For now, return mock data until the actual extraction is implemented
    return {
      transcript: "Instagram caption would be extracted here",
      views: "100K",
      likes: "10K",
      comments: "500",
      videoUrl: "https://example.com/video.mp4"
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

export async function POST(request: NextRequest) {
  console.log('Received POST request to /api/transcript');
  
  try {
    const { igLink } = await request.json();
    
    if (!igLink) {
      console.log('No Instagram link provided');
      return NextResponse.json(
        { error: 'Instagram link is required' },
        { status: 400 }
      );
    }
    
    console.log(`Processing Instagram link: ${igLink}`);
    const data = await extractInstagramData(igLink);
    
    console.log('Successfully extracted data:', data);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error processing request:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract data' },
      { status: 500 }
    );
  }
} 