import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Bookmark, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, Compass, ExternalLink, Eye, EyeOff, Filter, GraduationCap, Heart,
  LayoutDashboard, LogOut, Menu, MessageCircle, Moon, Pencil, Plus, Search, Settings, Shield, Sparkles,
  Star, Sun, Target, Users, Wallet, X, Zap,
} from "lucide-react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useApp, type ExchangeRequest, type LearningSession, type Skill, type SkillMatch, type Student } from "./context/AppContext";
import { apiConfigured, apiDelete, apiGet, apiLogin, apiPatch, apiPost, apiRegister, type ApiSkill } from "./services/api";

const navigation = [
  { label: "Overview", to: "/app", icon: LayoutDashboard },
  { label: "Explore skills", to: "/explore", icon: Compass },
  { label: "AI matches", to: "/matches", icon: Sparkles },
  { label: "My listings", to: "/my-listings", icon: Bookmark },
  { label: "Requests", to: "/requests", icon: MessageCircle },
  { label: "Sessions", to: "/sessions", icon: CalendarDays },
];

const categories = ["All skills", "Programming", "Web Development", "AI & Machine Learning", "Electronics", "Communication", "Design", "Career Skills"];
const initialsColor = ["avatar-violet", "avatar-cyan", "avatar-pink", "avatar-blue", "avatar-amber"];

function Avatar({ name, initials, size = "md", className = "" }: { name: string; initials?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const letters = initials ?? name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const color = initialsColor[Math.abs(name.charCodeAt(0) || 0) % initialsColor.length];
  const image = initials?.startsWith("data:image/") || initials?.startsWith("https://") || initials?.startsWith("http://") ? initials : undefined;
  return <span className={`avatar ${size} ${color} ${className}`} aria-label={name}>{image ? <img src={image} alt="" /> : letters}</span>;
}

function Button({ children, variant = "primary", className = "", type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "outline" }) {
  return <button type={type} className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-title-action">{action}</div>}</div>;
}

function AppLayout({ children }: { children: ReactNode }) {
  const { user, theme, setTheme, logout, requests, activities, credits } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isActive = (to: string) => location.pathname === to;
  const pendingRequests = requests.filter((request) => request.status === "Pending" && request.direction === "incoming").length;
  const adminLink = user?.role === "admin";
  return (
    <div className="app-shell">
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <Link to="/" className="brand"><span className="brand-mark"><Sparkles size={19} /></span><span>skillbridge<span className="brand-ai">.ai</span></span></Link>
        <div className="workspace-switch"><span className="workspace-icon"><GraduationCap size={16} /></span><span><b>{user?.college || "Student workspace"}</b><small>{user?.department || "Student community"}</small></span><ChevronDown size={15} /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav">
          {navigation.map(({ label, to, icon: Icon }) => (
            <Link key={to} to={to} className={`nav-link ${isActive(to) ? "nav-link-active" : ""}`} onClick={() => setSidebarOpen(false)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === "Requests" && pendingRequests > 0 && <span className="nav-badge">{pendingRequests}</span>}
            </Link>
          ))}
        </nav>
        <div className="nav-label nav-label-bottom">YOUR SPACE</div>
        <nav className="side-nav">
          <Link to="/wallet" className={`nav-link ${isActive("/wallet") ? "nav-link-active" : ""}`} onClick={() => setSidebarOpen(false)}><Wallet size={18} /><span>Credit wallet</span></Link>
          <Link to="/notifications" className={`nav-link ${isActive("/notifications") ? "nav-link-active" : ""}`} onClick={() => setSidebarOpen(false)}><Bell size={18} /><span>Notifications</span>{activities.some((activity) => !activity.read) && <span className="notification-dot" />}</Link>
          <Link to="/profile" className={`nav-link ${isActive("/profile") ? "nav-link-active" : ""}`} onClick={() => setSidebarOpen(false)}><Users size={18} /><span>My profile</span></Link>
          <Link to="/settings" className={`nav-link ${isActive("/settings") ? "nav-link-active" : ""}`} onClick={() => setSidebarOpen(false)}><Settings size={18} /><span>Settings</span></Link>
          {adminLink && <Link to="/admin" className={`nav-link ${isActive("/admin") ? "nav-link-active" : ""}`}><Shield size={18} /><span>Admin dashboard</span></Link>}
        </nav>
        <div className="sidebar-spacer" />
        <div className="help-card"><span className="help-icon"><CircleHelp size={17} /></span><div><b>Need a hand?</b><p>Your next great session is one click away.</p><Link to="/explore">Explore skills <ArrowRight size={13} /></Link></div></div>
        <div className="sidebar-user">
          <Avatar name={user?.name ?? "Alex Morgan"} initials={user?.avatar ?? "AM"} />
          <div className="sidebar-user-info"><b>{user?.name ?? "Alex Morgan"}</b><small>{user?.role === "admin" ? "Platform admin" : "Student member"}</small></div>
          <button className="icon-button" aria-label="Sign out" onClick={() => { logout(); toast.success("You’re signed out. See you soon!"); navigate("/"); }}><LogOut size={17} /></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><b>{navigation.find((item) => item.to === location.pathname)?.label ?? (location.pathname.replace("/", "").replace("-", " ") || "Overview")}</b></div>
          <div className="topbar-actions"><div className="credit-pill"><span className="credit-spark"><Zap size={14} fill="currentColor" /></span><span>{credits} <span className="credit-word">credits</span></span></div><Link to="/notifications" className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i /></Link><button className="icon-button theme-toggle" aria-label="Toggle color theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button></div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}

function Landing() {
  const { theme, setTheme } = useApp();
  const navigate = useNavigate();
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  return (
    <div className="landing-page">
      <header className="landing-nav"><Link to="/" className="brand"><span className="brand-mark"><Sparkles size={19} /></span><span>skillbridge<span className="brand-ai">.ai</span></span></Link><nav><a href="#how-it-works">How it works</a><a href="#community">Community</a><a href="#about">About</a></nav><div className="landing-nav-actions"><button className="icon-button theme-toggle" aria-label="Toggle color theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><button className="button button-ghost landing-login" onClick={() => navigate("/login")}>Log in</button><button className="button button-primary landing-signup" onClick={() => navigate("/register")}>Get started <ArrowRight size={16} /></button></div></header>
      <section className="hero-section">
        <div className="hero-stars" />
        <div className="hero-copy"><div className="hero-announcement"><span className="announcement-pulse" /> <Sparkles size={14} /> A new way to learn, together</div><h1>Your skills are<br />someone else’s <span className="gradient-text">superpower.</span></h1><p className="hero-description">Trade what you know for what you want to learn. Meet your people, share your skills, and make progress together.</p><div className="hero-cta"><button className="button button-primary button-large" onClick={() => navigate("/register")}>Find your learning match <ArrowRight size={17} /></button><button className="button button-outline button-large" onClick={() => navigate("/login")}>Explore the platform <ChevronRight size={16} /></button></div><div className="hero-proof"><div className="proof-avatars"><Avatar name="Priya" initials="PS" size="sm" /><Avatar name="Jordan" initials="JL" size="sm" /><Avatar name="Sam" initials="SR" size="sm" /><Avatar name="Amara" initials="AO" size="sm" /></div><div><div className="proof-stars"><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /><b>4.9/5</b></div><span>from learners building together</span></div></div></div>
        <div className="hero-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="planet"><span className="planet-glow" /><div className="planet-brand"><Sparkles size={30} /><span>learn<br />together</span></div></div><div className="floating-card match-float"><div className="match-float-icon"><Sparkles size={16} /></div><div><b>Your kind of person</b><small>98% learning match</small></div><span className="match-float-score">98</span></div><div className="floating-card credit-float"><span className="credit-float-icon"><Zap size={17} fill="currentColor" /></span><div><b>2 credits earned</b><small>Knowledge shared ✨</small></div></div><div className="floating-avatar float-avatar-one"><Avatar name="Priya Sharma" initials="PS" size="lg" /><span className="online-indicator" /></div><div className="floating-avatar float-avatar-two"><Avatar name="Jordan Lee" initials="JL" size="md" /><span className="online-indicator" /></div><div className="orbit-dot dot-a" /><div className="orbit-dot dot-b" /><div className="orbit-dot dot-c" /></div>
        <a className="scroll-cue" href="#how-it-works"><span>Scroll to explore</span><span className="scroll-line" /></a>
      </section>
      <section className="trust-strip" id="community"><span>CURIOUS MINDS FROM</span><b>stanford</b><b>MIT</b><b>Berkeley</b><b>NYU</b><b>Georgia Tech</b><b>+ more</b></section>
      <section className="features-section" id="about"><div className="section-heading"><span className="eyebrow">A BETTER WAY TO GROW</span><h2>Trade skills. Build <span className="gradient-text">momentum.</span></h2><p>Learning is better when you do it together. We make it easy to find the right person and get started.</p></div><div className="feature-grid"><FeatureCard icon={<Target />} label="01 / DISCOVER" title="Find your learning match" description="Meet students who have what you want to learn — and are excited about what you have to teach." tone="violet" /><FeatureCard icon={<Zap />} label="02 / EXCHANGE" title="Knowledge is currency" description="Teach for credits. Use them to learn. A fair exchange that values everyone's time and talent." tone="cyan" /><FeatureCard icon={<Sparkles />} label="03 / LEVEL UP" title="Progress, together" description="Grow your skills, build your portfolio, and make friendships that last beyond the classroom." tone="pink" /></div></section>
      <section className="how-section" id="how-it-works"><div className="how-visual"><div className="how-card"><div className="how-card-top"><span className="eyebrow">YOUR NEXT EXCHANGE</span><span className="live-tag"><i /> MATCHED</span></div><div className="exchange-person"><Avatar name="Priya Sharma" initials="PS" size="lg" /><div><b>Priya Sharma</b><small>Stanford · 4th year</small></div><span className="exchange-match">96% match</span></div><div className="exchange-flow"><div><span className="exchange-skill-icon purple"><ArrowUpRight size={17} /></span><div><b>She teaches</b><small>Machine learning</small></div></div><ArrowRight size={18} /><div><span className="exchange-skill-icon cyan"><ArrowDownRight size={17} /></span><div><b>You teach</b><small>React & TypeScript</small></div></div></div><div className="exchange-footer"><span><Check size={14} /> Fair exchange, made easy</span><span><Clock3 size={14} /> 60 min</span></div></div><div className="how-orbit orbit" /><div className="how-sparkle"><Sparkles size={24} /></div></div><div className="how-copy"><span className="eyebrow">SIMPLE BY DESIGN</span><h2>Good things happen when skills <span className="gradient-text">connect.</span></h2><p>No awkward cold DMs. No confusing barters. Just an easy way to learn from the people around you.</p><div className="steps"><Step number="01" title="Show what you know" text="Add skills you'd love to share and things you're curious about." /><Step number="02" title="Meet your match" text="Our transparent AI finds students who learn and teach like you." /><Step number="03" title="Make it happen" text="Book a session, swap knowledge, and celebrate your progress." /></div><button className="button button-primary" onClick={() => navigate("/register")}>Your next chapter starts here <ArrowRight size={16} /></button></div></section>
      <section className="cta-section"><div className="cta-stars" /><div className="cta-orb"><Sparkles size={27} /></div><span className="eyebrow">YOUR PEOPLE ARE OUT THERE</span><h2>One skill can change<br />your whole <span className="gradient-text">orbit.</span></h2><p>Join students learning from each other — one good conversation at a time.</p><button className="button button-primary button-large" onClick={() => navigate("/register")}>Join the community <ArrowRight size={17} /></button>{apiConfigured && <button className="text-link" onClick={() => setWaitlistOpen(true)}>Join the waitlist <ArrowRight size={14} /></button>}<div className="cta-footnote"><Check size={13} /> Free to join <span /> Built for students <span /> Always a fair exchange</div></section>
      <footer className="landing-footer"><Link to="/" className="brand"><span className="brand-mark"><Sparkles size={17} /></span><span>skillbridge<span className="brand-ai">.ai</span></span></Link><span>Learning is better together. © 2025 SkillBridge AI</span><div><a href="#about">About us</a><a href="#how-it-works">How it works</a><a href="mailto:hello@skillbridge.ai">Get in touch</a></div></footer>
      {waitlistOpen && <WaitlistDialog onClose={() => setWaitlistOpen(false)} />}
    </div>
  );
}

function WaitlistDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interests, setInterests] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await apiPost("/waitlist", {
        name: name.trim(),
        email: email.trim(),
        interests: interests.split(",").map((interest) => interest.trim()).filter(Boolean).slice(0, 20),
      });
      toast.success("You’re on the SkillBridge waitlist. We’ll be in touch.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not join the waitlist.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={submit}>
    <div className="modal-heading"><div><span className="eyebrow">A PLACE IN THE GALAXY</span><h2>Join the waitlist</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
    <p className="muted-copy">Leave your details and we’ll let you know when there’s news to share.</p>
    <label className="field-label">Name <small className="field-hint">Optional</small><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label>
    <label className="field-label">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
    <label className="field-label">What would you like to learn?<small className="field-hint">Optional · separate topics with commas</small><input value={interests} onChange={(event) => setInterests(event.target.value)} /></label>
    <div className="modal-footer"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? "Joining…" : "Join waitlist"} {!submitting && <ArrowRight size={15} />}</Button></div>
  </form></div>;
}

function FeatureCard({ icon, label, title, description, tone }: { icon: ReactNode; label: string; title: string; description: string; tone: string }) {
  return <article className="feature-card"><div className={`feature-icon ${tone}`}>{icon}</div><span className="eyebrow">{label}</span><h3>{title}</h3><p>{description}</p><div className={`feature-glow ${tone}`} /></article>;
}
function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="step"><span>{number}</span><div><b>{title}</b><p>{text}</p></div></div>;
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, loginApiUser, register, theme, setTheme } = useApp();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [college, setCollege] = useState("");
  const [department, setDepartment] = useState("");
  const isRegister = mode === "register";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!email.includes("@")) { toast.error("Enter a valid email address."); return; }
    if (apiConfigured && isRegister && (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password))) {
      toast.error("Use at least 10 characters, including an uppercase letter, a lowercase letter, and a number."); return;
    }
    if (!apiConfigured && password.length < 6) { toast.error("Your password must be at least 6 characters."); return; }
    if (isRegister && name.trim().length < 2) { toast.error("Add your name to get started."); return; }
    if (isRegister && (!college.trim() || !department.trim())) { toast.error("Add your college and department to get started."); return; }
    setSubmitting(true);
    try {
      if (apiConfigured) loginApiUser(isRegister ? await apiRegister(name, email, password, { college, department, year: "1st year" }) : await apiLogin(email, password));
      else if (isRegister) register(name, email, { college, department, year: "1st year" });
      else login(email);
      toast.success(isRegister ? "Welcome to SkillBridge! Your profile is ready." : "Welcome back! You're right where you belong.");
      navigate("/app");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn’t sign you in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }
  const demo = (admin = false) => {
    login(admin ? "admin@skillbridge.ai" : "alex@stanford.edu");
    toast.success(admin ? "Welcome to your admin demo workspace." : "Welcome to your demo workspace.");
    navigate(admin ? "/admin" : "/app");
  };
  return <div className="auth-page">
    <div className="auth-backdrop" />
    <Link to="/" className="auth-brand brand"><span className="brand-mark"><Sparkles size={19} /></span><span>skillbridge<span className="brand-ai">.ai</span></span></Link>
    <button className="icon-button auth-theme" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
    <div className="auth-layout">
      <div className="auth-side"><span className="eyebrow">YOUR PEOPLE ARE OUT THERE</span><h1>Better things<br />happen <span className="gradient-text">together.</span></h1><p>Find your next favorite person to learn from. Share what you love. Get a little better, together.</p><div className="auth-testimonial"><div className="testimonial-stars">★★★★★</div><p>“I taught one design session and left with a new friend, a portfolio review, and a reason to be excited about learning again.”</p><div className="testimonial-person"><Avatar name="Sam Rivera" initials="SR" /><div><b>Sam Rivera</b><small>Designer & student, Parsons</small></div></div></div></div>
      <div className="auth-card">
        <div className="auth-card-heading"><span className="eyebrow">{isRegister ? "START YOUR JOURNEY" : "WELCOME BACK"}</span><h2>{isRegister ? "Find your people." : "Good to see you again."}</h2><p>{isRegister ? "One account. Every way to grow." : "Your next learning moment is waiting."}</p></div>
        <form onSubmit={submit} className="auth-form">
          {isRegister && <><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Morgan" autoComplete="name" required /></label><label>College / university<input value={college} onChange={(event) => setCollege(event.target.value)} placeholder="e.g. Stanford University" autoComplete="organization" required /></label><label>Department<input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="e.g. Computer Science" required /></label></>}
          <label>University email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@university.edu" autoComplete="email" required /></label>
          <label>Password<span className="password-wrap"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} placeholder={apiConfigured && isRegister ? "10+ characters with upper, lower & number" : "At least 6 characters"} autoComplete={isRegister ? "new-password" : "current-password"} minLength={apiConfigured && isRegister ? 10 : 6} required /><button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
          {!isRegister && !apiConfigured && <div className="auth-forgot"><span> </span><button type="button" onClick={() => toast.info("Password reset is available when you connect your email provider.")}>Forgot password?</button></div>}
          <button className="button button-primary auth-submit" type="submit" disabled={submitting}>{submitting ? "Connecting securely…" : isRegister ? "Create your account" : "Log in to SkillBridge"} {!submitting && <ArrowRight size={16} />}</button>
        </form>
        {!apiConfigured && <><div className="auth-divider"><span /> or try a demo <span /></div><div className="demo-buttons"><button onClick={() => demo()}><GraduationCap size={17} /> Explore as a student <ArrowRight size={15} /></button><button onClick={() => demo(true)}><Shield size={16} /> Explore as an admin <ArrowRight size={15} /></button></div></>}
        <p className="auth-switch">{isRegister ? "Already learning with us?" : "New to SkillBridge?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Log in" : "Create an account"}</Link></p><small className="auth-legal">By continuing, you agree to our Terms of Service and Privacy Policy.</small>
      </div>
    </div>
    <Link to="/" className="auth-back"><ChevronLeft size={15} /> Back to home</Link>
  </div>;
}

