import { Link } from "react-router-dom";
import { Heart, Star, Sparkle } from "./Doodles";

export default function Footer() {
  return (
    <footer className="border-t-2 border-ink bg-mint relative overflow-hidden">
      <Star className="w-12 h-12 absolute top-8 right-12 wiggle" />
      <Heart className="w-10 h-10 absolute bottom-12 left-12 float-slow" />
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-16 grid md:grid-cols-4 gap-10 relative">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-coral nb-border flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span className="font-heading text-2xl">Looma</span>
          </div>
          <p className="max-w-md text-ink/80">Friendly video hosting & marketing for teams who want their videos to actually <span className="font-hand text-2xl text-coral">work</span>.</p>
        </div>
        <div>
          <div className="font-heading text-lg mb-3">Product</div>
          <ul className="space-y-2">
            <li><Link to="/features" className="hover:text-coral">Features</Link></li>
            <li><Link to="/pricing" className="hover:text-coral">Pricing</Link></li>
            <li><Link to="/signup" className="hover:text-coral">Get started</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-heading text-lg mb-3">Company</div>
          <ul className="space-y-2">
            <li><a href="#" className="hover:text-coral">About</a></li>
            <li><a href="#" className="hover:text-coral">Blog</a></li>
            <li><a href="#" className="hover:text-coral">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t-2 border-ink py-5 text-center text-sm font-bold flex items-center justify-center gap-2">
        <Sparkle className="w-4 h-4"/> Made with love · © 2026 Looma <Sparkle className="w-4 h-4"/>
      </div>
    </footer>
  );
}
