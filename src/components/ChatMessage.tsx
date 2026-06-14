import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Camera, User, ExternalLink } from "lucide-react";
import { resolveUrl } from "@/lib/api";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

export function ChatMessage({ role, content, images }: ChatMessageProps) {
  return (
    <div className={cn("flex gap-3 animate-fade-in", role === "user" ? "flex-row-reverse" : "flex-row")}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(
          "text-xs font-bold",
          role === "assistant" ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {role === "assistant" ? <Camera className="h-4 w-4" /> : <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "max-w-[75%] space-y-3",
          role === "user" ? "text-right" : "text-left"
        )}
      >
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            role === "user"
              ? "gradient-primary text-primary-foreground rounded-tr-md"
              : "bg-muted text-foreground rounded-tl-md"
          )}
        >
          {content}
        </div>

        {images && images.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-2 max-w-sm">
            {images.map((img, i) => (
              <div key={i} className="group relative rounded-lg overflow-hidden border border-border aspect-square bg-muted">
                <img
                  src={resolveUrl(img)}
                  className="w-full h-full object-cover transition-transform hover:scale-110"
                  alt="Assistant shared photo"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <ExternalLink className="h-5 w-5 text-white" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="gradient-primary text-primary-foreground">
          <Camera className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3 flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
