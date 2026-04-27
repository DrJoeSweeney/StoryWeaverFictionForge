import { useState, useRef, useCallback, useEffect } from 'react'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    setSupported(!!getSpeechRecognition())
  }, [])

  const startListening = useCallback((onResult: (text: string) => void) => {
    const SR = getSpeechRecognition()
    if (!SR) return

    // Stop any existing session
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
    }

    const recognition = new SR()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = true
    recognition.interimResults = true

    let finalTranscript = ''
    let lastProcessedIndex = -1

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let newFinalText = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          if (i > lastProcessedIndex) {
            newFinalText += result[0].transcript
            lastProcessedIndex = i
          }
        } else {
          interim = result[0].transcript
        }
      }

      if (newFinalText) {
        finalTranscript += newFinalText
        onResult(newFinalText)
      }

      setTranscript(finalTranscript + interim)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // These are harmless
        return
      }
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
      setTranscript('')
      lastProcessedIndex = -1
      finalTranscript = ''
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      setIsListening(false)
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  return {
    isListening,
    transcript,
    supported,
    startListening,
    stopListening,
  }
}
