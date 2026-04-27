import { Mic, MicOff } from 'lucide-react'
import { useSpeechToText } from '@/hooks/useSpeechToText'

interface SpeechMicButtonProps {
  onTranscript: (text: string) => void
  className?: string
  title?: string
}

export default function SpeechMicButton({ onTranscript, className = '', title = 'Speech to text' }: SpeechMicButtonProps) {
  const { isListening, supported, startListening, stopListening } = useSpeechToText()

  if (!supported) return null

  const handleClick = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening(onTranscript)
    }
  }

  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={handleClick}
      className={`p-1.5 rounded transition-colors ${
        isListening
          ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
          : 'hover:bg-accent text-muted-foreground'
      } ${className}`}
      title={isListening ? 'Stop listening' : title}
    >
      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  )
}