function Protected({ children }: { children: ReactNode }) {
  const { user, apiLoading } = useApp();
  const location = useLocation();
  if (apiLoading) return <div className="auth-page"><div className="auth-backdrop" /><div className="api-loading" role="status">Connecting to your SkillBridge workspace…</div></div>;
  return user ? <AppLayout>{children}</AppLayout> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function Dashboard() {
  const { user, credits, sessions, activities, requests, skills, getMatches } = useApp();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<SkillMatch[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void getMatches().then((items) => { if (active) setRecommendations(items); }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not load recommendations."));
    return () => { active = false; };
  }, [getMatches, user?.id]);
  const live = Boolean(user?.id);
  const featured = live ? recommendations.slice(0, 3) : skills.slice(0, 3).map((skill, index) => ({ skill, score: [98, 94, 91][index] ?? 88, reason: "" }));
  const completedSessions = sessions.filter((session) => session.status === "Completed");
  const upcomingSessions = sessions.filter((session) => session.status === "Upcoming" || session.status === "Awaiting confirmation");
  const completedHours = (completedSessions.reduce((total, session) => total + (Number.parseInt(session.duration, 10) || 0), 0) / 60).toFixed(1);
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  return <div className="page-stack">
    <div className="welcome-strip"><div><span className="eyebrow">{dateLabel}</span><h1>Good morning, {user?.name.split(" ")[0]} <span className="welcome-wave">✦</span></h1><p>You’re one conversation away from your next breakthrough.</p></div><div className="welcome-orbit"><div className="welcome-planet"><Sparkles size={26} /></div><span className="welcome-orbit-dot" /></div></div>
    <div className="stats-grid">
      <StatCard icon={<Zap size={18} />} label="CREDIT BALANCE" value={String(credits)} suffix="credits" change={live ? "From your secure wallet" : "+2 this week"} tone="violet" />
      <StatCard icon={<CalendarDays size={18} />} label={live ? "LEARNING HOURS" : "LEARNING HOURS"} value={live ? completedHours : "8.5"} suffix="hours" change={live ? `${completedSessions.length} completed sessions` : "+2.5 this month"} tone="cyan" />
      <StatCard icon={<Sparkles size={18} />} label={live ? "MATCHES AVAILABLE" : "YOUR MATCH SCORE"} value={live ? String(recommendations.length) : "94"} suffix={live ? "people" : "%"} change={live ? "Ranked for your profile" : "Top 8% in your campus"} tone="pink" />
      <StatCard icon={<Target size={18} />} label={live ? "UPCOMING SESSIONS" : "SKILLS IN PROGRESS"} value={live ? String(upcomingSessions.length) : "4"} suffix={live ? "sessions" : "skills"} change={live ? "On your schedule" : "2 milestones reached"} tone="blue" />
    </div>
    <div className="dashboard-grid">
      <section className="panel upcoming-panel"><div className="panel-heading"><div><span className="eyebrow">MAKE IT COUNT</span><h2>Your next sessions</h2></div><Link to="/sessions" className="text-link">View all <ArrowRight size={15} /></Link></div>{upcomingSessions.slice(0, 2).map((session) => <SessionRow key={session.id} session={session} />)}{upcomingSessions.length === 0 && <p className="muted-copy">No sessions scheduled yet.</p>}<button className="button button-outline panel-action" onClick={() => navigate("/explore")}><Plus size={16} /> Find a new session</button></section>
      <section className="panel progress-panel"><div className="panel-heading"><div><span className="eyebrow">{live ? "REAL SESSION HISTORY" : "YOUR LEARNING JOURNEY"}</span><h2>{live ? "Learning activity" : "This week, in orbit"}</h2></div>{!live && <span className="demo-content-tag">DEMO DATA</span>}</div>{live ? <div className="activity-list">{completedSessions.slice(0, 4).map((session) => <div className="activity-item" key={session.id}><span className="activity-dot cyan" /><div><b>{session.title}</b><p>Session with {session.person}</p></div><small>{session.date}</small></div>)}{completedSessions.length === 0 && <p className="muted-copy">Completed sessions will appear here after both participants confirm.</p>}</div> : <><div className="chart-area"><div className="chart-y-labels"><span>8h</span><span>6h</span><span>4h</span><span>2h</span><span>0h</span></div><div className="bar-chart">{[["M", 43], ["T", 73], ["W", 50], ["T", 91], ["F", 61], ["S", 35], ["S", 15]].map(([day, height], index) => <div key={`${day}-${index}`} className="bar-column"><div className={`chart-bar ${index === 3 ? "chart-bar-active" : ""}`} style={{ height: `${height}%` }} title={`${Math.round(Number(height) / 13)} learning hours`} /><span>{day}</span></div>)}</div></div><div className="chart-legend"><span><i /> Learning hours</span><b><ArrowUpRight size={14} /> 18% <small>vs. last week</small></b></div></>}</section>
      <section className="panel recommendations-panel"><div className="panel-heading"><div><span className="eyebrow">{live ? "SERVER-RANKED RECOMMENDATIONS" : "THOUGHTFULLY PICKED FOR YOU"}</span><h2>People you might click with</h2></div><Link to="/matches" className="text-link">All matches <ArrowRight size={15} /></Link></div><div className="match-list">{featured.map(({ skill, score }) => <MiniMatch key={skill.id} skill={skill} score={score} />)}{featured.length === 0 && <p className="muted-copy">{live ? "Add learning goals to your profile to get recommendations." : "No matches available yet."}</p>}</div></section>
      <section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR RECENT COSMOS</span><h2>It’s all coming together</h2></div><Link to="/notifications" className="text-link">Activity <ArrowRight size={15} /></Link></div><div className="activity-list">{activities.slice(0, 4).map((activity) => <div className="activity-item" key={activity.id}><span className={`activity-dot ${activity.tone}`} /><div><b>{activity.title}</b><p>{activity.detail}</p></div><small>{activity.date}</small></div>)}{activities.length === 0 && <p className="muted-copy">New exchange and session activity will appear here.</p>}{requests.length > 0 && <div className="activity-footnote"><CheckCheck size={14} /> {requests.filter((request) => request.status === "Pending").length} requests waiting for you</div>}</div></section>
    </div>
  </div>;
}

function StatCard({ icon, label, value, suffix, change, tone }: { icon: ReactNode; label: string; value: string; suffix: string; change: string; tone: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="eyebrow">{label}</span><div className="stat-value">{value}<small>{suffix}</small></div><span className="stat-change"><ArrowUpRight size={13} /> {change}</span></article>;
}

function SessionRow({ session }: { session: LearningSession }) {
  return <div className="session-row"><div className="session-date"><b>{session.date}</b><small>{session.time}</small></div><div className="session-row-info"><b>{session.title}</b><span>with {session.person}</span><small><Clock3 size={13} /> {session.duration}</small></div><span className={`status-tag ${session.status === "Upcoming" ? "status-upcoming" : "status-done"}`}>{session.status}</span></div>;
}

function MiniMatch({ skill, score }: { skill: Skill; score: number }) {
  const { sendRequest, requests } = useApp();
  const alreadyRequested = requests.some((request) => (request.skillId ? request.skillId === skill.id : request.skill === skill.title) && request.status === "Pending");
  return <div className="mini-match"><Avatar name={skill.owner} initials={skill.avatar} size="md" /><div className="mini-match-info"><b>{skill.owner}</b><span>{skill.title}</span><small>{skill.college}</small></div><span className="match-score">{score}% <small>match</small></span><button className="mini-match-action" aria-label={`Request session with ${skill.owner}`} disabled={alreadyRequested} onClick={() => { void sendRequest(skill).then(() => toast.success(`Request sent to ${skill.owner}.`)).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not send request.")); }}>{alreadyRequested ? <Check size={16} /> : <ArrowRight size={16} />}</button></div>;
}

function SkillCard({ skill, score, reason }: { skill: Skill; score?: number; reason?: string }) {
  const { sendRequest, requests, savedSkills, toggleSaved, user } = useApp();
  const requested = requests.some((request) => (request.skillId ? request.skillId === skill.id : request.skill === skill.title) && request.status === "Pending");
  const ownSkill = skill.ownerId ? skill.ownerId === user?.id : skill.owner === user?.name;
  const saved = savedSkills.includes(skill.id);
  return <article className="skill-card"><div className="skill-card-top"><span className="category-chip">{skill.category}</span><button className={`save-button ${saved ? "saved" : ""}`} aria-label={saved ? "Remove saved skill" : "Save skill"} onClick={() => { toggleSaved(skill.id); toast.success(saved ? "Removed from saved skills." : "Saved for later."); }}><Heart size={17} fill={saved ? "currentColor" : "none"} /></button></div><div className="skill-card-owner"><Avatar name={skill.owner} initials={skill.avatar} size="md" /><div><b>{skill.owner}</b><small>{skill.college}</small></div><span className="rating"><Star size={13} fill="currentColor" /> {skill.rating.toFixed(1)}</span></div><h3><Link to={`/skills/${skill.id}`} className="skill-title-link">{skill.title}</Link></h3><p className="skill-description">{skill.description}</p><div className="skill-tags">{skill.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>{reason && <div className="match-reason"><Sparkles size={14} /> {reason}</div>}<div className="skill-card-meta"><span><span className="level-dot" /> {skill.level}</span><span><Clock3 size={14} /> {skill.availability}</span></div><div className="skill-card-footer"><span className="skill-credits"><Zap size={14} fill="currentColor" /> {skill.credits} credits <small>/ session</small></span>{score !== undefined && <span className="card-match-score">{score}% match</span>}</div><div className="skill-card-actions">{ownSkill ? <Link className="button button-outline card-button" to="/my-listings">Manage listing <ArrowRight size={14} /></Link> : <button className="button button-primary card-button" disabled={requested} onClick={() => { void sendRequest(skill).then(() => toast.success(`Request sent to ${skill.owner}.`)).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not send request.")); }}>{requested ? <>Request sent <Check size={15} /></> : <>Request to learn <ArrowRight size={15} /></>}</button>}</div></article>;
}

function Explore() {
  const { skills, searchSkills } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All skills");
  const [level, setLevel] = useState("Any level");
  const [availability, setAvailability] = useState("Any schedule");
  const [remoteSkills, setRemoteSkills] = useState<Skill[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!apiConfigured) return;
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchSkills(query, category, level, availability)
        .then((result) => { if (active) setRemoteSkills(result); })
        .catch((error: unknown) => { if (active) toast.error(error instanceof Error ? error.message : "Could not search skill listings."); })
        .finally(() => { if (active) setSearching(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchSkills, query, category, level, availability]);
  const filtered = apiConfigured ? remoteSkills : skills.filter((skill) => {
    const text = `${skill.title} ${skill.description} ${skill.owner} ${skill.category} ${skill.tags.join(" ")}`.toLowerCase();
    return (category === "All skills" || skill.category === category)
      && (level === "Any level" || skill.level === level || skill.level === "All levels")
      && (availability === "Any schedule" || skill.availability === availability || skill.availability === "Flexible")
      && text.includes(query.toLowerCase().trim());
  });
  return <div className="page-stack"><PageTitle eyebrow="A LITTLE KNOWLEDGE GOES A LONG WAY" title="Explore the learning galaxy" description="Find a student whose superpower is exactly what you want to learn." action={<Link className="button button-primary" to="/create"><Plus size={16} /> Share a skill</Link>} /><div className="explore-toolbar"><label className="search-field"><Search size={17} /><input placeholder="Search skills, people, or topics..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label><div className="filters-row"><label className="select-filter"><Filter size={15} /><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={14} /></label><label className="select-filter"><select value={level} onChange={(event) => setLevel(event.target.value)}>{["Any level", "Beginner", "Intermediate", "Advanced", "All levels"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label><label className="select-filter"><select value={availability} onChange={(event) => setAvailability(event.target.value)}>{["Any schedule", "Weekday evenings", "Weekends", "Flexible"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label></div></div><div className="explore-summary"><span><b>{searching ? "…" : filtered.length}</b> {filtered.length === 1 ? "skill" : "skills"} to explore</span><span className="live-tag"><i /> {apiConfigured ? "LIVE API RESULTS" : "DEMO DATA"}</span></div>{searching ? <p className="muted-copy" role="status">Searching live listings…</p> : filtered.length ? <div className="skill-grid">{filtered.map((skill) => <SkillCard key={skill.id} skill={skill} />)}</div> : <EmptyState icon={<Search size={22} />} title="No skills found in this part of the galaxy" text="Try another search or loosen up your filters." action={<Button variant="outline" onClick={() => { setQuery(""); setCategory("All skills"); setLevel("Any level"); setAvailability("Any schedule"); }}>Clear filters</Button>} />}</div>;
}

function Matches() {
  const { skills, user, getMatches } = useApp();
  const navigate = useNavigate();
  const [remoteMatches, setRemoteMatches] = useState<SkillMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setLoadingMatches(true);
    void getMatches().then((items) => { if (active) setRemoteMatches(items); })
      .catch((error: unknown) => { if (active) toast.error(error instanceof Error ? error.message : "Could not load matches."); })
      .finally(() => { if (active) setLoadingMatches(false); });
    return () => { active = false; };
  }, [getMatches, user?.id]);
  const wanted = (user?.skillsWanted ?? []).join(" ").toLowerCase();
  const interests = (user?.interests ?? []).join(" ").toLowerCase();
  const offered = (user?.skillsOffered ?? []).join(" ").toLowerCase();
  const ranked = useMemo(() => skills.map((skill) => {
    const skillText = `${skill.title} ${skill.category} ${skill.tags.join(" ")}`.toLowerCase();
    const wantedOverlap = wanted.split(/[\s,&]+/).filter((word) => word.length > 3 && skillText.includes(word));
    const interestOverlap = interests.split(/[\s,&]+/).filter((word) => word.length > 3 && skillText.includes(word));
    const reciprocal = skill.tags.some((tag) => offered.includes(tag.toLowerCase()));
    const score = Math.min(99, 68 + Math.min(18, wantedOverlap.length * 9) + Math.min(8, interestOverlap.length * 4) + (reciprocal ? 5 : 0));
    const reason = wantedOverlap.length ? `Matches your interest in ${wantedOverlap[0]}` : interestOverlap.length ? `Connects with your ${interestOverlap[0]} interest` : reciprocal ? "A great way to exchange what you both know" : `A popular ${skill.category.toLowerCase()} session`;
    return { skill, score, reason };
  }).sort((a, b) => b.score - a.score), [skills, wanted, interests, offered]);
  const recommendations = user?.id ? remoteMatches : ranked;
  return <div className="page-stack"><PageTitle eyebrow="A LITTLE ALGORITHM, A LOT OF HUMAN" title="The people you’ll just get" description="Thoughtful matches based on what you want to learn, love, and have in common." /><section className="matching-explainer"><div className="matching-icon"><Sparkles size={20} /></div><div><b>How your match score works</b><p>{user?.id ? <>Server ranking weighs skill relevance <strong>60 points</strong>, location <strong>15</strong>, provider rating <strong>15</strong>, and listing detail <strong>10</strong>. Each recommendation explains its score.</> : <>Demo recommendations are illustrative. In API mode, server ranking weighs relevance, location, provider rating, and listing detail.</>}</p></div><span className="transparent-badge"><Shield size={14} /> Transparent by design</span></section><div className="matches-insight"><span className="insight-icon"><Target size={17} /></span><span><b>{loadingMatches ? "Finding matches…" : `${recommendations.length} thoughtful matches`}</b> based on your learning goals and interests</span><button className="text-link" onClick={() => navigate("/profile")}>Update your profile <ArrowRight size={14} /></button></div>{loadingMatches ? <p className="muted-copy" role="status">Finding relevant student listings…</p> : recommendations.length ? <div className="match-grid">{recommendations.map(({ skill, score, reason }) => <SkillCard key={skill.id} skill={skill} score={score} reason={reason} />)}</div> : <EmptyState icon={<Sparkles size={22} />} title="No matches yet" text={user?.id ? "Add skills you want to learn or interests in your profile to get server-ranked matches." : "Try adding learning goals to your demo profile."} action={<Button onClick={() => navigate("/profile")}>Update your profile <ArrowRight size={15} /></Button>} />}</div>;
}

function SkillDetails() {
  const { skillId } = useParams();
  const { skills, user, requests, sendRequest, savedSkills, toggleSaved, getSkill } = useApp();
  const localSkill = skills.find((item) => item.id === skillId);
  const [remoteSkill, setRemoteSkill] = useState<Skill>();
  const [loadingSkill, setLoadingSkill] = useState(apiConfigured);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  useEffect(() => {
    if (!apiConfigured || !skillId) return;
    let active = true;
    setLoadingSkill(true);
    void getSkill(skillId).then((value) => { if (active) setRemoteSkill(value); })
      .catch((error: unknown) => { if (active) toast.error(error instanceof Error ? error.message : "Could not load this listing."); })
      .finally(() => { if (active) setLoadingSkill(false); });
    return () => { active = false; };
  }, [getSkill, skillId]);
  const skill = apiConfigured ? remoteSkill ?? localSkill : localSkill;
  if (!skill) return loadingSkill ? <div className="page-stack"><p className="muted-copy" role="status">Loading skill listing…</p></div> : <NotFound />;
  const exchange = requests.find((request) => (request.skillId ? request.skillId === skill.id : request.skill === skill.title) && ["Pending", "Accepted"].includes(request.status));
  const requested = Boolean(exchange);
  const acceptedRequest = exchange?.status === "Accepted" ? exchange : undefined;
  const isOwner = user?.name === skill.owner;
  const goalMatch = (user?.skillsWanted ?? []).some((wanted) => `${skill.title} ${skill.category} ${skill.tags.join(" ")}`.toLowerCase().includes(wanted.toLowerCase()));
  return <div className="page-stack">
    <Link to="/explore" className="back-link"><ChevronLeft size={15} /> Back to explore</Link>
    <section className="skill-detail-hero">
      <div className="detail-hero-glow" />
      <div className="skill-detail-top"><span className="category-chip">{skill.category}</span><button className={`save-button ${savedSkills.includes(skill.id) ? "saved" : ""}`} onClick={() => { toggleSaved(skill.id); toast.success(savedSkills.includes(skill.id) ? "Removed from saved skills." : "Saved for later."); }}><Heart size={17} fill={savedSkills.includes(skill.id) ? "currentColor" : "none"} /> Save skill</button></div>
      <div className="detail-title-row"><div><h1>{skill.title}</h1><p>{skill.description}</p></div>{!user?.id && <div className="detail-score"><span><Sparkles size={16} /> DEMO MATCH</span><b>{goalMatch ? "96%" : "88%"}</b><small>Illustrative score</small></div>}</div>
      <div className="skill-detail-owner"><Avatar name={skill.owner} initials={skill.avatar} size="lg" /><div><b>{skill.owner}</b><small>{skill.college} · 4th year student</small></div><span className="rating"><Star size={14} fill="currentColor" /> {skill.rating.toFixed(1)} <small>learner rating</small></span></div>
      <div className="skill-detail-bottom"><div><span><span className="level-dot" /> {skill.level}</span><span><Clock3 size={14} /> {skill.availability}</span><span><Zap size={14} /> {skill.credits} credits / session</span></div>{isOwner ? <Link to="/my-listings" className="button button-outline">Manage your listing <ArrowRight size={15} /></Link> : acceptedRequest ? <Button variant="outline" onClick={() => setScheduleOpen(true)}><CalendarDays size={15} /> Schedule session</Button> : <button className="button button-primary" disabled={requested} onClick={() => { void sendRequest(skill).then(() => toast.success(`Request sent to ${skill.owner}.`)).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not send request.")); }}>{requested ? <>Request sent <Check size={15} /></> : <>Request to learn together <ArrowRight size={15} /></>}</button>}</div>
    </section>
    <div className="detail-content-grid"><section className="panel detail-about"><span className="eyebrow">WHAT YOU’LL EXPLORE</span><h2>A good place to start learning</h2><p>{skill.description}</p><div className="detail-skills">{skill.tags.map((tag) => <span key={tag}><Check size={13} /> {tag}</span>)}</div><div className="detail-session-note"><Shield size={17} /><span><b>Fair by nature.</b> Credits only move when both of you confirm your session is complete. Plans change? No charge for a session that doesn’t happen.</span></div></section><section className="panel detail-availability"><span className="eyebrow">THE LITTLE DETAILS</span><h2>Make it work for you</h2><div className="detail-info-row"><CalendarDays size={16} /><div><b>{skill.availability}</b><small>Choose a time that works for both participants.</small></div></div><div className="detail-info-row"><Clock3 size={16} /><div><b>Easy to fit in</b><small>Sessions are typically 45–60 minutes.</small></div></div><div className="detail-info-row"><Users size={16} /><div><b>One-on-one learning</b><small>A personal, judgment-free space to grow.</small></div></div><Button variant="outline" className="detail-schedule" disabled={!acceptedRequest} onClick={() => setScheduleOpen(true)}><CalendarDays size={15} /> Schedule a session</Button>{!acceptedRequest && !isOwner && <small className="schedule-hint">Accept an exchange request first to schedule a session.</small>}</section></div>
    {scheduleOpen && <ScheduleDialog request={acceptedRequest} onClose={() => setScheduleOpen(false)} />}
  </div>;
}

function CreateListing() {
  const { addSkill } = useApp();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Web Development");
  const [level, setLevel] = useState("Beginner");
  const [description, setDescription] = useState("");
  const [availability, setAvailability] = useState("Flexible");
  const [tags, setTags] = useState("");
  const [credits, setCredits] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (title.trim().length < 5) { toast.error("Give your skill a descriptive title (at least 5 characters)."); return; }
    if (description.trim().length < 30) { toast.error("Add a little more detail (at least 30 characters)."); return; }
    setSubmitting(true);
    try {
      await addSkill({ title: title.trim(), category, level, description: description.trim(), availability, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 6), credits });
      toast.success("Your skill is now part of the galaxy. Let the connections begin!");
      navigate("/my-listings");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish your skill.");
    } finally {
      setSubmitting(false);
    }
  }
  return <div className="page-stack"><PageTitle eyebrow="SHARE WHAT YOU LOVE" title="Put your superpower out there" description="Every great exchange starts with someone willing to share." /><form className="listing-form panel" onSubmit={submit}><div className="form-section-heading"><span className="form-step">01</span><div><h2>The skill you’ll share</h2><p>Give curious learners a reason to say hello.</p></div></div><label className="field-label">What can you teach?<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Build your first React project" maxLength={70} required /></label><div className="form-row"><label className="field-label">Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="field-label">Experience level<select value={level} onChange={(event) => setLevel(event.target.value)}>{["Beginner", "Intermediate", "Advanced", "All levels"].map((item) => <option key={item}>{item}</option>)}</select></label></div><label className="field-label">A little more about it<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will learners take away? How do you like to teach? What makes your approach special?" rows={4} maxLength={500} required /><small className="field-hint">{description.length}/500 · A thoughtful description attracts the right learners.</small></label><div className="form-row"><label className="field-label">Topics / tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="React, TypeScript, beginner-friendly" /><small className="field-hint">Separate each topic with a comma.</small></label><label className="field-label">When are you available?<select value={availability} onChange={(event) => setAvailability(event.target.value)}>{["Flexible", "Weekday evenings", "Weekends"].map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="credit-setting"><span className="credit-setting-icon"><Zap size={17} fill="currentColor" /></span><div><b>Credits per session</b><small>Credits transfer only after both students confirm the session.</small></div><select value={credits} onChange={(event) => setCredits(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item} credits</option>)}</select></div><div className="form-footer"><span><Shield size={14} /> Your listing is visible to the student community.</span><div><Link to="/my-listings" className="button button-ghost">Cancel</Link><Button type="submit" disabled={submitting}>{submitting ? "Publishing…" : "Publish your skill"} {!submitting && <ArrowRight size={16} />}</Button></div></div></form></div>;
}

function MyListings() {
  const { skills, user, requests, deleteSkill, updateSkill } = useApp();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Skill | null>(null);
  const [saving, setSaving] = useState(false);
  const owned = skills.filter((skill) => skill.ownerId ? skill.ownerId === user?.id : skill.owner === user?.name);
  async function saveListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    try {
      await updateSkill(editing.id, { title: editing.title.trim(), description: editing.description.trim(), category: editing.category, level: editing.level, tags: editing.tags.map((tag) => tag.trim()).filter(Boolean) });
      toast.success("Your listing has been updated.");
      setEditing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your listing.");
    } finally {
      setSaving(false);
    }
  }
  return <div className="page-stack"><PageTitle eyebrow="YOUR LITTLE CORNER OF THE GALAXY" title="What you love to teach" description="Your shared skills make the whole community a little smarter." action={<Button onClick={() => navigate("/create")}><Plus size={16} /> Create a listing</Button>} />{owned.length ? <div className="listing-management-grid">{owned.map((skill) => <div className="manage-card" key={skill.id}><div className="manage-card-top"><span className="category-chip">{skill.category}</span><div className="inline-actions"><button className="icon-button" title="Edit listing" aria-label={`Edit ${skill.title}`} onClick={() => setEditing(editing?.id === skill.id ? null : { ...skill })}><Pencil size={15} /></button><button className="icon-button danger-button" title="Delete listing" aria-label={`Delete ${skill.title}`} onClick={() => { if (window.confirm(`Remove "${skill.title}" from your listings?`)) { void deleteSkill(skill.id).then(() => toast.success("Your listing has been removed.")).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not remove listing.")); } }}><X size={16} /></button></div></div>{editing?.id === skill.id ? <form className="listing-edit-form" onSubmit={(event) => void saveListing(event)}><label className="field-label">Title<input required minLength={3} maxLength={100} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label><label className="field-label">Category<select value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value })}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="field-label">Description<textarea required minLength={10} maxLength={2000} rows={4} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label><label className="field-label">Topics / tags<input value={editing.tags.join(", ")} onChange={(event) => setEditing({ ...editing, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /><small className="field-hint">Separate each topic with a comma.</small></label><label className="field-label">Experience level<select value={editing.level} onChange={(event) => setEditing({ ...editing, level: event.target.value })}>{["Beginner", "Intermediate", "Advanced", "All levels"].map((item) => <option key={item}>{item}</option>)}</select></label><div className="form-footer"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"} {!saving && <Check size={15} />}</Button></div></form> : <><h3>{skill.title}</h3><p>{skill.description}</p><div className="skill-tags">{skill.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="manage-card-footer"><span><span className="level-dot" /> {skill.level}</span><span><Zap size={14} /> {skill.credits} credits / session</span><span><Users size={14} /> {requests.filter((request) => request.skillId ? request.skillId === skill.id : request.skill === skill.title).length} requests</span></div></>}</div>)}</div> : <EmptyState icon={<Bookmark size={22} />} title="Your teaching story starts here" text="Share something you know. There’s someone out there hoping to learn it." action={<Button onClick={() => navigate("/create")}><Plus size={16} /> Share your first skill</Button>} />}</div>;
}

function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-state-icon">{icon}</span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function Requests() {
  const { requests, updateRequest } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const [scheduleRequest, setScheduleRequest] = useState<ExchangeRequest | undefined>();
  const filtered = filter === "All" ? requests : requests.filter((request) => filter === "Incoming" ? request.direction === "incoming" : filter === "Sent" ? request.direction === "outgoing" : request.status === filter);
  async function change(request: ExchangeRequest, status: ExchangeRequest["status"]) {
    try {
      await updateRequest(request.id, status);
      toast.success(status === "Accepted" ? `You’re all set to learn ${request.skill}.` : status === "Declined" ? "Request declined. No credits were transferred." : "Request cancelled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this request.");
    }
  }
  return <div className="page-stack"><PageTitle eyebrow="GOOD THINGS START WITH A HELLO" title="Your exchange requests" description="Every great skill swap starts with a conversation." action={<Button variant="outline" onClick={() => navigate("/explore")}><Compass size={15} /> Explore skills</Button>} /><div className="request-tabs">{["All", "Incoming", "Sent", "Pending", "Accepted"].map((item) => <button key={item} className={`request-tab ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item === "All" ? "All requests" : item}{item === "All" && <b>{requests.length}</b>}</button>)}</div>{filtered.length ? <div className="request-list">{filtered.map((request) => <article className="request-card" key={request.id}><Avatar name={request.person} size="lg" /><div className="request-info"><span className="request-direction">{request.direction === "incoming" ? "WANTS TO LEARN WITH YOU" : "YOU REACHED OUT"}</span><h3>{request.person}</h3><p>{request.direction === "incoming" ? "wants to learn" : "is sharing"} <b>{request.skill}</b></p><span className="request-date"><Clock3 size={13} /> {request.date}</span></div><span className={`status-tag ${request.status === "Accepted" || request.status === "Completed" ? "status-done" : request.status === "Declined" || request.status === "Cancelled" ? "status-declined" : "status-upcoming"}`}>{request.status}</span><div className="request-actions">{request.status === "Pending" ? request.direction === "incoming" ? <><Button onClick={() => void change(request, "Accepted")}><Check size={15} /> Accept</Button><Button variant="outline" onClick={() => void change(request, "Declined")}>Decline</Button></> : <Button variant="outline" onClick={() => void change(request, "Cancelled")}><X size={15} /> Cancel request</Button> : request.status === "Accepted" ? <Button variant="outline" onClick={() => setScheduleRequest(request)}><CalendarDays size={15} /> Schedule session</Button> : <span className="muted-copy">{request.status === "Cancelled" ? "Request cancelled" : request.status === "Completed" ? "Session completed" : "No credits exchanged"}</span>}</div></article>)}</div> : <EmptyState icon={<MessageCircle size={23} />} title={requests.length ? `No ${filter.toLowerCase()} requests` : "A fresh start, full of possibilities"} text={requests.length ? "Try another filter to see more of your exchange activity." : "Find someone whose skills spark your curiosity."} action={requests.length ? undefined : <Button onClick={() => navigate("/explore")}>Explore skills <ArrowRight size={15} /></Button>} />}{scheduleRequest && <ScheduleDialog request={scheduleRequest} onClose={() => setScheduleRequest(undefined)} />}</div>;
}

function ScheduleDialog({ onClose, request }: { onClose: () => void; request?: ExchangeRequest }) {
  const { scheduleSession } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState(request?.skill ?? "");
  const [person, setPerson] = useState(request?.person ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60 min");
  const [meetingLink, setMeetingLink] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!date || date < new Date().toISOString().slice(0, 10)) { toast.error("Choose today or a future date for your session."); return; }
    const scheduledAt = new Date(`${date}T${time}`);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) { toast.error("Choose a future time for your session."); return; }
    const room = `skillbridge-${Date.now().toString(36)}`;
    setSubmitting(true);
    try {
      await scheduleSession({ title: title.trim(), person: person.trim(), date: scheduledAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }), time: scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), duration, meetingLink: meetingLink.trim() || `https://meet.jit.si/${room}`, requestId: request?.id, scheduledAt: scheduledAt.toISOString(), durationMinutes: Number(duration.split(" ")[0]) });
      toast.success("Your session is scheduled. A meeting link is ready to share.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not schedule this session.");
    } finally {
      setSubmitting(false);
    }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={submit}><div className="modal-heading"><div><span className="eyebrow">MAKE IT A DATE</span><h2>Schedule a session</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div><label className="field-label">What are you learning?<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. React & TypeScript" required minLength={3} /></label><label className="field-label">Learning with<input value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Your session partner" required /></label><div className="form-row"><label className="field-label">Date<input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDate(event.target.value)} required /></label><label className="field-label">Time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label></div><div className="form-row"><label className="field-label">Duration<select value={duration} onChange={(event) => setDuration(event.target.value)}>{["30 min", "45 min", "60 min", "90 min"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="field-label">Meeting link <small className="field-hint">Optional</small><input type="url" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="A video call link" /></label></div><div className="meeting-fallback"><Zap size={15} /> No link? We’ll create a free Jitsi room for you.</div><div className="modal-footer"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? "Scheduling…" : "Schedule session"} {!submitting && <CalendarDays size={15} />}</Button></div></form></div>;
}

function DisputeDialog({ session, onClose }: { session: LearningSession; onClose: () => void }) {
  const { reportSession } = useApp();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (reason.trim().length < 10) { toast.error("Add at least 10 characters so we can understand what happened."); return; }
    setSubmitting(true);
    try {
      await reportSession(session.id, reason.trim());
      toast.success("Your report is with our community team. Credits are on hold while we review it.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not report this session.");
    } finally {
      setSubmitting(false);
    }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card" onSubmit={submit}><div className="modal-heading"><div><span className="eyebrow">WE’RE HERE TO HELP</span><h2>Report a session issue</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div><p className="dispute-modal-summary">Session with <b>{session.person}</b> · {session.title}</p><label className="field-label">What happened?<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={2000} rows={5} placeholder="Share the details so our team can help make things right." required /><small className="field-hint">Credits will stay protected while the dispute is reviewed.</small></label><div className="modal-footer"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? "Sending report…" : "Submit report"} {!submitting && <Shield size={15} />}</Button></div></form></div>;
}

function Sessions() {
  const { sessions, requests, user, credits, confirmSession, confirmPartner, cancelSession } = useApp();
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleRequest, setScheduleRequest] = useState<ExchangeRequest | undefined>();
  const [disputeSession, setDisputeSession] = useState<LearningSession>();
  function openSchedule() {
    const accepted = requests.find((request) => request.status === "Accepted");
    if (user?.id && !accepted) { toast.info("Accept an exchange request before scheduling a session."); return; }
    setScheduleRequest(accepted);
    setShowSchedule(true);
  }
  async function confirm(id: string) {
    try {
      await confirmSession(id);
      toast.success("Your confirmation was recorded. Credits move after both participants confirm.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not confirm this session.");
    }
  }
  async function cancel(session: LearningSession) {
    if (!window.confirm("Cancel this session? No credits will be transferred.")) return;
    try {
      await cancelSession(session.id);
      toast.success("Session cancelled. No credits were transferred.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel this session.");
    }
  }
  const statusLabel = (status: LearningSession["status"]) => ({ Upcoming: "UP NEXT", "Awaiting confirmation": "WAITING ON YOUR PARTNER", Completed: "A GOOD ONE, IN THE BOOKS", Disputed: "UNDER REVIEW", Cancelled: "SESSION CANCELLED" })[status];
  return <div className="page-stack">
    <PageTitle eyebrow="LITTLE MOMENTS, BIG BREAKTHROUGHS" title="Your sessions" description="Good things happen when you make the time." action={<Button onClick={openSchedule}><Plus size={16} /> Schedule a session</Button>} />
    <div className="session-policy"><Shield size={17} /><span><b>Fair exchange, every time.</b> Credits move only after both people confirm the session happened.</span><Link to="/wallet">How credits work <ArrowRight size={14} /></Link></div>
    {sessions.length ? <div className="session-cards">{sessions.map((session) => <article className="session-card" key={session.id}>
      <div className="session-calendar"><CalendarDays size={16} /><b>{session.date}</b><small>{session.time}</small></div>
      <div className="session-card-details"><span className="eyebrow">{statusLabel(session.status)}</span><h3>{session.title}</h3><p>Learning with <b>{session.person}</b></p><div className="session-detail-meta"><span><Clock3 size={14} /> {session.duration}</span><span><Zap size={14} /> {session.credits} credits</span></div></div>
      <div className="session-card-actions">
        {session.meetingLink && session.status === "Upcoming" && <a className="button button-outline" href={session.meetingLink} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Join session</a>}
        {session.status === "Upcoming" && <><Button disabled={!user?.id && credits < 2} onClick={() => void confirm(session.id)}><Check size={15} /> Confirm my session</Button><Button variant="ghost" onClick={() => void cancel(session)}><X size={14} /> Cancel</Button><Button variant="ghost" onClick={() => setDisputeSession(session)}><Shield size={14} /> Report an issue</Button></>}
        {session.status === "Awaiting confirmation" && (user?.id ? <span className="completed-note"><Clock3 size={15} /> Waiting for your partner</span> : <Button onClick={() => { confirmPartner(session.id); toast.success("Both demo participants confirmed. 2 credits were transferred."); }}><CheckCheck size={15} /> Confirm as partner (demo)</Button>)}
        {session.status === "Completed" && <span className="completed-note"><CheckCheck size={15} /> Completed & settled</span>}
        {session.status === "Disputed" && <span className="completed-note"><Shield size={15} /> Credits protected during review</span>}
        {session.status === "Cancelled" && <span className="muted-copy">No credits exchanged</span>}
      </div>
    </article>)}</div> : <EmptyState icon={<CalendarDays size={22} />} title="Your calendar is wide open" text="Make a little time for something new. Schedule your first learning session." action={<Button onClick={openSchedule}><Plus size={16} /> Schedule a session</Button>} />}
    <div className="dropout-note"><span className="dropout-icon"><CircleHelp size={17} /></span><div><b>Plans change. Your progress shouldn’t.</b><p>Cancel an unconfirmed session to avoid a no-show. Credits are never charged for sessions that don’t happen. Need help? Report a session and our team will review it fairly.</p></div><Link to="/requests">Your requests <ArrowRight size={14} /></Link></div>
    {showSchedule && <ScheduleDialog request={scheduleRequest} onClose={() => setShowSchedule(false)} />}
    {disputeSession && <DisputeDialog session={disputeSession} onClose={() => setDisputeSession(undefined)} />}
  </div>;
}

function WalletPage() {
  const { credits, transactions } = useApp();
  const earned = transactions.filter((entry) => entry.direction === "earned").reduce((sum, entry) => sum + entry.amount, 0);
  const spent = transactions.filter((entry) => entry.direction === "spent").reduce((sum, entry) => sum + entry.amount, 0);
  return <div className="page-stack"><PageTitle eyebrow="A LITTLE SOMETHING FOR YOUR TIME" title="Your credit wallet" description="Your knowledge has value. These credits make every exchange fair." /><div className="wallet-grid"><section className="wallet-balance-card"><div className="wallet-card-stars" /><div className="wallet-balance-top"><span><Zap size={15} fill="currentColor" /> SKILLBRIDGE CREDITS</span><span className="wallet-chip">STUDENT WALLET</span></div><div className="wallet-balance">{credits}<small>credits</small></div><p>Earn by teaching. Spend by learning. Always fair, always yours.</p><div className="wallet-balance-footer"><span><ArrowUpRight size={14} /> {earned} earned</span><span><ArrowDownRight size={14} /> {spent} spent</span></div></section><div className="wallet-stat-stack"><div className="wallet-small-card"><span className="wallet-stat-icon earned"><ArrowUpRight size={16} /></span><span className="eyebrow">TOTAL EARNED</span><b>{earned} <small>credits</small></b><span>From sharing what you know</span></div><div className="wallet-small-card"><span className="wallet-stat-icon spent"><ArrowDownRight size={16} /></span><span className="eyebrow">TOTAL SPENT</span><b>{spent} <small>credits</small></b><span>Invested in your learning</span></div></div></div><section className="panel transactions-panel"><div className="panel-heading"><div><span className="eyebrow">EVERY CREDIT HAS A STORY</span><h2>Wallet history</h2></div><span className="transactions-note"><Shield size={14} /> Secure & transparent</span></div><div className="transaction-list">{transactions.map((entry) => <div className="transaction-row" key={entry.id}><span className={`transaction-icon ${entry.direction}`}>{entry.direction === "earned" ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />}</span><div className="transaction-info"><b>{entry.title}</b><small>{entry.detail}</small></div><span className={`transaction-amount ${entry.direction}`}>{entry.direction === "earned" ? "+" : "−"}{entry.amount}</span><span className="transaction-date">{entry.date}</span></div>)}{transactions.length === 0 && <p className="muted-copy">Your first credit will show up here.</p>}</div></section><div className="credit-rules"><span className="credit-rules-icon"><Shield size={17} /></span><div><b>Credits only move when both of you say so.</b><p>Once both participants confirm a completed session, credits transfer automatically. No show? No charge. Dispute? We’ll help make it right.</p></div><Link to="/sessions">See your sessions <ArrowRight size={14} /></Link></div></div>;
}

function Notifications() {
  const { activities, requests, markNotificationsRead } = useApp();
  const [filter, setFilter] = useState("All");
  const latest = [
    ...activities.map((activity) => {
      const title = activity.title.toLowerCase();
      const category = activity.category ?? (title.includes("session") ? "Sessions" : title.includes("credit") || title.includes("wallet") ? "Wallet" : title.includes("request") ? "Requests" : "Updates");
      return { ...activity, category };
    }),
    ...(!apiConfigured ? requests.slice(0, 1).map((request) => ({ id: `notif-${request.id}`, title: `New ${request.direction} request`, detail: `${request.person} · ${request.skill}`, date: request.date, tone: "cyan" as const, category: "Requests", read: false })) : []),
    ...(!apiConfigured ? [{ id: "notif-match", title: "Your next match is waiting", detail: "We found new students who share your learning interests.", date: "Today", tone: "pink" as const, category: "Matches", read: false }] : []),
  ];
  const visible = filter === "All" ? latest : latest.filter((item) => item.category === filter);
  async function markAllRead() {
    try {
      await markNotificationsRead();
      toast.success("You’re all caught up.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update notifications.");
    }
  }
  return <div className="page-stack">
    <PageTitle eyebrow="LITTLE REMINDERS THAT MATTER" title="Your notifications" description="The moments, milestones, and messages that keep you moving." action={<button className="text-link" onClick={() => void markAllRead()}><CheckCheck size={15} /> Mark all as read</button>} />
    <div className="notification-filters">{["All", "Requests", "Sessions", "Wallet", "Matches", "Updates"].map((item) => <button key={item} className={`request-tab ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}</button>)}</div>
    <section className="panel notifications-panel">{visible.length ? visible.map((activity) => {
      const icon = activity.category === "Wallet" ? <Zap size={16} /> : activity.category === "Sessions" ? <CalendarDays size={16} /> : activity.category === "Requests" ? <MessageCircle size={16} /> : <Sparkles size={16} />;
      const tone = activity.category === "Wallet" ? "pink" : activity.category === "Requests" ? "cyan" : activity.tone;
      return <div className={`notification-row ${!activity.read ? "notification-unread" : ""}`} key={activity.id}><span className={`notification-type-icon ${tone}`}>{icon}</span><div className="notification-copy"><b>{activity.title}</b><p>{activity.detail}</p></div><span className="notification-time">{activity.date}</span>{!activity.read && <i className="unread-dot" />}{activity.category === "Matches" && <Link to="/matches" className="text-link">Explore <ArrowRight size={14} /></Link>}</div>;
    }) : <EmptyState icon={<Bell size={22} />} title="All quiet out here" text={`There are no ${filter.toLowerCase()} notifications right now.`} />}</section>
  </div>;
}

function Profile() {
  const { user, updateProfile } = useApp();
  const [profile, setProfile] = useState<Student>(user!);
  const [saving, setSaving] = useState(false);
  const [interests, setInterests] = useState(profile.interests.join(", "));
  const [offered, setOffered] = useState(profile.skillsOffered.join(", "));
  const [wanted, setWanted] = useState(profile.skillsWanted.join(", "));
  function uploadAvatar(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return; }
    if (file.size > 1_500_000) { toast.error("Choose an image smaller than 1.5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") { toast.error("We couldn’t read that image. Please try another."); return; }
      setProfile((current) => ({ ...current, avatar: reader.result as string }));
      toast.success("Profile photo updated. Save your profile to keep it.");
    };
    reader.onerror = () => toast.error("We couldn’t read that image. Please try another.");
    reader.readAsDataURL(file);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const updated = { ...profile, interests: interests.split(",").map((item) => item.trim()).filter(Boolean), skillsOffered: offered.split(",").map((item) => item.trim()).filter(Boolean), skillsWanted: wanted.split(",").map((item) => item.trim()).filter(Boolean) };
    setSaving(true);
    try {
      await updateProfile(updated);
      toast.success("Your profile is looking good. Your matches will keep getting smarter!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }
  const completedFields = [profile.name, profile.email, profile.college, profile.department, profile.year, profile.availability, profile.bio, interests, offered, wanted].filter((value) => value.trim().length > 0).length;
  const profileCompletion = Math.round(completedFields / 10 * 100);
  return <div className="page-stack">
    <PageTitle eyebrow="THIS IS YOUR SPACE" title="A little more about you" description="The more your community knows, the better your matches." action={<span className="profile-completion"><span style={{ width: `${profileCompletion}%` }} /><b>PROFILE {profileCompletion}% COMPLETE</b></span>} />
    <form className="profile-form panel" onSubmit={submit}>
      <div className="profile-hero">
        <Avatar name={profile.name} initials={profile.avatar} size="xl" />
        <div><h2>{profile.name}</h2><p>{profile.college} · {profile.department}</p><span className="profile-member-tag"><Check size={13} /> SkillBridge member</span></div>
        {user?.id ? <label className="field-label profile-avatar-url">Profile photo URL<input type="url" value={profile.avatar.startsWith("http") ? profile.avatar : ""} onChange={(event) => setProfile({ ...profile, avatar: event.target.value })} placeholder="https://…" /></label> : <label className="button button-outline profile-upload">Update photo<input type="file" accept="image/*" onChange={(event) => uploadAvatar(event.target.files?.[0])} /></label>}
      </div>
      <div className="profile-form-grid">
        <div className="profile-form-section">
          <div className="form-section-heading"><span className="form-step">01</span><div><h2>The basics</h2><p>The person behind the skills.</p></div></div>
          <label className="field-label">Full name<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label>
          <label className="field-label">College / university<input value={profile.college} onChange={(event) => setProfile({ ...profile, college: event.target.value })} required /></label>
          <div className="form-row">
            <label className="field-label">Department<input value={profile.department} onChange={(event) => setProfile({ ...profile, department: event.target.value })} /></label>
            <label className="field-label">Year of study<select value={profile.year} onChange={(event) => setProfile({ ...profile, year: event.target.value })}>{["1st year", "2nd year", "3rd year", "4th year", "Graduate student"].map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <label className="field-label">A sentence or two about you<textarea value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} rows={4} maxLength={300} /><small className="field-hint">Help your next learning partner get to know you.</small></label>
          <label className="field-label">When you’re available<select value={profile.availability} onChange={(event) => setProfile({ ...profile, availability: event.target.value })}>{["Flexible", "Weekday evenings", "Weekends"].map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <div className="profile-form-section">
          <div className="form-section-heading"><span className="form-step">02</span><div><h2>Your learning orbit</h2><p>AI matches get better with the right context.</p></div></div>
          <label className="field-label">Skills you love to teach<input value={offered} onChange={(event) => setOffered(event.target.value)} placeholder="React, photography, public speaking" /><small className="field-hint">Separate each skill with a comma.</small></label>
          <label className="field-label">What you’re curious about<input value={wanted} onChange={(event) => setWanted(event.target.value)} placeholder="AI, product design, electronics" /><small className="field-hint">This helps us find the right teachers for you.</small></label>
          <label className="field-label">Outside of class, you love<input value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Music, running, building things" /><small className="field-hint">Interests make for better conversations.</small></label>
          <div className="profile-privacy-note"><Shield size={16} /><span><b>Your profile, your call.</b> Only students in your community can see your learning profile.</span></div>
        </div>
      </div>
      <div className="form-footer"><span>{user?.id ? "Your profile is saved to your SkillBridge account." : "Your changes save locally in demo mode."}</span><Button type="submit" disabled={saving}>{saving ? "Saving profile…" : "Save your profile"} {!saving && <Check size={15} />}</Button></div>
    </form>
  </div>;
}

function SettingsPage() {
  const { user, theme, setTheme, logout } = useApp();
  const [sessionReminders, setSessionReminders] = useState(() => localStorage.getItem("skillbridge-reminders") !== "false");
  const [communityUpdates, setCommunityUpdates] = useState(() => localStorage.getItem("skillbridge-updates") !== "false");
  function updatePreference(key: string, value: boolean, update: (value: boolean) => void) {
    localStorage.setItem(key, String(value));
    update(value);
    toast.success("Your preference has been saved.");
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: "SkillBridge AI demo", exportedAt: new Date().toISOString(), data: JSON.parse(localStorage.getItem("skillbridge-data") ?? "{}") }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "skillbridge-data.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Your demo data has been exported.");
  }
  return <div className="page-stack"><PageTitle eyebrow="MAKE YOUR SPACE YOURS" title="Settings" description="Small adjustments to make your experience feel right." /><div className="settings-sections"><section className="panel settings-panel"><div className="settings-section-head"><span className="settings-icon"><Sun size={18} /></span><div><h2>Appearance</h2><p>Pick the universe you like to learn in.</p></div></div><div className="settings-choice-row"><div><b>Color theme</b><small>Your choice stays saved on this device.</small></div><div className="theme-choice"><button className={theme === "dark" ? "selected" : ""} onClick={() => { setTheme("dark"); toast.success("Dark mode enabled."); }}><Moon size={15} /> Dark</button><button className={theme === "light" ? "selected" : ""} onClick={() => { setTheme("light"); toast.success("Light mode enabled."); }}><Sun size={15} /> Light</button></div></div></section><section className="panel settings-panel"><div className="settings-section-head"><span className="settings-icon cyan"><Bell size={18} /></span><div><h2>Notifications</h2><p>Stay in the loop, without the noise.</p></div></div><ToggleRow title="Session reminders" description="A heads-up before a learning session." value={sessionReminders} onChange={(value) => updatePreference("skillbridge-reminders", value, setSessionReminders)} /><ToggleRow title="Community updates" description="New matches and learning opportunities." value={communityUpdates} onChange={(value) => updatePreference("skillbridge-updates", value, setCommunityUpdates)} /></section><section className="panel settings-panel"><div className="settings-section-head"><span className="settings-icon pink"><Shield size={18} /></span><div><h2>Privacy & your data</h2><p>Your information belongs to you.</p></div></div>{user?.id ? <div className="settings-choice-row"><div><b>Account data is API-backed</b><small>Profile, listings, requests, sessions, and wallet data are stored on the server.</small></div><span className="secure-tag"><Shield size={13} /> Server managed</span></div> : <div className="settings-choice-row"><div><b>Download your data</b><small>Export your local demo profile and activity as JSON.</small></div><Button variant="outline" onClick={exportData}>Export data <ArrowDownRight size={14} /></Button></div>}<div className="settings-choice-row"><div><b>Account security</b><small>Passwords are securely managed by the backend when configured.</small></div><span className="secure-tag"><Shield size={13} /> JWT secured</span></div></section><section className="panel settings-panel logout-panel"><div><h2>Ready to take a break?</h2><p>You can log back in whenever you like.</p></div><Button variant="outline" onClick={() => { logout(); toast.success("You’re signed out."); }}>Sign out <LogOut size={15} /></Button></section></div></div>;
}

function ToggleRow({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="settings-choice-row"><div><b>{title}</b><small>{description}</small></div><button className={`switch ${value ? "switch-on" : ""}`} aria-label={`${value ? "Disable" : "Enable"} ${title}`} aria-pressed={value} onClick={() => onChange(!value)}><i /></button></div>;
}

type AdminUserRow = { id?: string; name: string; email: string; campus: string; credits: number; status: "Active" | "Paused" };
type AdminDisputeRow = { id: string; title: string; parties: string; created: string; status: "Needs review" | "In progress" | "Resolved" | "Dismissed" };
type AdminStatistics = { users: number; activeSkills: number; requests: number; sessions: number; openDisputes: number; transferredCredits: number; pendingWaitlist: number };
type AdminWaitlistRow = { id: string; name: string; email: string; interests: string[]; status: "pending" | "invited" | "joined"; createdAt: string };

function AdminDashboard() {
  const [users, setUsers] = useState<AdminUserRow[]>([
    { name: "Priya Sharma", email: "priya@berkeley.edu", campus: "UC Berkeley", credits: 18, status: "Active" },
    { name: "Jordan Lee", email: "jordan@mit.edu", campus: "MIT", credits: 12, status: "Active" },
    { name: "Sam Rivera", email: "sam@parsons.edu", campus: "Parsons", credits: 9, status: "Active" },
    { name: "Amara Okafor", email: "amara@nyu.edu", campus: "NYU", credits: 23, status: "Active" },
  ]);
  const [disputes, setDisputes] = useState<AdminDisputeRow[]>([
    { id: "D-2048", title: "Session marked complete too early", parties: "2 students", created: "2h ago", status: "Needs review" },
    { id: "D-2047", title: "Unable to join scheduled call", parties: "2 students", created: "Yesterday", status: "In progress" },
  ]);
  return <div className="page-stack"><div className="admin-demo-banner"><Shield size={16} /><span><b>Admin demo workspace.</b> Example data only. Changes stay on this device.</span></div><PageTitle eyebrow="A HEALTHY COMMUNITY, BY DESIGN" title="Community overview" description="A little visibility into how students learn together." action={<span className="admin-period"><span className="live-tag"><i /> LIVE DEMO</span><select aria-label="Reporting period"><option>Last 30 days</option><option>Last 7 days</option><option>This year</option></select></span>} /><div className="stats-grid admin-stats"><StatCard icon={<Users size={18} />} label="STUDENT COMMUNITY" value="2,408" suffix="students" change="+12% this month" tone="violet" /><StatCard icon={<CalendarDays size={18} />} label="LEARNING SESSIONS" value="684" suffix="sessions" change="+8% this month" tone="cyan" /><StatCard icon={<Zap size={18} />} label="CREDITS EXCHANGED" value="1,284" suffix="credits" change="Across 17 campuses" tone="pink" /><StatCard icon={<CircleHelp size={18} />} label="OPEN DISPUTES" value={String(disputes.length)} suffix="to review" change={disputes.length ? "Response within 24h" : "All clear!"} tone="blue" /></div><div className="admin-grid"><section className="panel admin-chart-panel"><div className="panel-heading"><div><span className="eyebrow">COMMUNITY MOMENTUM</span><h2>Learning is on the rise</h2></div><span className="chart-period">Oct 01 — Oct 28</span></div><div className="admin-chart"><div className="admin-chart-grid"><span>200</span><span>150</span><span>100</span><span>50</span><span>0</span></div><div className="admin-chart-bars">{[42, 55, 48, 69, 61, 77, 65, 92, 82, 100, 87, 73].map((height, index) => <div key={index} style={{ height: `${height}%` }} title={`${height * 2} sessions`}><span /></div>)}</div></div><div className="chart-legend"><span><i /> Sessions completed</span><b><ArrowUpRight size={14} /> 18.4% <small>month over month</small></b></div></section><section className="panel campus-panel"><div className="panel-heading"><div><span className="eyebrow">WHERE THE MAGIC HAPPENS</span><h2>Top campuses</h2></div></div>{[["Stanford", "68%", "violet"], ["MIT", "55%", "cyan"], ["UC Berkeley", "41%", "pink"], ["NYU", "36%", "blue"]].map(([campus, percentage, tone]) => <div className="campus-row" key={campus}><span className="campus-dot">{campus.slice(0, 1)}</span><span>{campus}</span><div className="campus-progress"><i className={tone} style={{ width: percentage }} /></div><b>{percentage}</b></div>)}</section></div><section className="panel admin-table-panel"><div className="panel-heading"><div><span className="eyebrow">THE PEOPLE BEHIND THE PROGRESS</span><h2>Student community</h2></div><span className="demo-content-tag">DEMO DATA</span></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>STUDENT</th><th>CAMPUS</th><th>CREDITS</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{users.map((user, index) => <tr key={user.email}><td><div className="table-student"><Avatar name={user.name} size="sm" /><span><b>{user.name}</b><small>{user.email}</small></span></div></td><td>{user.campus}</td><td>{user.credits}</td><td><span className={`admin-status ${user.status.toLowerCase()}`}><i /> {user.status}</span></td><td><button className="table-action" onClick={() => { const status = user.status === "Active" ? "Paused" : "Active"; setUsers((current) => current.map((item, row) => row === index ? { ...item, status } : item)); toast.success(`${user.name}’s demo account is ${status.toLowerCase()}.`); }}>{user.status === "Active" ? "Pause" : "Reactivate"}</button></td></tr>)}</tbody></table></div></section><section className="panel admin-table-panel"><div className="panel-heading"><div><span className="eyebrow">FAIRNESS IS PART OF THE DEAL</span><h2>Community disputes</h2></div><Link to="/sessions" className="text-link">Review workflow <ArrowRight size={14} /></Link></div>{disputes.length ? disputes.map((dispute) => <div className="dispute-row" key={dispute.id}><span className="dispute-case">{dispute.id}</span><div><b>{dispute.title}</b><small>{dispute.parties} · Reported {dispute.created}</small></div><span className={`status-tag ${dispute.status === "Resolved" ? "status-done" : "status-upcoming"}`}>{dispute.status}</span><button className="table-action" disabled={dispute.status === "Resolved"} onClick={() => { setDisputes((current) => current.map((item) => item.id === dispute.id ? { ...item, status: "Resolved" } : item)); toast.success(`${dispute.id} marked resolved in this demo.`); }}>{dispute.status === "Resolved" ? "Resolved" : "Resolve"}</button></div>) : <p className="admin-clear"><Check size={15} /> No open disputes. The community is in good hands.</p>}</section></div>;
}

function LiveAdminDashboard() {
  const [stats, setStats] = useState<AdminStatistics>();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [disputes, setDisputes] = useState<AdminDisputeRow[]>([]);
  const [listings, setListings] = useState<ApiSkill[]>([]);
  const [waitlist, setWaitlist] = useState<AdminWaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [statsResult, usersResult, disputesResult, skillsResult, waitlistResult] = await Promise.all([
          apiGet<{ stats: AdminStatistics }>("/admin/stats"),
          apiGet<{ users: { _id: string; name: string; email: string; college?: string; location?: string; walletBalance: number; isActive: boolean }[] }>("/admin/users?limit=100"),
          apiGet<{ disputes: { _id: string; reason: string; status: string; createdAt: string }[] }>("/admin/disputes?limit=100"),
          apiGet<{ skills: ApiSkill[] }>("/skills?type=offer&limit=100"),
          apiGet<{ entries: AdminWaitlistRow[] }>("/admin/waitlist?limit=100"),
        ]);
        if (!active) return;
        setStats(statsResult.stats);
        setUsers(usersResult.users.map((item) => ({ id: item._id, name: item.name, email: item.email, campus: item.college || item.location || "Student community", credits: item.walletBalance, status: item.isActive ? "Active" : "Paused" })));
        setDisputes(disputesResult.disputes.map((item) => ({ id: item._id, title: item.reason, parties: "2 participants", created: new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }), status: item.status === "resolved" ? "Resolved" : item.status === "dismissed" ? "Dismissed" : item.status === "under_review" ? "In progress" : "Needs review" })));
        setListings(skillsResult.skills);
        setWaitlist(waitlistResult.entries);
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Could not load live admin data.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function toggleUser(row: AdminUserRow, index: number) {
    try {
      await apiPatch(`/admin/users/${encodeURIComponent(row.id ?? "")}/status`, { isActive: row.status !== "Active" });
      setUsers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: row.status === "Active" ? "Paused" : "Active" } : item));
      toast.success(`${row.name}’s account has been updated.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this account.");
    }
  }

  async function resolveDispute(dispute: AdminDisputeRow) {
    const resolution = window.prompt("Add a short resolution note (required):");
    if (!resolution || resolution.trim().length < 3) {
      if (resolution !== null) toast.error("Add at least 3 characters to close this dispute.");
      return;
    }
    try {
      await apiPatch(`/admin/disputes/${encodeURIComponent(dispute.id)}`, { status: "resolved", resolution: resolution.trim() });
      setDisputes((current) => current.map((item) => item.id === dispute.id ? { ...item, status: "Resolved" } : item));
      toast.success("The dispute was resolved and the participants were notified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resolve this dispute.");
    }
  }

  async function removeListing(skill: ApiSkill) {
    if (!window.confirm(`Deactivate “${skill.title}”?`)) return;
    try {
      await apiDelete(`/skills/${encodeURIComponent(skill._id)}`);
      setListings((current) => current.filter((item) => item._id !== skill._id));
      toast.success("Listing deactivated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not deactivate listing.");
    }
  }

  async function updateWaitlist(entry: AdminWaitlistRow, status: AdminWaitlistRow["status"]) {
    try {
      await apiPatch(`/admin/waitlist/${encodeURIComponent(entry.id)}`, { status });
      setWaitlist((current) => current.map((item) => item.id === entry.id ? { ...item, status } : item));
      toast.success(`${entry.email} is marked ${status}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this waitlist entry.");
    }
  }

  return <div className="page-stack">
    <div className="admin-demo-banner"><Shield size={16} /><span><b>Live admin workspace.</b> User, dispute, listing, and platform data come from the API.</span></div>
    <PageTitle eyebrow="A HEALTHY COMMUNITY, BY DESIGN" title="Community overview" description="Moderate members and listings, and help resolve disputes." action={<span className="live-tag"><i /> LIVE API DATA</span>} />
    <div className="stats-grid admin-stats">
      <StatCard icon={<Users size={18} />} label="STUDENT COMMUNITY" value={String(stats?.users ?? 0)} suffix="students" change={loading ? "Loading" : `${stats?.pendingWaitlist ?? 0} on waitlist`} tone="violet" />
      <StatCard icon={<CalendarDays size={18} />} label="LEARNING SESSIONS" value={String(stats?.sessions ?? 0)} suffix="sessions" change={`${stats?.requests ?? 0} exchange requests`} tone="cyan" />
      <StatCard icon={<Zap size={18} />} label="CREDITS EXCHANGED" value={String(stats?.transferredCredits ?? 0)} suffix="credits" change={`${stats?.activeSkills ?? 0} active listings`} tone="pink" />
      <StatCard icon={<CircleHelp size={18} />} label="OPEN DISPUTES" value={String(stats?.openDisputes ?? 0)} suffix="to review" change={stats?.openDisputes ? "Review and resolve" : "All clear"} tone="blue" />
    </div>
    <section className="panel admin-table-panel">
      <div className="panel-heading"><div><span className="eyebrow">ACCOUNT SAFETY</span><h2>Student community</h2></div><span className="live-tag"><i /> API CONNECTED</span></div>
      {users.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>STUDENT</th><th>CAMPUS</th><th>WALLET</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{users.map((row, index) => <tr key={row.id}><td><div className="table-student"><Avatar name={row.name} size="sm" /><span><b>{row.name}</b><small>{row.email}</small></span></div></td><td>{row.campus}</td><td>{row.credits} credits</td><td><span className={`admin-status ${row.status.toLowerCase()}`}><i /> {row.status}</span></td><td><button className="table-action" onClick={() => void toggleUser(row, index)}>{row.status === "Active" ? "Pause account" : "Reactivate"}</button></td></tr>)}</tbody></table></div> : <p className="admin-clear">{loading ? "Loading student accounts…" : "No student accounts found."}</p>}
    </section>
    <section className="panel admin-table-panel">
      <div className="panel-heading"><div><span className="eyebrow">LISTING QUALITY</span><h2>Skill listings</h2></div><span className="live-tag"><i /> {listings.length} ACTIVE</span></div>
      {listings.length ? listings.map((skill) => <div className="dispute-row" key={skill._id}><span className="dispute-case">{skill.category}</span><div><b>{skill.title}</b><small>{typeof skill.owner === "string" ? "Student listing" : `${skill.owner.name} · ${skill.owner.location ?? "Student community"}`}</small></div><button className="table-action" onClick={() => void removeListing(skill)}>Deactivate</button></div>) : <p className="admin-clear">{loading ? "Loading skill listings…" : "No active skill listings."}</p>}
    </section>
    <section className="panel admin-table-panel">
      <div className="panel-heading"><div><span className="eyebrow">FAIRNESS IS PART OF THE DEAL</span><h2>Community disputes</h2></div><span className="live-tag"><i /> {disputes.length} CASES</span></div>
      {disputes.length ? disputes.map((dispute) => <div className="dispute-row" key={dispute.id}><span className="dispute-case">{dispute.id.slice(-8)}</span><div><b>{dispute.title}</b><small>{dispute.parties} · Reported {dispute.created}</small></div><span className={`status-tag ${dispute.status === "Resolved" || dispute.status === "Dismissed" ? "status-done" : "status-upcoming"}`}>{dispute.status}</span><button className="table-action" disabled={dispute.status === "Resolved" || dispute.status === "Dismissed"} onClick={() => void resolveDispute(dispute)}>{dispute.status === "Resolved" ? "Resolved" : dispute.status === "Dismissed" ? "Dismissed" : "Resolve"}</button></div>) : <p className="admin-clear">{loading ? "Loading disputes…" : <><Check size={15} /> No open disputes. The community is in good hands.</>}</p>}
    </section>
    <section className="panel admin-table-panel">
      <div className="panel-heading"><div><span className="eyebrow">NEXT UP FOR THE COMMUNITY</span><h2>Waitlist</h2></div><span className="live-tag"><i /> {waitlist.length} ENTRIES</span></div>
      {waitlist.length ? waitlist.map((entry) => <div className="dispute-row" key={entry.id}><span className="dispute-case">{entry.status.toUpperCase()}</span><div><b>{entry.name || entry.email}</b><small>{entry.name ? `${entry.email} · ` : ""}{new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{entry.interests.length ? ` · ${entry.interests.join(", ")}` : ""}</small></div><select aria-label={`Waitlist status for ${entry.email}`} value={entry.status} onChange={(event) => void updateWaitlist(entry, event.target.value as AdminWaitlistRow["status"])}><option value="pending">Pending</option><option value="invited">Invited</option><option value="joined">Joined</option></select></div>) : <p className="admin-clear">{loading ? "Loading waitlist…" : "No waitlist entries yet."}</p>}
    </section>
  </div>;
}

function AdminRoute() {
  const { user } = useApp();
  if (user?.role !== "admin") return <Protected><div className="page-stack"><EmptyState icon={<Shield size={22} />} title="This space is for admins" text="Switch to the admin demo account to explore community tools." action={<Link className="button button-primary" to="/login">Try admin demo <ArrowRight size={15} /></Link>} /></div></Protected>;
  return <Protected>{user.id ? <LiveAdminDashboard /> : <AdminDashboard />}</Protected>;
}

function NotFound() {
  return <div className="not-found"><span className="empty-state-icon"><Sparkles size={25} /></span><span className="eyebrow">A LITTLE OFF COURSE</span><h1>This page drifted<br />into another <span className="gradient-text">galaxy.</span></h1><p>Let’s get you somewhere good.</p><Link className="button button-primary" to="/">Back to SkillBridge <ArrowRight size={15} /></Link></div>;
}

export default function App() {
  const { user } = useApp();
  return <Routes>
    <Route path="/" element={user ? <Navigate to="/app" replace /> : <Landing />} />
    <Route path="/login" element={user ? <Navigate to="/app" replace /> : <AuthPage mode="login" />} />
    <Route path="/register" element={user ? <Navigate to="/app" replace /> : <AuthPage mode="register" />} />
    <Route path="/app" element={<Protected><Dashboard /></Protected>} />
    <Route path="/explore" element={<Protected><Explore /></Protected>} />
    <Route path="/skills/:skillId" element={<Protected><SkillDetails /></Protected>} />
    <Route path="/matches" element={<Protected><Matches /></Protected>} />
    <Route path="/create" element={<Protected><CreateListing /></Protected>} />
    <Route path="/my-listings" element={<Protected><MyListings /></Protected>} />
    <Route path="/requests" element={<Protected><Requests /></Protected>} />
    <Route path="/sessions" element={<Protected><Sessions /></Protected>} />
    <Route path="/wallet" element={<Protected><WalletPage /></Protected>} />
    <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
    <Route path="/profile" element={<Protected><Profile /></Protected>} />
    <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
    <Route path="/admin" element={<AdminRoute />} />
    <Route path="*" element={<NotFound />} />
  </Routes>;
}
