declare module 'node-whisper' {
  interface WhisperOptions {
    language?: string;
    [key: string]: unknown;
  }

  interface WhisperConfig {
    modelName: string;
    whisperOptions?: WhisperOptions;
  }

  interface TranscriptionSegment {
    text: string;
    start: number;
    end: number;
    confidence: number;
  }

  interface TranscriptionResult {
    text: string;
    segments?: TranscriptionSegment[];
    [key: string]: unknown;
  }

  class NodeWhisper {
    constructor(config: WhisperConfig);
    transcribe(audioPath: string): Promise<TranscriptionResult>;
  }

  export default NodeWhisper;
} 