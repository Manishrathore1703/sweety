import { ArrowRight, Activity, ShieldCheck, BarChart3, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="brand-mark">
          <Activity size={24} />
          <span>Sweety</span>
        </div>

        <Link className="primary-button compact" to="/auth">
          Sign in
          <ArrowRight size={16} />
        </Link>
      </header>

      <main className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Blood glucose tracker</p>
          <h1>Monitor diabetic readings with clarity and confidence.</h1>
          <p className="hero-subtext">
            Track daily glucose patterns, review trend reports, and stay connected with your assigned doctor.
          </p>

          <div className="cta-row">
            <Link className="primary-button" to="/auth">
              Get started
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <ShieldCheck size={18} />
              <h3>Secure access</h3>
              <p>Role-based patient and doctor workflows with protected dashboards.</p>
            </div>
            <div className="feature-card">
              <BarChart3 size={18} />
              <h3>Trend reports</h3>
              <p>Daily, month-to-date, and previous-month glucose summaries.</p>
            </div>
            <div className="feature-card">
              <Users size={18} />
              <h3>Doctor support</h3>
              <p>Invite and manage patient connections with clear approval flow.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
