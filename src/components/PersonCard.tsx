import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { resolveUrl } from "@/lib/api";

interface PersonCardProps {
  name: string;
  avatar: string;
  photoCount: number;
  onClick?: () => void;
}

export function PersonCard({ name, avatar, photoCount, onClick }: PersonCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-primary/30"
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center gap-3 p-6">
        <Avatar className="h-20 w-20 ring-2 ring-primary/20">
          <AvatarImage src={resolveUrl(avatar)} alt={name} />
          <AvatarFallback className="gradient-primary text-primary-foreground text-xl font-bold">
            {name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="font-semibold text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">{photoCount} photos</p>
        </div>
      </CardContent>
    </Card>
  );
}
