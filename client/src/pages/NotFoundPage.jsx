import { Home, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The page you were looking for does not exist or is no longer available.</p>

        <div className="button-row">
          <Link className="primary-button" to="/">
            <Home size={16} />
            Back to home
          </Link>
          <Link className="secondary-button" to="/auth">
            <ArrowLeft size={16} />
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
