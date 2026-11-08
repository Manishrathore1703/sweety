import { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarRange,
  Clock3,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  PencilLine,
  PlusCircle,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatStatus, getRequestDisplayName, slotLabels } from '../utils/dashboard';

const today = new Date().toISOString().slice(0, 10);

const defaultReading = {
  reading_date: today,
  time_slot: 'morning_fasting',
  glucose_value: '',
};

const reportTypes = [
  { value: 'daily', label: 'Daily' },
  { value: 'month-to-date', label: 'Month to date' },
  { value: 'previous-month', label: 'Previous month' },
];

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { section = 'overview' } = useParams();
  const { user, logout } = useAuth();
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultReading);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reportType, setReportType] = useState('daily');
  const [reportDate, setReportDate] = useState(today);
  const [report, setReport] = useState(null);
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorLookup, setDoctorLookup] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);

  const loadReadings = async (date = null) => {
    try {
      const response = await api.get('/readings', {
        params: { page: 1, limit: 20, ...(date ? { date } : {}) },
      });
      setReadings(response.data.readings || []);
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const loadReports = async (nextType = reportType, nextDate = reportDate) => {
    try {
      const endpoint = nextType === 'daily' ? 'daily' : nextType === 'month-to-date' ? 'month-to-date' : 'previous-month';
      const response = await api.get(`/reports/${endpoint}`, {
        params: { date: nextDate },
      });
      setReport(response.data.report || null);
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const loadRequests = async () => {
    try {
      const [sentResponse, receivedResponse] = await Promise.all([
        api.get('/doctor-requests/sent'),
        api.get('/doctor-requests/received'),
      ]);

      setSentRequests(sentResponse.data.requests || []);
      setReceivedRequests(receivedResponse.data.requests || []);
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        await Promise.all([loadReadings(), loadReports(), loadRequests()]);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveReading = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const payload = {
        reading_date: form.reading_date,
        time_slot: form.time_slot,
        glucose_value: Number(form.glucose_value),
      };

      if (editingId) {
        await api.put(`/readings/${editingId}`, payload);
        setMessage('Reading updated successfully.');
      } else {
        await api.post('/readings', payload);
        setMessage('Reading added successfully.');
      }

      setForm(defaultReading);
      setEditingId(null);
      await Promise.all([loadReadings(), loadReports(), loadRequests()]);
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const handleEdit = (reading) => {
    setEditingId(reading.id);
    setForm({
      reading_date: reading.reading_date,
      time_slot: reading.time_slot,
      glucose_value: reading.glucose_value,
    });
    setMessage('');
    navigate('/patient/entry');
  };

  const deleteReading = async (id) => {
    try {
      await api.delete(`/readings/${id}`);
      setMessage('Reading removed.');
      await Promise.all([loadReadings(), loadReports(), loadRequests()]);
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const searchDoctor = async (event) => {
    event.preventDefault();
    setConnectionStatus('');

    try {
      const response = await api.get('/doctors/search', {
        params: { email: doctorEmail },
      });
      setDoctorLookup(response.data.doctor);
      if (!response.data.doctor) {
        setConnectionStatus('No matching doctor was found for that email.');
      }
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const sendConnectionRequest = async () => {
    if (!doctorLookup) {
      setConnectionStatus('Search for a doctor before sending a request.');
      return;
    }

    try {
      const response = await api.post('/doctor-requests', {
        doctor_email: doctorLookup.email,
      });
      setConnectionStatus(response.data.message);
      setDoctorLookup(null);
      setDoctorEmail('');
      await loadRequests();
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const updateRequestStatus = async (id, action) => {
    try {
      const response = await api.patch(`/doctor-requests/${id}/${action}`);
      setConnectionStatus(response.data.message);
      await loadRequests();
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const stats = report?.statistics ?? {
    maximum: null,
    minimum: null,
    average: null,
    total_readings: 0,
  };
  const displayName = user?.name || 'Patient';
  const firstName = displayName.split(' ')[0];
  const validSections = ['overview', 'entry', 'reports', 'history', 'connections'];
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  if (loading) {
    return <div className="loading-screen">Loading your patient dashboard…</div>;
  }

  if (!validSections.includes(section)) {
    return <Navigate to="/patient" replace />;
  }

  return (
    <div className="page-shell patient-dashboard">
      <nav className="patient-navbar" aria-label="Patient dashboard">
        <Link className="patient-brand" to="/patient" aria-label="Sweety dashboard home">
          <span className="patient-brand-icon"><HeartPulse size={20} /></span>
          <span>Sweety</span>
        </Link>

        <div className="patient-nav-links">
          <NavLink to="/patient" end><LayoutDashboard size={16} />Overview</NavLink>
          <NavLink to="/patient/entry"><PlusCircle size={16} />Entry</NavLink>
          <NavLink to="/patient/reports"><BarChart3 size={16} />Reports</NavLink>
          <NavLink to="/patient/history"><Activity size={16} />History</NavLink>
          <NavLink to="/patient/connections"><UserRound size={16} />Care team</NavLink>
        </div>

        <div className="patient-account">
          <span className="patient-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
          <span className="patient-account-name">{displayName}</span>
          <button className="ghost-button patient-logout" type="button" onClick={() => { logout(); navigate('/auth', { replace: true }); }}>
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      </nav>

      {error && section !== 'entry' ? <p className="error-banner" role="alert">{error}</p> : null}

      {section === 'overview' ? (
        <>
          <header className="patient-welcome">
            <div>
              <p className="eyebrow">Your health, at a glance</p>
              <h1>Good to see you, {firstName}.</h1>
              <p className="patient-welcome-copy">Keep your care on track, one reading at a time.</p>
            </div>
            <div className="patient-date"><CalendarRange size={17} />{formattedDate}</div>
          </header>
          <section className="card patient-overview-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Your snapshot</p>
                <h2>Latest report</h2>
              </div>
              <Link className="secondary-button compact" to="/patient/reports">View reports</Link>
            </div>
            <div className="stats-grid">
              <div className="stat-tile stat-average">
                <span>Average</span>
                <strong>{stats.average ?? '—'} mg/dL</strong>
              </div>
              <div className="stat-tile stat-maximum">
                <span>Maximum</span>
                <strong>{stats.maximum ?? '—'} mg/dL</strong>
              </div>
              <div className="stat-tile stat-minimum">
                <span>Minimum</span>
                <strong>{stats.minimum ?? '—'} mg/dL</strong>
              </div>
              <div className="stat-tile stat-count">
                <span>Readings</span>
                <strong>{stats.total_readings ?? 0}</strong>
              </div>
            </div>
            <div className="patient-overview-actions">
              <Link className="primary-button" to="/patient/entry"><PlusCircle size={16} />Add a reading</Link>
              <Link className="ghost-button" to="/patient/history">View reading history</Link>
            </div>
          </section>
        </>
      ) : (
        <header className="patient-page-heading">
          <p className="eyebrow">Patient portal</p>
          <h1>{{
            entry: 'Add a reading',
            reports: 'Your reports',
            history: 'Reading history',
            connections: 'Your care team',
          }[section]}</h1>
          <p>{{
            entry: 'Log a blood glucose reading to keep your records up to date.',
            reports: 'Review your blood glucose measurements across different time periods.',
            history: 'Review and manage your recent glucose readings.',
            connections: 'Connect with your doctor and manage care requests.',
          }[section]}</p>
        </header>
      )}

      {section === 'entry' ? (
      <div className="dashboard-grid">
        <section className="card form-card patient-reading-entry" id="add-reading">
          <div className="section-header">
            <div>
              <p className="eyebrow">Entry</p>
              <h2>{editingId ? 'Edit reading' : 'Add glucose reading'}</h2>
            </div>
            <div className="icon-badge primary">
              <PlusCircle size={18} />
            </div>
          </div>

          <form onSubmit={saveReading} className="stacked-form">
            <label>
              <span>Date</span>
              <input
                type="date"
                name="reading_date"
                value={form.reading_date}
                onChange={handleFormChange}
                required
              />
            </label>

            <label>
              <span>Time slot</span>
              <select name="time_slot" value={form.time_slot} onChange={handleFormChange}>
                {Object.entries(slotLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Glucose value (mg/dL)</span>
              <input
                type="number"
                name="glucose_value"
                min="40"
                max="600"
                step="1"
                value={form.glucose_value}
                onChange={handleFormChange}
                placeholder="e.g. 110"
                required
              />
            </label>

            {message ? <p className="success-banner" role="status">{message}</p> : null}
            {error ? <p className="error-banner" role="alert">{error}</p> : null}

            <div className="button-row">
              <button type="submit" className="primary-button">
                {editingId ? 'Update reading' : 'Save reading'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(defaultReading);
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
      ) : null}

      {section === 'reports' ? (
      <div className="dashboard-grid">
        <section className="card patient-report-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Reports</p>
              <h2>Blood sugar trend</h2>
            </div>
            <div className="icon-badge secondary">
              <BarChart3 size={18} />
            </div>
          </div>

          <div className="selector-row">
            <label>
              <span>Period</span>
              <select value={reportType} onChange={(event) => {
                const nextType = event.target.value;
                setReportType(nextType);
                loadReports(nextType, reportDate);
              }}>
                {reportTypes.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Date</span>
              <input
                type="date"
                value={reportDate}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setReportDate(nextDate);
                  loadReports(reportType, nextDate);
                }}
              />
            </label>
          </div>

          <div className="stats-grid">
            <div className="stat-tile stat-average">
              <span>Average</span>
              <strong>{stats.average ?? '—'} mg/dL</strong>
            </div>
            <div className="stat-tile stat-maximum">
              <span>Maximum</span>
              <strong>{stats.maximum ?? '—'} mg/dL</strong>
            </div>
            <div className="stat-tile stat-minimum">
              <span>Minimum</span>
              <strong>{stats.minimum ?? '—'} mg/dL</strong>
            </div>
            <div className="stat-tile highlight stat-count">
              <span>Readings</span>
              <strong>{stats.total_readings ?? 0}</strong>
            </div>
          </div>

          {report?.readings?.length ? (
            <div className="reading-list compact">
              {report.readings.map((reading) => (
                <div key={reading.id} className="reading-item report-reading-item">
                  <div>
                    <strong>{slotLabels[reading.time_slot]}</strong>
                    <small>{reading.reading_date}</small>
                  </div>
                  <span className="reading-value">{reading.glucose_value} mg/dL</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No readings for the selected period.</p>
          )}
        </section>
      </div>
      ) : null}

      {section === 'history' ? (
      <div className="dashboard-grid">
        <section className="card patient-history-card" id="readings">
          <div className="section-header">
            <div>
              <p className="eyebrow">History</p>
              <h2>Recent readings</h2>
            </div>
            <div className="icon-badge tertiary">
              <CalendarRange size={18} />
            </div>
          </div>

          <div className="reading-list">
            {readings.length ? (
              readings.map((reading) => (
                <article key={reading.id} className="reading-row">
                  <div className="reading-summary">
                    <div className="icon-badge small neutral">
                      <Clock3 size={14} />
                    </div>
                    <div>
                      <strong>{slotLabels[reading.time_slot]}</strong>
                      <small>{reading.reading_date}</small>
                    </div>
                  </div>

                  <div className="reading-meta">
                    <span className="reading-value">{reading.glucose_value} mg/dL</span>
                    <div className="mini-actions">
                      <button type="button" onClick={() => handleEdit(reading)} aria-label="Edit reading">
                        <PencilLine size={14} />
                      </button>
                      <button type="button" className="danger" onClick={() => deleteReading(reading.id)} aria-label="Delete reading">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-state">No glucose readings yet. Add your first reading above.</p>
            )}
          </div>
        </section>
      </div>
      ) : null}

      {section === 'connections' ? (
      <div className="dashboard-grid">
        <section className="card patient-connections-card" id="care-team">
          <div className="section-header">
            <div>
              <p className="eyebrow">Connections</p>
              <h2>Doctor access</h2>
            </div>
            <div className="icon-badge tertiary">
              <UserRound size={18} />
            </div>
          </div>

          <form className="inline-search" onSubmit={searchDoctor}>
            <input
              type="email"
              value={doctorEmail}
              onChange={(event) => setDoctorEmail(event.target.value)}
              placeholder="doctor@example.com"
              aria-label="Search for a doctor by email"
            />
            <button type="submit" className="primary-button compact">
              <Search size={16} />
              Search
            </button>
          </form>

          {doctorLookup ? (
            <div className="result-box">
              <div>
                <strong>{doctorLookup.name}</strong>
                <p>{doctorLookup.email}</p>
              </div>
              <button type="button" className="primary-button compact" onClick={sendConnectionRequest}>
                Send request
              </button>
            </div>
          ) : null}

          {connectionStatus ? <p className="success-banner" role="status">{connectionStatus}</p> : null}

          <div className="request-panel">
            <h3>Sent requests</h3>
            {sentRequests.length ? (
              <ul>
                {sentRequests.map((request) => (
                  <li key={request.id}>
                    <span>{getRequestDisplayName(request)}</span>
                    <span className={`status-pill ${request.status}`}>{formatStatus(request.status)}</span>
                    {request.status === 'pending' ? (
                      <button type="button" className="secondary-button compact" onClick={() => updateRequestStatus(request.id, 'cancel')}>
                        Cancel
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state small">No sent requests.</p>
            )}
          </div>

          <div className="request-panel">
            <h3>Received requests</h3>
            {receivedRequests.length ? (
              <ul>
                {receivedRequests.map((request) => (
                  <li key={request.id}>
                    <span>{getRequestDisplayName(request)}</span>
                    <span className={`status-pill ${request.status}`}>{formatStatus(request.status)}</span>
                    {request.status === 'pending' ? (
                      <div className="mini-actions inline-actions">
                        <button type="button" className="secondary-button compact" onClick={() => updateRequestStatus(request.id, 'accept')}>Accept</button>
                        <button type="button" className="ghost-button compact" onClick={() => updateRequestStatus(request.id, 'reject')}>Reject</button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state small">No received requests.</p>
            )}
          </div>
        </section>
      </div>
      ) : null}
    </div>
  );
}
