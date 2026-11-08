import { useEffect, useState } from 'react';
import { BarChart3, CalendarRange, Clock3, Droplets, LogOut, PencilLine, PlusCircle, Search, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const slotLabels = {
  morning_fasting: 'Morning fasting',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

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

  const getRequestLabel = (request) => request.other_user_name || request.other_user_email || 'Request contact';

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

  if (loading) {
    return <div className="loading-screen">Loading your patient dashboard…</div>;
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Patient portal</p>
          <h1>Welcome, {user?.name || 'Patient'}</h1>
        </div>

        <button className="ghost-button" type="button" onClick={() => { logout(); navigate('/auth', { replace: true }); }}>
          <LogOut size={16} />
          Log out
        </button>
      </header>

      <div className="dashboard-grid dashboard-grid-two">
        <section className="card form-card">
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

            {message ? <p className="success-banner">{message}</p> : null}
            {error ? <p className="error-banner">{error}</p> : null}

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

        <section className="card">
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
            <div className="stat-tile">
              <span>Average</span>
              <strong>{stats.average ?? '—'} mg/dL</strong>
            </div>
            <div className="stat-tile">
              <span>Maximum</span>
              <strong>{stats.maximum ?? '—'} mg/dL</strong>
            </div>
            <div className="stat-tile">
              <span>Minimum</span>
              <strong>{stats.minimum ?? '—'} mg/dL</strong>
            </div>
            <div className="stat-tile highlight">
              <span>Readings</span>
              <strong>{stats.total_readings ?? 0}</strong>
            </div>
          </div>

          {report?.readings?.length ? (
            <div className="reading-list compact">
              {report.readings.map((reading) => (
                <div key={reading.id} className="reading-item">
                  <div>
                    <strong>{slotLabels[reading.time_slot]}</strong>
                    <small>{reading.reading_date}</small>
                  </div>
                  <span>{reading.glucose_value} mg/dL</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No readings for the selected period.</p>
          )}
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid-two bottom-grid">
        <section className="card">
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
                    <span>{reading.glucose_value} mg/dL</span>
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

        <section className="card">
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

          {connectionStatus ? <p className="success-banner">{connectionStatus}</p> : null}

          <div className="request-panel">
            <h3>Sent requests</h3>
            {sentRequests.length ? (
              <ul>
                {sentRequests.map((request) => (
                  <li key={request.id}>
                    <span>{getRequestLabel(request)}</span>
                    <span className="status-pill">{request.status}</span>
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
                    <span>{getRequestLabel(request)}</span>
                    <span className="status-pill">{request.status}</span>
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
    </div>
  );
}
