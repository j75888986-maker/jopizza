import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import Features from "@/pages/Features";
import Pricing from "@/pages/Pricing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AuthCallback from "@/pages/AuthCallback";
import PublicViewer from "@/pages/PublicViewer";
import PublicWebinar from "@/pages/PublicWebinar";
import DashHome from "@/pages/dashboard/Home";
import ContentLibrary from "@/pages/dashboard/ContentLibrary";
import Webinars from "@/pages/dashboard/Webinars";
import WebinarHost from "@/pages/dashboard/WebinarHost";
import Channels from "@/pages/dashboard/Channels";
import Analytics from "@/pages/dashboard/Analytics";
import Remix from "@/pages/dashboard/Remix";
import EditPage from "@/pages/dashboard/Edit";
import Brand from "@/pages/dashboard/Brand";
import Studio from "@/pages/dashboard/Studio";
import DashboardLayout from "@/components/DashboardLayout";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-cream">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/v/:id" element={<PublicViewer />} />
          <Route path="/embed/:id" element={<PublicViewer embed />} />
          <Route path="/webinar/:id" element={<PublicWebinar />} />
          <Route path="/app" element={<Protected><DashboardLayout /></Protected>}>
            <Route index element={<DashHome />} />
            <Route path="library" element={<ContentLibrary />} />
            <Route path="webinars" element={<Webinars />} />
            <Route path="webinars/:id" element={<WebinarHost />} />
            <Route path="channels" element={<Channels />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="remix" element={<Remix />} />
            <Route path="edit" element={<EditPage />} />
            <Route path="brand" element={<Brand />} />
            <Route path="studio/:id" element={<Studio />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
