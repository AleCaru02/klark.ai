import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Pause, Volume2, Phone, User, Bot } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface CallDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: string | null;
  contactName: string | null;
  phone: string;
  direction: "inbound" | "outbound";
  duration: number;
  createdAt: Date;
  recordingUrl: string | null;
  transcript: string | null;
  outcome: string | null;
}

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

function parseTranscript(transcript: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  // Split by "Assistente:" or "Utente:" / "Cliente:"
  const lines = transcript.split(/\n/).filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("Assistente:")) {
      messages.push({ role: "assistant", text: trimmed.replace("Assistente:", "").trim() });
    } else if (trimmed.startsWith("Utente:") || trimmed.startsWith("Cliente:")) {
      messages.push({ role: "user", text: trimmed.replace(/^(Utente|Cliente):/, "").trim() });
    } else if (messages.length > 0) {
      // Continuation of previous message
      messages[messages.length - 1].text += " " + trimmed;
    } else {
      messages.push({ role: "assistant", text: trimmed });
    }
  }
  return messages;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function CallDetailDialog({
  open, onOpenChange, contactName, phone, direction,
  duration, createdAt, recordingUrl, transcript, outcome,
}: CallDetailDialogProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const messages = transcript ? parseTranscript(transcript) : [];

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [open]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              direction === "inbound" ? "bg-success/10" : "bg-primary/10"
            )}>
              <Phone className={cn("w-4 h-4", direction === "inbound" ? "text-success" : "text-primary")} />
            </div>
            <div>
              <p className="text-base font-semibold">{contactName || phone}</p>
              <p className="text-sm text-muted-foreground font-normal">
                {direction === "inbound" ? "In arrivo" : "In uscita"} • {formatDuration(duration)} •{" "}
                {createdAt.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Audio Player */}
        {recordingUrl && (
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <audio
              ref={audioRef}
              src={recordingUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => {
                if (audioRef.current) setAudioDuration(audioRef.current.duration);
              }}
              onEnded={() => setIsPlaying(false)}
            />
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={togglePlay}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </Button>
              <div className="flex-1 space-y-1">
                <Slider
                  value={[currentTime]}
                  max={audioDuration || duration || 1}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatDuration(Math.floor(currentTime))}</span>
                  <span>{formatDuration(Math.floor(audioDuration || duration))}</span>
                </div>
              </div>
              <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </div>
        )}

        {!recordingUrl && (
          <div className="bg-muted/30 rounded-xl p-4 text-center text-sm text-muted-foreground">
            <Volume2 className="w-5 h-5 mx-auto mb-1 opacity-50" />
            Registrazione non disponibile
          </div>
        )}

        {/* Chat Transcript */}
        <div className="flex-1 min-h-0">
          <p className="text-sm font-medium mb-2">Trascrizione</p>
          {messages.length > 0 ? (
            <ScrollArea className="h-[300px] pr-2">
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-2", msg.role === "assistant" ? "justify-start" : "justify-end")}>
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "assistant"
                        ? "bg-muted text-foreground rounded-tl-md"
                        : "bg-primary text-primary-foreground rounded-tr-md"
                    )}>
                      {msg.text}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nessuna trascrizione disponibile
            </div>
          )}
        </div>

        {outcome && (
          <div className="pt-2 border-t">
            <Badge variant="secondary">{outcome}</Badge>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
