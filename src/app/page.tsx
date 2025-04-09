'use client';

import { useState, useRef, useEffect } from 'react';

interface InstagramData {
  transcript: string;
  views?: string;
  likes?: string;
  comments?: string;
  videoUrl?: string;
  transcriptFromAudio?: string;
}

// Adding an interface for transcript segments with timestamps
interface TranscriptSegment {
  text: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
}

// Add SavedTranscript interface after InstagramData interface
interface SavedTranscript {
  id: string;
  date: string;
  title: string;
  transcript: string;
  videoUrl?: string;
  transcriptFromAudio?: string;
}

export default function Home() {
  const [igLink, setIgLink] = useState('');
  const [data, setData] = useState<InstagramData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('transcripts');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  
  // Reference to video element
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Mock transcript segments with timestamps (in a real app, these would come from the API)
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);

  // Add these state variables after the existing state declarations
  const [savedTranscripts, setSavedTranscripts] = useState<SavedTranscript[]>([]);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Generate mock segments from full transcript
  useEffect(() => {
    if (data?.transcriptFromAudio) {
      const segments = generateMockSegments(data.transcriptFromAudio);
      setTranscriptSegments(segments);
    }
  }, [data?.transcriptFromAudio]);

  // Add this useEffect to load saved transcripts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedTranscripts');
    if (saved) {
      setSavedTranscripts(JSON.parse(saved));
    }
  }, []);

  // Video time update handler
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Find active segment based on current time
      const activeIndex = transcriptSegments.findIndex(
        segment => currentTime >= segment.startTime && currentTime <= segment.endTime
      );
      
      if (activeIndex !== -1 && activeIndex !== activeSegment) {
        setActiveSegment(activeIndex);
        // Scroll to active segment
        document.getElementById(`segment-${activeIndex}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  };

  // Function to generate mock transcript segments with timestamps from a full transcript
  const generateMockSegments = (transcript: string): TranscriptSegment[] => {
    // Split by sentences and create segments with estimated timestamps
    const sentences = transcript.split(/(?<=[.!?])\s+/);
    let currentTime = 0;
    const avgWordsPerSecond = 2.5; // Average speaking rate
    
    return sentences.map(sentence => {
      const wordCount = sentence.split(/\s+/).length;
      const duration = wordCount / avgWordsPerSecond;
      const segment = {
        text: sentence,
        startTime: currentTime,
        endTime: currentTime + duration
      };
      currentTime += duration;
      return segment;
    });
  };

  // Function to format time in MM:SS format
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Function to seek to a specific segment
  const seekToSegment = (index: number) => {
    if (videoRef.current && transcriptSegments[index]) {
      videoRef.current.currentTime = transcriptSegments[index].startTime;
      setActiveSegment(index);
      if (!isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setData(null);

    try {
      // Call our API endpoint to get the transcript
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ igLink }),
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        // Log the detailed error information 
        console.error('API Error Response:', responseData);
        throw new Error(responseData.error || `Failed to fetch data (Status: ${response.status})`);
      }
      
      setData(responseData);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data. Please check the link and try again.';
      console.error('Request Error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Function to format audio transcript with better spacing and speaker identification
  const formatTranscript = (transcript: string | undefined): string => {
    if (!transcript) return '';

    // Split by sentences (looking for period, question mark, or exclamation mark followed by space)
    const sentences = transcript.split(/(?<=[.!?])\s+/);
    
    // Add paragraph breaks every few sentences for readability
    const paragraphs = [];
    const sentencesPerParagraph = 3;
    
    for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
      paragraphs.push(sentences.slice(i, i + sentencesPerParagraph).join(' '));
    }
    
    // Try to detect if there's a speaker pattern (like "Person A: text")
    const speakerPattern = /^([A-Za-z\s]+):\s/;
    const hasSpeakers = sentences.some(s => speakerPattern.test(s));
    
    if (!hasSpeakers) {
      // If no explicit speakers, assume a single speaker
      return paragraphs.join('\n\n');
    } else {
      // Format with proper speaker indentation
      return paragraphs.map(p => {
        if (speakerPattern.test(p)) {
          return p.replace(speakerPattern, (match, speaker) => {
            return `${speaker}:\n  ${p.substring(match.length)}`;
          });
        }
        return p;
      }).join('\n\n');
    }
  };

  // Add this function to save the current transcript
  const saveCurrentTranscript = () => {
    if (!data) return;
    
    const newTranscript: SavedTranscript = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      title: saveTitle || `Instagram Transcript ${new Date().toLocaleDateString()}`,
      transcript: data.transcript,
      videoUrl: data.videoUrl,
      transcriptFromAudio: data.transcriptFromAudio
    };
    
    const updatedTranscripts = [...savedTranscripts, newTranscript];
    setSavedTranscripts(updatedTranscripts);
    localStorage.setItem('savedTranscripts', JSON.stringify(updatedTranscripts));
    
    setSaveTitle('');
    setShowSaveDialog(false);
  };

  // Add this function to delete a saved transcript
  const deleteSavedTranscript = (id: string) => {
    const updatedTranscripts = savedTranscripts.filter(transcript => transcript.id !== id);
    setSavedTranscripts(updatedTranscripts);
    localStorage.setItem('savedTranscripts', JSON.stringify(updatedTranscripts));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <div className="container mx-auto p-4 pt-8 max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="mr-2 flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">Instagram Transcriber</h1>
                <p className="text-sm text-gray-500">Extract captions and transcripts</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </div>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">Instagram URL</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="url"
                    id="igLink"
                    placeholder="https://www.instagram.com/p/..."
                    value={igLink}
                    onChange={(e) => setIgLink(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Extract Data'
                  )}
                </button>
              </form>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div 
                className={`p-3 border-l-4 ${activeTab === 'transcripts' ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}
                onClick={() => data && setActiveTab('transcripts')}
              >
                <span className={`text-sm font-medium ${activeTab === 'transcripts' ? 'text-blue-700' : 'text-gray-600'}`}>Transcripts</span>
              </div>
              <div 
                className={`p-3 border-l-4 ${activeTab === 'player' ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}
                onClick={() => data?.videoUrl && setActiveTab('player')}
                style={{ cursor: data?.videoUrl ? 'pointer' : 'default' }}
              >
                <span className={`text-sm font-medium ${activeTab === 'player' ? 'text-blue-700' : data?.videoUrl ? 'text-gray-600' : 'text-gray-400'}`}>
                  Video Player
                </span>
              </div>
              <div 
                className={`p-3 border-l-4 ${activeTab === 'saved' ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}
                onClick={() => setActiveTab('saved')}
              >
                <span className={`text-sm font-medium ${activeTab === 'saved' ? 'text-blue-700' : 'text-gray-600'}`}>
                  Saved Transcripts
                </span>
              </div>
              <div 
                className={`p-3 border-l-4 ${activeTab === 'analytics' ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}
                onClick={() => data && setActiveTab('analytics')}
              >
                <span className={`text-sm font-medium ${activeTab === 'analytics' ? 'text-blue-700' : 'text-gray-600'}`}>Analytics</span>
              </div>
              <div className="p-3 border-l-4 border-transparent hover:bg-gray-50">
                <span className="text-sm text-gray-600">Settings</span>
              </div>
            </div>

            {/* Dashboard Stats */}
            {data && (data.views || data.likes || data.comments) && (
              <div className="grid grid-cols-1 gap-4">
                {data.views && (
                  <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-500">Total Views</h3>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-2xl font-bold text-gray-800">{data.views}</span>
                      <span className="ml-2 text-xs text-green-600 bg-green-100 px-1 py-0.5 rounded">+8.4%</span>
                    </div>
                  </div>
                )}
                
                {data.likes && (
                  <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-500">Total Likes</h3>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-2xl font-bold text-gray-800">{data.likes}</span>
                      <span className="ml-2 text-xs text-green-600 bg-green-100 px-1 py-0.5 rounded">+12.3%</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Content */}
          <div className="lg:col-span-9 space-y-6">
            {/* Content Area */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              {/* If data is loaded */}
              {data ? (
                <div className="space-y-8">
                  {/* Tabs */}
                  <div className="border-b border-gray-200">
                    <div className="flex space-x-8">
                      <button 
                        className={`py-2 border-b-2 ${activeTab === 'transcripts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} font-medium text-sm`}
                        onClick={() => setActiveTab('transcripts')}
                      >
                        Transcripts
                      </button>
                      {data?.videoUrl && (
                        <button 
                          className={`py-2 border-b-2 ${activeTab === 'player' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} font-medium text-sm`}
                          onClick={() => setActiveTab('player')}
                        >
                          Video Player
                        </button>
                      )}
                      <button 
                        className={`py-2 border-b-2 ${activeTab === 'saved' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} font-medium text-sm`}
                        onClick={() => setActiveTab('saved')}
                      >
                        Saved Transcripts
                      </button>
                      <button 
                        className={`py-2 border-b-2 ${activeTab === 'analytics' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} font-medium text-sm`}
                        onClick={() => setActiveTab('analytics')}
                      >
                        Analytics
                      </button>
                    </div>
                  </div>

                  {/* Transcripts Tab */}
                  {activeTab === 'transcripts' && (
                    <>
                      {/* Original Caption */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-semibold text-gray-800">Instagram Caption</h2>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => navigator.clipboard.writeText(data.transcript)}
                              className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => setShowSaveDialog(true)}
                              className="text-xs px-2 py-1 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-gray-700 whitespace-pre-wrap">{data.transcript}</p>
                        </div>
                      </div>

                      {/* Audio Transcript */}
                      {data.transcriptFromAudio && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-800">Speech Transcript</h2>
                            <button
                              onClick={() => navigator.clipboard.writeText(data.transcriptFromAudio || '')}
                              className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-gray-700 whitespace-pre-wrap">{formatTranscript(data.transcriptFromAudio || '')}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Video Player Tab */}
                  {activeTab === 'player' && data.videoUrl && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Video Player */}
                      <div className="lg:col-span-7">
                        <div className="bg-black rounded-lg overflow-hidden">
                          <video 
                            ref={videoRef}
                            src={data.videoUrl} 
                            controls
                            className="w-full h-auto"
                            onTimeUpdate={handleTimeUpdate}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                          />
                        </div>
                        <div className="mt-4 flex justify-between items-center">
                          <div className="text-sm text-gray-500">
                            Current time: {formatTime(currentTime)}
                          </div>
                          <div>
                            <button
                              onClick={() => data.videoUrl && navigator.clipboard.writeText(data.videoUrl)}
                              className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                            >
                              Copy Video Link
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Synchronized Transcript */}
                      <div className="lg:col-span-5">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg h-[400px] overflow-y-auto p-4">
                          <h3 className="text-lg font-semibold text-gray-800 mb-3 sticky top-0 bg-gray-50 pb-2">Synchronized Transcript</h3>
                          {data.transcriptFromAudio ? (
                            <div className="space-y-3">
                              {transcriptSegments.map((segment, index) => (
                                <div 
                                  key={index} 
                                  id={`segment-${index}`}
                                  className={`p-2 rounded transition-colors ${index === activeSegment ? 'bg-blue-100 border-l-4 border-blue-500' : 'hover:bg-gray-100 cursor-pointer'}`}
                                  onClick={() => seekToSegment(index)}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-medium text-gray-500">{formatTime(segment.startTime)}</span>
                                    <span className="text-xs text-gray-400">{formatTime(segment.endTime)}</span>
                                  </div>
                                  <p className="text-sm text-gray-700">{segment.text}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-center">No transcript available for this video.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Analytics Tab */}
                  {activeTab === 'analytics' && (
                    <div className="text-center text-gray-500 py-6">
                      <p>Analytics features coming soon!</p>
                    </div>
                  )}

                  {/* Video Link (only on Transcripts tab) */}
                  {activeTab === 'transcripts' && data.videoUrl && (
                    <div className="mt-6">
                      <a 
                        href={data.videoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        download
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Download Video
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No Data Yet</h3>
                  <p className="text-sm text-gray-500 text-center max-w-sm">
                    Enter an Instagram link in the form to extract captions, transcripts, and statistics.
                  </p>
                </div>
              )}
            </div>

            {/* Saved Transcripts Tab */}
            {activeTab === 'saved' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">Saved Transcripts</h2>
                  {data && (
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      className="text-xs px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                    >
                      Save Current Transcript
                    </button>
                  )}
                </div>
                
                {savedTranscripts.length > 0 ? (
                  <div className="space-y-4">
                    {savedTranscripts.map((transcript) => (
                      <div key={transcript.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="p-4 flex justify-between items-center border-b border-gray-100">
                          <div>
                            <h3 className="font-medium text-gray-800">{transcript.title}</h3>
                            <p className="text-xs text-gray-500">Saved on {transcript.date}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {transcript.videoUrl && (
                              <a
                                href={transcript.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                              >
                                View Video
                              </a>
                            )}
                            <button
                              onClick={() => deleteSavedTranscript(transcript.id)}
                              className="text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50 text-red-600 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="p-4 bg-gray-50">
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Caption</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{transcript.transcript}</p>
                          </div>
                          {transcript.transcriptFromAudio && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Speech Transcript</h4>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{transcript.transcriptFromAudio}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p className="text-gray-500 mb-1">No saved transcripts yet</p>
                    <p className="text-sm text-gray-400">Your saved transcripts will appear here</p>
                  </div>
                )}
              </div>
            )}

            {/* Save Dialog */}
            {showSaveDialog && data && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Save Transcript</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="saveTitle" className="block text-sm font-medium text-gray-700 mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        id="saveTitle"
                        placeholder="Enter a title for this transcript"
                        value={saveTitle}
                        onChange={(e) => setSaveTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="text-sm text-gray-500">
                      This will save the caption, transcript, and video link for later access.
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => setShowSaveDialog(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveCurrentTranscript}
                        className="px-4 py-2 bg-blue-500 border border-transparent rounded-md text-white hover:bg-blue-600"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-10 py-4 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>Instagram Transcriber • Built with Next.js and OpenAI</p>
        </footer>
      </div>
    </div>
  );
}
