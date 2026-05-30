import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Star, Heart, Sparkle } from "@/components/Doodles";

const tiers = [
  { name: "Starter", price: "Free", img: "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/8f05d8139599871999250512ffd32c8adc462ad98d518df5f69090c5337f8430.png",
    perks: ["10 videos", "Basic player customization", "Standard analytics", "1 seat", "Looma branding"], cta: "Start free" },
  { name: "Pro", price: "$29", per:"/mo", img: "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/7c604fbac0a2a13df1cc4ac19c4c4c6b5c26de8f75b35686101a9fe01415479a.png",
    perks: ["Unlimited videos", "Full brand customization", "Heatmaps & CRM sync", "Lead capture & CTAs", "5 seats", "AI transcripts"], cta: "Start Pro trial", featured: true, badge: "Most loved" },
  { name: "Agency", price: "$99", per:"/mo", img: "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/64fac2fcc58a472d5e52a8c62ce609bf3690681ff4e518b7f95406ba6fd1d264.png",
    perks: ["Everything in Pro", "White-label player", "Webinars + Channels", "20 seats", "Priority support", "SSO"], cta: "Talk to us" },
];

const faqs = [
  { q: "Can I switch plans anytime?", a: "Yes — upgrade or downgrade whenever. We prorate the difference." },
  { q: "Do you offer annual billing?", a: "We do, and you save two months when you pay annually." },
  { q: "Is there a free trial of Pro?", a: "Every new account gets 14 days of Pro features on the house." },
  { q: "How does the heatmap work?", a: "We record which seconds get rewatched or skipped, then visualize it as a soft heat-strip below the timeline." },
];

export default function Pricing() {
  return (
    <div className="bg-cream min-h-screen">
      <Navbar />
      <section className="relative pt-16 pb-10 md:pt-24 text-center">
        <Star className="absolute top-16 right-16 w-12 h-12 wiggle"/>
        <Heart className="absolute top-32 left-16 w-10 h-10 float-slow"/>
        <Sparkle className="absolute bottom-4 right-1/4 w-6 h-6"/>
        <div className="max-w-3xl mx-auto px-6">
          <div className="font-hand text-3xl text-coral mb-2">no surprises</div>
          <h1 className="font-heading text-5xl md:text-6xl mb-4">Cheerful pricing.</h1>
          <p className="text-lg text-ink/80">Pick a plan that fits today. Change your mind tomorrow.</p>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 grid md:grid-cols-3 gap-8">
          {tiers.map(t => (
            <div key={t.name} className={`relative nb-border rounded-3xl nb-shadow-lg p-8 ${t.featured ? 'bg-coral text-white lg:-translate-y-4' : 'bg-white'}`} data-testid={`pricing-tier-${t.name.toLowerCase()}`}>
              {t.badge && <div className="absolute -top-4 left-1/2 -translate-x-1/2 nb-border bg-gold text-ink rounded-full px-4 py-1 font-heading text-sm nb-shadow-sm">{t.badge}</div>}
              <div className={`${t.featured ? 'bg-white/20' : 'bg-mint'} rounded-2xl nb-border p-3 mb-5`}>
                <img src={t.img} alt={t.name} className="w-full h-36 object-contain"/>
              </div>
              <h3 className="font-heading text-2xl mb-1">{t.name}</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="font-heading text-5xl">{t.price}</span>
                {t.per && <span className="opacity-80">{t.per}</span>}
              </div>
              <ul className="space-y-2.5 mb-7">
                {t.perks.map(p => <li key={p} className="flex items-start gap-2"><Check size={18} className="mt-0.5 shrink-0"/> {p}</li>)}
              </ul>
              <Link to="/signup" className={`nb-btn w-full ${t.featured ? 'nb-btn-gold' : ''}`}>{t.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 bg-mint border-y-2 border-ink">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-heading text-4xl text-center mb-10">Common questions</h2>
          <div className="space-y-4">
            {faqs.map(f => (
              <details key={f.q} className="nb-card group">
                <summary className="font-heading text-lg cursor-pointer flex justify-between items-center">{f.q}<span className="group-open:rotate-45 transition text-2xl">+</span></summary>
                <p className="mt-3 text-ink/80">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
