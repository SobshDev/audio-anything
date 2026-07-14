export type AudioFormat =
  | "mp3_22050_32"
  | "mp3_44100_32"
  | "mp3_44100_64"
  | "mp3_44100_96"
  | "mp3_44100_128"
  | "mp3_44100_192"
  | "pcm_16000"
  | "pcm_22050"
  | "pcm_24000"
  | "pcm_44100"
  | "ulaw_8000"

export type VoiceSettings = {
  stability?: number
  similarityBoost?: number
  style?: number
  useSpeakerBoost?: boolean
  speed?: number
}

export type SynthesizeSpeechInput = {
  text: string
  voiceId: string
  modelId?: string
  outputFormat?: AudioFormat
  languageCode?: string
  voiceSettings?: VoiceSettings
  seed?: number
  previousText?: string
  nextText?: string
  previousRequestIds?: Array<string>
  nextRequestIds?: Array<string>
}

export type SynthesizedSpeech = {
  audio: Blob
  contentType: string
  requestId: string | null
}

export type DialogueInput = {
  text: string
  voiceId: string
}

export interface TextToSpeechProvider {
  synthesize: (input: SynthesizeSpeechInput) => Promise<SynthesizedSpeech>
}
