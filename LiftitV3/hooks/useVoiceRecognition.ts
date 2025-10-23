'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognitionResult {
  isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition
    webkitSpeechRecognition: new () => ISpeechRecognition
  }
}

export type VoiceRecognitionStatus = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported'

interface UseVoiceRecognitionOptions {
  continuous?: boolean
  interimResults?: boolean
  lang?: string
  onTranscript?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
}

interface UseVoiceRecognitionReturn {
  transcript: string
  interimTranscript: string
  isListening: boolean
  isSupported: boolean
  status: VoiceRecognitionStatus
  error: string | null
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}): UseVoiceRecognitionReturn {
  const {
    continuous = false,
    interimResults = true,
    lang = 'en-US',
    onTranscript,
    onError
  } = options

  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [status, setStatus] = useState<VoiceRecognitionStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onErrorRef.current = onError
  })

  // Check browser compatibility and initialize recognition
  useEffect(() => {
    // Add a small delay to ensure window object is fully loaded
    const checkSupport = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      
      console.log('Checking browser support:', { 
        SpeechRecognition: !!SpeechRecognition,
        webkitSpeechRecognition: !!window.webkitSpeechRecognition,
        SpeechRecognitionStandard: !!window.SpeechRecognition,
        userAgent: navigator.userAgent,
        isSecureContext: window.isSecureContext
      })
      
      if (SpeechRecognition) {
        console.log('Speech recognition is supported')
        setIsSupported(true)
        if (!recognitionRef.current) {
          try {
            recognitionRef.current = new SpeechRecognition()
            console.log('Speech recognition instance created successfully')
          } catch (error) {
            console.error('Failed to create speech recognition instance:', error)
            setIsSupported(false)
            setError('Failed to initialize speech recognition')
            return
          }
        }
      } else {
        console.log('Speech recognition is not supported in this browser')
        setIsSupported(false)
        setStatus('unsupported')
        setError('Speech recognition is not supported in this browser.')
        return
      }
      
      const recognition = recognitionRef.current
      recognition.continuous = continuous
      recognition.interimResults = interimResults
      recognition.lang = lang
      recognition.maxAlternatives = 1

      // Handle recognition results
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimText = ''
        let finalText = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcriptText = result[0].transcript

          if (result.isFinal) {
            finalText += transcriptText + ' '
          } else {
            interimText += transcriptText
          }
        }

        if (finalText) {
          setTranscript(prev => (prev + finalText).trim())
          setInterimTranscript('')
          setStatus('processing')
          onTranscriptRef.current?.(finalText.trim(), true)
        } else if (interimText) {
          setInterimTranscript(interimText)
          onTranscriptRef.current?.(interimText, false)
        }
      }

      // Handle errors
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Aborted errors are often intentional (user stopped, tab switch, etc.)
        // Don't treat them as errors unless we have other context
        if (event.error === 'aborted') {
          setIsListening(false)
          setStatus('idle')
          return
        }

        let errorMessage = 'An error occurred'
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected. Please try again.'
            break
          case 'audio-capture':
            errorMessage = 'No microphone found. Please ensure your microphone is connected.'
            break
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.'
            break
          case 'network':
            errorMessage = 'Network error occurred. Please check your connection.'
            break
          default:
            errorMessage = `Error: ${event.error}`
        }

        setError(errorMessage)
        setStatus('error')
        setIsListening(false)
        onErrorRef.current?.(errorMessage)
      }

      // Handle end of recognition
      recognition.onend = () => {
        setIsListening(false)
        setStatus('idle')
      }

      // Handle start of recognition
      recognition.onstart = () => {
        setIsListening(true)
        setStatus('listening')
        setError(null)
      }
    }

    // Call the support check function
    checkSupport()

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Ignore errors on cleanup
        }
      }
    }
  }, [continuous, interimResults, lang])

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError('Speech recognition is not supported in this browser.')
      return
    }

    // Prevent multiple instances from running
    if (isListening) {
      return
    }

    try {
      setError(null)
      setTranscript('')
      setInterimTranscript('')
      recognitionRef.current.start()
    } catch (err) {
      if (err instanceof Error && err.message.includes('already started')) {
        // Already running, stop and restart
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Ignore stop errors
        }
        setTimeout(() => {
          try {
            if (recognitionRef.current) {
              recognitionRef.current.start()
            }
          } catch (e) {
            console.error('Failed to restart recognition:', e)
            setError('Failed to start voice recognition')
            setStatus('error')
          }
        }, 100)
      } else {
        setError('Failed to start voice recognition')
        setStatus('error')
      }
    }
  }, [isSupported, isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        // Immediately update state to prevent UI flicker
        setIsListening(false)
        setStatus('idle')
      } catch (err) {
        // Silently handle stop errors - they're usually harmless
        console.debug('Stop recognition (expected):', err)
        // Still update state even if stop failed
        setIsListening(false)
        setStatus('idle')
      }
    }
  }, [])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    setError(null)
    setStatus('idle')
  }, [])

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    status,
    error,
    startListening,
    stopListening,
    resetTranscript
  }
}

