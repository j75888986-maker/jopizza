import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Wand2, Palette, BarChart3, Scissors, MessageCircle, FileText, Check, ArrowRight } from "lucide-react";
import { Squiggle, Star, Heart, Sparkle, Cloud } from "@/components/Doodles";

const blocks = [
  { id: "editing", icon: Wand2, color: "bg-mint", title: "Editing without a steep learning curve",
    desc: "Skip timelines and shuttle wheels. Looma auto-transcribes your video, then lets you cut by editing text. Highlight a sentence, hit delete, watch the clip update in real time.",
    bullets: ["Text-based cutting that feels like Google Docs", "Stitch multiple clips, add royalty-free music", "Smooth transitions, all in the browser"] },
  { id: "customization", icon: Palette, color: "bg-gold", title: "A player that looks like *you*",
    desc: "Make every embed feel like it was always part of your site. Set colors, drop in a logo, choose a thumbnail, and add lead-capture forms or CTAs that fire mid-video.",
    bullets: ["Brand-wide color, logo and thumbnail presets", "Lead forms & CTAs inside the video", "Password protection & private sharing"] },
  { id: "analytics", icon: BarChart3, color: "bg-coral", title: "Analytics beyond view counts",
    desc: "See exactly when someone replayed a section, skipped ahead, or bounced. Looma turns viewing behavior into lead scores and follow-up triggers your CRM can act on.",
    bullets: ["Second-by-second viewer heatmaps", "CRM sync for lead scoring & nurture", "Engagement-based segments"] },
  { id: "repurposing", icon: Scissors, color: "bg-mint", title: "One long video, ten shareable moments",
    desc: "Turn a 60-minute webinar into a week of short-form content. Remix finds the highlights, auto-reframes for vertical formats, and even publishes audio as a podcast.",
    bullets: ["Auto-detect highlight moments", "Vertical reframes for Reels, Shorts & TikTok", "Podcast distribution to Apple & Spotify"] },
  { id: "feedback", icon: MessageCircle, color: "bg-gold", title: "Feedback that lands where it matters",
    desc: "Stop pasting timestamps in Slack. Teammates and clients leave comments right on the video, resolve them inside the editor, and ship the final cut faster.",
    bullets: ["Time-coded comments anyone can leave", "Review threads next to the editor", "Approvals tracked in one place"] },
  { id: "transcripts", icon: FileText, color: "bg-coral", title: "Transcripts that earn their keep",
    desc: "Every Looma video gets a sharp, time-coded transcript. Use it as captions, paste it into a blog post, or let viewers click a paragraph to jump straight to that moment.",
    bullets: ["Highly accurate AI captions", "SEO-friendly transcripts on your pages", "Click-to-jump moments for viewers"] },
];

export default function Features() {
  return (
    <div className="bg-cream min-h-screen">
      <Navbar />
      <section className="relative pt-16 pb-12 md:pt-24 md:pb-16">
        <Star className="absolute top-16 right-16 w-12 h-12 wiggle"/>
        <Cloud className="absolute top-24 left-10 w-24 h-16 float-slow"/>
        <Sparkle className="absolute bottom-4 right-1/3 w-6 h-6"/>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="font-hand text-3xl text-coral mb-2">six superpowers, one studio</div>
          <h1 className="font-heading text-5xl md:text-6xl mb-5 leading-[1.05]">
            Everything you need to <span className="squiggle">ship videos</span><br/>your audience actually loves.
          </h1>
          <p className="text-lg md:text-xl text-ink/80 max-w-2xl mx-auto">From the first take to the final analytics deep-dive, Looma stays out of your way and makes the boring parts fun.</p>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-6 md:px-10 space-y-16 md:space-y-24">
          {blocks.map((b, i) => (
            <div key={b.id} id={b.id} className={`grid md:grid-cols-2 gap-10 items-center ${i%2 ? 'md:[&>*:first-child]:order-2' : ''}`}>
              <div>
                <div className={`${b.color} w-16 h-16 rounded-2xl nb-border flex items-center justify-center mb-5`}>
                  <b.icon size={28} strokeWidth={2.5}/>
                </div>
                <h2 className="font-heading text-3xl md:text-4xl mb-4">{b.title}</h2>
                <p className="text-ink/80 text-lg mb-5">{b.desc}</p>
                <ul className="space-y-2.5">
                  {b.bullets.map(x => <li key={x} className="flex items-start gap-2"><Check className="text-coral mt-1 shrink-0" size={18}/> <span>{x}</span></li>)}
                </ul>
              </div>
              <div className="relative">
                <div className={`absolute inset-0 ${b.color} rounded-[2rem] -rotate-2`}></div>
                <div className="relative nb-border bg-white rounded-[2rem] nb-shadow-lg p-6 rotate-1 min-h-[280px] flex items-center justify-center">
                  <b.icon size={120} strokeWidth={1.5} className="text-ink/15"/>
                  <Heart className="absolute -top-5 -right-5 w-12 h-12 wiggle"/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="nb-border bg-coral text-white rounded-[2.5rem] nb-shadow-lg p-10 md:p-14 text-center">
            <h2 className="font-heading text-4xl md:text-5xl mb-3">Start building better videos.</h2>
            <p className="text-lg opacity-90 mb-7">Free to start. No credit card. Bring snacks if you want.</p>
            <Link to="/signup" className="nb-btn nb-btn-gold text-lg" data-testid="features-cta">
              Create my free account <ArrowRight size={18}/>
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
