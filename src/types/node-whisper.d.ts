declare module 'node-whisper' {
  interface WhisperOptions {
    language?: string;
    [key: string]: any;
  }

  interface WhisperConfig {
    modelName: string;
    whisperOptions?: WhisperOptions;
  }

  interface TranscriptionResult {
    text: string;
    segments?: any[];
    [key: string]: any;
  }

  class NodeWhisper {
    constructor(config: WhisperConfig);
    transcribe(audioPath: string): Promise<TranscriptionResult>;
  }

  export default NodeWhisper;
} 