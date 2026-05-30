import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Blob, Squiggle, Star, Heart, Sparkle, Dot, Cloud, Bolt, SmileyPlay } from "@/components/Doodles";
import { Play, Sparkles, Zap, MessageCircle, BarChart3, Scissors, FileText, Wand2, ArrowRight, Check } from "lucide-react";

const HERO_IMG = "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/ff98e7c10cc92d77823a81dc1b12270e7682541faa43bfb068a5dc424eb4c5ab.png";
const STEP1 = "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/ab397772a2e0df998c56cab1e72347a338ca521c39c999b69666a2d6586bf525.png";
const STEP2 = "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/341144a61354b2bdb8ecb9a855fc34366be89b8d9047051d4b8207029c2a29af.png";
const STEP3 = "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/fc682641f51da4cd59abc42076a5010e6fb273ca89e80300d76049cdc14a5d56.png";
const PRICE_FREE = "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/8f05d8139599871999250512ffd32c8adc462ad98d518df5f69090c5337f8430.png";
const PRICE_PRO = "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/7c604fbac0a2a13df1cc4ac19c4c4c6b5c26de8f75b35686101a9fe01415479a.png";
const PRICE_AG = "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/64fac2fcc58a472d5e52a8c62ce609bf3690681ff4e518b7f95406ba6fd1d264.png";

const features = [
  { icon: Wand2, color: "bg-mint", title: "Smart Editing", text: "Edit by deleting words in the transcript." },
  { icon: Sparkles, color: "bg-gold", title: "Brand Player", text: "Colors, logo, thumbnails, CTAs — all yours." },
  { icon: BarChart3, color: "bg-coral", title: "Real Analytics", text: "Heatmaps that show every rewind and skip." },
  { icon: Scissors, color: "bg-mint", title: "Remix Clips", text: "Turn webinars into TikToks in one click." },
  { icon: MessageCircle, color: "bg-gold", title: "Team Reviews", text: "Time-stamped comments right on the player." },
  { icon: FileText, color: "bg-coral", title: "AI Transcripts", text: "Auto captions that boost SEO & accessibility." },
];

