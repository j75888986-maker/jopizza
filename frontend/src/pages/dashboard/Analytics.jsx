import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Eye, Play, Users, TrendingUp } from "lucide-react";

const heat = Array.from({ length: 30 }, (_, i) => ({ s: i*10, v: 30 + Math.random()*70 }));

export default function Analytics() {
  const { authHeader, API } = useAuth();
  const [stats, setStats] = useState(null);
  useEffect(() => { axios.get(`${API}/analytics/overview`, { headers: authHeader() }).then(r=>setStats(r.data)).catch(()=>{}); }, [API, authHeader]);

  const cards = [
    { label: "Plays this week", val: stats?.total_plays || 1024, icon: Play, color: "bg-coral text-white", change:"+12%" },
    { label: "Unique viewers", val: 387, icon: Users, color: "bg-mint", change:"+8%" },
    { label: "Avg watch", val: "1m 42s", icon: TrendingUp, color: "bg-gold", change:"+22%" },
    { label: "Engagement", val: "68%", icon: Eye, color: "bg-white", change:"+4%" },
  ];

  return (
    <div className="p-8 md:p-10 max-w-7xl">
      <div className="mb-7">
        <div className="font-hand text-2xl text-coral">the data speaks</div>
        <h1 className="font-heading text-4xl">Analytics</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className={`${c.color} nb-border rounded-2xl p-5 nb-shadow-sm`}>
            <div className="flex justify-between items-center mb-3"><c.icon size={22} strokeWidth={2.5}/><span className="text-xs font-bold opacity-80">{c.change}</span></div>
            <div className="font-heading text-3xl">{c.val}</div>
            <div className="text-sm opacity-80">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="nb-card">
          <h3 className="font-heading text-xl mb-4">Plays & views (last 7 days)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={stats?.trend || []}>
              <CartesianGrid stroke="#12112433" strokeDasharray="3 3"/>
              <XAxis dataKey="day" stroke="#121124" style={{ fontFamily:'Nunito', fontWeight:700 }}/>
              <YAxis stroke="#121124"/>
              <Tooltip contentStyle={{ border:'2px solid #121124', borderRadius:'12px', boxShadow:'4px 4px 0 0 #121124' }}/>
              <Line type="monotone" dataKey="views" stroke="#FF6B6B" strokeWidth={3} dot={{ fill:'#FF6B6B', stroke:'#121124', strokeWidth:2, r:5 }}/>
              <Line type="monotone" dataKey="plays" stroke="#98D8C8" strokeWidth={3} dot={{ fill:'#98D8C8', stroke:'#121124', strokeWidth:2, r:5 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="nb-card">
          <h3 className="font-heading text-xl mb-4">Viewer heatmap (sample video)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={heat}>
              <CartesianGrid stroke="#12112433" strokeDasharray="3 3"/>
              <XAxis dataKey="s" stroke="#121124"/>
              <YAxis stroke="#121124"/>
              <Tooltip contentStyle={{ border:'2px solid #121124', borderRadius:'12px' }}/>
              <Bar dataKey="v" fill="#F4D068" stroke="#121124" strokeWidth={1.5}/>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-sm text-ink/70 mt-3">Yellow peaks = sections viewers rewatched. Dips = where they dropped off.</p>
        </div>
      </div>
    </div>
  );
}
