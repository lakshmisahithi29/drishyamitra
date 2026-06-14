import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { PersonCard } from "@/components/PersonCard";
import { PhotoCard } from "@/components/PhotoCard";
import { fetchPersons, fetchPersonPhotos, type Person, type Photo } from "@/lib/api";
import { Search, ArrowLeft, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function People() {
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [personPhotos, setPersonPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    fetchPersons()
      .then(setPeople)
      .catch(() => setPeople([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSelectPerson = async (person: Person) => {
    setSelectedPerson(person);
    setLoadingPhotos(true);
    try {
      const photos = await fetchPersonPhotos(person.id);
      setPersonPhotos(photos);
    } catch {
      setPersonPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedPerson) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedPerson(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{selectedPerson.name}'s Photos</h1>
        </div>
        {loadingPhotos ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : personPhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {personPhotos.map((photo) => (
              <PhotoCard key={photo.id} id={photo.id} url={photo.url} title={photo.title} isFavorite={photo.is_favorite} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No photos found for this person.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">People</h1>
        <p className="text-muted-foreground mt-1">People detected in your photos.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search people..."
          className="pl-9 bg-muted/50 border-0"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((person) => (
            <PersonCard
              key={person.id}
              name={person.name}
              avatar={person.avatar || ""}
              photoCount={person.photoCount}
              onClick={() => handleSelectPerson(person)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="gradient-primary rounded-full p-4 mb-4">
            <Users className="h-8 w-8 text-primary-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No people found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {people.length === 0 ? "Upload photos with faces to see people here." : "Try a different search term."}
          </p>
        </div>
      )}
    </div>
  );
}
