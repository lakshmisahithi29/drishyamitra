import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Camera, Search, Users, FolderHeart, MessageCircle, ArrowRight, Sparkles } from "lucide-react";

const features = [
  { icon: Search, title: "AI-Powered Search", desc: "Find any photo instantly with natural language queries." },
  { icon: Users, title: "People Recognition", desc: "Auto-detect and group faces across your entire library." },
  { icon: FolderHeart, title: "Smart Albums", desc: "Automatically organized albums based on events & context." },
  { icon: MessageCircle, title: "Chat Assistant", desc: "Ask your AI assistant anything about your photos." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="gradient-primary rounded-lg p-1.5">
              <Camera className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl gradient-text">Drishyamitra</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Login</Link>
            <Link to="/signup">
              <Button className="gradient-primary text-primary-foreground rounded-full px-6">Get Started</Button>
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login" className="md:hidden">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-20 md:py-32 text-center">
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            AI-Powered Photo Management
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Your Intelligent{" "}
            <span className="gradient-text">AI Photo</span>{" "}
            Assistant
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Drishyamitra helps you organize, search, and rediscover your photos with the power of artificial intelligence. Beautiful, fast, and effortless.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/signup">
              <Button size="lg" className="gradient-primary text-primary-foreground rounded-full px-8 text-base shadow-lg hover:shadow-xl transition-shadow">
                Start Free <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="rounded-full px-8 text-base">
                Learn More
              </Button>
            </a>
          </div>
        </div>


      </section>

      {/* Features */}
      <section id="features" className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Powerful Features</h2>
          <p className="text-muted-foreground mt-3 text-lg">Everything you need to manage your photo library intelligently.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group p-6 rounded-2xl border border-border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in opacity-0"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="gradient-primary inline-flex rounded-xl p-3 mb-4 group-hover:shadow-md transition-shadow">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="gradient-primary rounded-lg p-1">
              <Camera className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold gradient-text">Drishyamitra</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2025 Drishyamitra. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