export default function Landing() {
  return (
    <div className="bg-cream min-h-screen">
      <Navbar />
      {/* HERO */}
      <section className="relative overflow-hidden">
        <Blob className="absolute -top-32 -right-32 w-[600px] h-[600px] opacity-60 float-slow" color="#98D8C8" />
        <Blob className="absolute top-40 -left-40 w-[400px] h-[400px] opacity-50" color="#F4D068" />
        <Star className="absolute top-32 right-32 w-16 h-16 wiggle z-10" />
        <Heart className="absolute bottom-20 left-20 w-12 h-12 float-fast z-10" />
        <Sparkle className="absolute top-40 left-1/3 w-6 h-6 float-slow z-10" />
        <Dot className="absolute bottom-32 right-1/4 w-8 h-8 float-fast z-10" />

        <div className="max-w-7xl mx-auto px-6 md:px-10 pt-16 pb-24 md:pt-24 md:pb-32 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 nb-border bg-white rounded-full px-4 py-1.5 mb-6 nb-shadow-sm">
              <Bolt className="w-4 h-4" /> <span className="font-bold text-sm">New · Smart Transcript Editor</span>
            </div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl leading-[0.95] mb-6">
              Make videos<br/>
              <span className="squiggle">people actually</span><br/>
              <span className="text-coral">finish watching.</span>
            </h1>
            <p className="text-xl text-ink/80 mb-8 max-w-lg">
              Looma is the friendly video studio for marketers. Record, edit, brand, and measure — without the steep learning curve.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/signup" className="nb-btn text-lg" data-testid="hero-cta-start">
                <Play size={18} fill="white"/> Start free
              </Link>
              <Link to="/features" className="nb-btn nb-btn-ghost text-lg" data-testid="hero-cta-tour">
                Take the tour <ArrowRight size={18}/>
              </Link>
            </div>
            <div className="flex items-center gap-6 mt-10 text-sm">
              <div className="flex items-center gap-1.5"><Check size={16} className="text-coral"/> No credit card</div>
              <div className="flex items-center gap-1.5"><Check size={16} className="text-coral"/> 14-day Pro trial</div>
              <div className="flex items-center gap-1.5"><Check size={16} className="text-coral"/> Cancel anytime</div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gold rounded-[2.5rem] -rotate-3"></div>
            <div className="relative nb-border bg-white rounded-[2.5rem] nb-shadow-lg p-6 rotate-2">
              <img src={HERO_IMG} alt="Looma video studio" className="w-full h-auto rounded-2xl" />
              <div className="absolute -bottom-6 -left-6 nb-border bg-coral text-white rounded-2xl px-4 py-3 nb-shadow font-heading rotate-[-6deg]">
                <div className="text-xs opacity-90">Avg engagement</div>
                <div className="text-2xl">+47% ↑</div>
              </div>
              <div className="absolute -top-6 -right-6 nb-border bg-mint rounded-2xl px-4 py-3 nb-shadow font-heading rotate-[8deg]">
                <div className="text-xs">Viewers love it</div>
                <div className="text-xl flex items-center gap-1">4.9 <Star className="w-4 h-4"/></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOGOS / TRUST */}
      <section className="border-y-2 border-ink bg-white py-10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="font-hand text-2xl mb-6">Used by playful teams at —</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-14 opacity-80">
            {["Honeycomb", "Sunbeam", "Pixelpop", "Rocketship", "Cloudy Co"].map(n => (
              <span key={n} className="font-heading text-xl text-ink/70">{n}</span>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 md:py-32 relative">
        <Cloud className="absolute top-12 left-10 w-24 h-16 float-slow" />
        <Sparkle className="absolute top-32 right-20 w-8 h-8" />
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-16">
            <div className="font-hand text-3xl text-coral mb-2">it's this simple</div>
            <h2 className="font-heading text-4xl md:text-5xl">How Looma works</h2>
            <p className="text-lg text-ink/70 mt-3 max-w-2xl mx-auto">Three steps. No video degree required.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: 1, img: STEP1, color: "bg-mint", title: "Record or upload", text: "Use our built-in webcam & screen recorder, or drag in any file." },
              { n: 2, img: STEP2, color: "bg-gold", title: "Edit by typing", text: "Delete words in the transcript — the video updates instantly." },
              { n: 3, img: STEP3, color: "bg-coral", title: "Share & track", text: "Embed anywhere with a player that matches your brand." },
            ].map(s => (
              <div key={s.n} className="nb-card relative">
                <div className="absolute -top-5 -left-5 w-12 h-12 rounded-full nb-border bg-ink text-white font-heading text-xl flex items-center justify-center nb-shadow-sm">{s.n}</div>
                <div className={`${s.color} rounded-2xl nb-border p-4 mb-5`}>
                  <img src={s.img} alt={s.title} className="w-full h-44 object-contain"/>
                </div>
                <h3 className="font-heading text-2xl mb-2">{s.title}</h3>
                <p className="text-ink/80">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section className="py-24 bg-mint border-y-2 border-ink relative overflow-hidden">
        <Heart className="absolute top-10 right-10 w-14 h-14 float-fast" />
        <Star className="absolute bottom-10 left-10 w-12 h-12 wiggle" />
        <div className="max-w-7xl mx-auto px-6 md:px-10 relative">
          <div className="text-center mb-14">
            <h2 className="font-heading text-4xl md:text-5xl">Everything your video<br/>workflow needs</h2>
            <p className="text-lg text-ink/80 mt-3">Six superpowers, one cheerful platform.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="nb-card hover:-translate-y-1 transition-transform" data-testid={`feature-card-${i}`}>
                <div className={`${f.color} w-14 h-14 rounded-2xl nb-border flex items-center justify-center mb-4`}>
                  <f.icon size={26} strokeWidth={2.5}/>
                </div>
                <h3 className="font-heading text-xl mb-2">{f.title}</h3>
                <p className="text-ink/80">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to="/features" className="nb-btn nb-btn-dark">See all features <ArrowRight size={18}/></Link>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-24 md:py-32 relative">
        <Sparkle className="absolute top-20 left-1/4 w-6 h-6"/>
        <Dot className="absolute bottom-20 right-1/3 w-8 h-8"/>
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <div className="font-hand text-3xl text-coral mb-2">pick your plan</div>
            <h2 className="font-heading text-4xl md:text-5xl">Simple, cheerful pricing</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Starter", price: "Free", img: PRICE_FREE, bg: "bg-white", coral: false, perks: ["10 videos", "Looma branding", "Basic analytics", "1 seat"], cta: "Start free" },
              { name: "Pro", price: "$29", per:"/mo", img: PRICE_PRO, bg: "bg-coral text-white", coral: true, perks: ["Unlimited videos", "Custom branding", "Heatmaps + CRM sync", "5 seats", "AI transcripts"], cta: "Start Pro trial", badge: "Most loved" },
              { name: "Agency", price: "$99", per:"/mo", img: PRICE_AG, bg: "bg-white", coral: false, perks: ["Everything in Pro", "White-label player", "Webinars + Channels", "20 seats", "Priority support"], cta: "Talk to us" },
            ].map(p => (
              <div key={p.name} className={`relative nb-border rounded-3xl ${p.bg} p-8 nb-shadow-lg ${p.coral ? 'lg:-translate-y-4' : ''}`}>
                {p.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 nb-border bg-gold text-ink font-heading rounded-full px-4 py-1 nb-shadow-sm text-sm">{p.badge}</div>
                )}
                <div className={`${p.coral ? 'bg-white/20' : 'bg-mint'} rounded-2xl nb-border p-3 mb-5`}>
                  <img src={p.img} alt={p.name} className="w-full h-32 object-contain"/>
                </div>
                <h3 className="font-heading text-2xl mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="font-heading text-5xl">{p.price}</span>
                  {p.per && <span className="opacity-80">{p.per}</span>}
                </div>
                <ul className="space-y-2 mb-7">
                  {p.perks.map(pk => (
                    <li key={pk} className="flex items-start gap-2"><Check size={18} className="mt-0.5 shrink-0"/> {pk}</li>
                  ))}
                </ul>
                <Link to="/signup" className={`nb-btn w-full ${p.coral ? 'nb-btn-gold' : ''}`} data-testid={`price-cta-${p.name.toLowerCase()}`}>{p.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="nb-border bg-gold rounded-[2.5rem] nb-shadow-lg p-10 md:p-16 text-center relative overflow-hidden">
            <SmileyPlay className="absolute -top-6 -left-6 w-24 h-24 wiggle"/>
            <Star className="absolute top-6 right-10 w-12 h-12"/>
            <h2 className="font-heading text-4xl md:text-5xl mb-4">Your video story starts here.</h2>
            <p className="text-lg mb-7 max-w-xl mx-auto">Get a free Looma account in 30 seconds. Promise we're nice.</p>
            <Link to="/signup" className="nb-btn nb-btn-dark text-lg" data-testid="bottom-cta-signup">
              Create my Looma <ArrowRight size={18}/>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
