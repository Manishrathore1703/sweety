import { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatStatus, getRequestDisplayName, slotLabels } from '../utils/dashboard';

const today = new Date().toISOString().slice(0, 10);
const reportTypes = [
  { value: 'daily', label: 'Daily' },
  { value: 'month-to-date', label: 'Month to date' },
  { value: 'previous-month', label: 'Previous month' },
];

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { section = 'overview' } = useParams();
  const { user, logout } = useAuth();
  const [patients, setPatients] = useState([]);
  const [history, setHistory] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [patientLookup, setPatientLookup] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusIsError, setStatusIsError] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [reportType, setReportType] = useState('daily');
  const [reportDate, setReportDate] = useState(today);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const fetchDoctorData = async () => {
    try {
      const [patientsResponse, historyResponse, sentResponse, receivedResponse] = await Promise.all([
        api.get('/doctor/patients'),
        api.get('/doctor/assignments/history'),
        api.get('/doctor-requests/sent'),
        api.get('/doctor-requests/received'),
      ]);

      setPatients(patientsResponse.data.patients || []);
      setHistory(historyResponse.data.assignments || []);
      setSentRequests(sentResponse.data.requests || []);
      setReceivedRequests(receivedResponse.data.requests || []);
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  useEffect(() => {
    fetchDoctorData();
  }, []);

  const searchPatient = async (event) => {
    event.preventDefault();
    setStatusMessage('');
    setStatusIsError(false);
    setPatientLookup(null);

    try {
      const response = await api.get('/patients/search', {
        params: { email: searchEmail },
      });
      setPatientLookup(response.data.patient);
      if (!response.data.patient) {
        setStatusIsError(true);
        setStatusMessage('No patient matched that email.');
      }
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const invitePatient = async () => {
    if (!patientLookup) {
      setStatusMessage('Search for a patient before sending an invitation.');
      return;
    }

    try {
      const response = await api.post('/doctor-requests', {
        patient_email: patientLookup.email,
      });
      setStatusIsError(false);
      setStatusMessage(response.data.message);
      setPatientLookup(null);
      setSearchEmail('');
      await fetchDoctorData();
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const updateRequestStatus = async (id, action) => {
    try {
      const response = await api.patch(`/doctor-requests/${id}/${action}`);
      setStatusIsError(false);
      setStatusMessage(response.data.message);
      await fetchDoctorData();
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const loadPatientReport = async (patientId, nextType = reportType, nextDate = reportDate) => {
    if (!patientId) {
      setReport(null);
      return;
    }

    try {
      const endpoint = nextType === 'daily' ? 'daily' : nextType === 'month-to-date' ? 'month-to-date' : 'previous-month';
      const response = await api.get(`/doctor/patients/${patientId}/reports/${endpoint}`, {
        params: { date: nextDate },
      });
      setReport(response.data.report || null);
    } catch (caughtError) {
      setError(getApiError(caughtError));
    }
  };

  const endAssignment = async (assignmentId) => {
    try {
      const response = await api.post(`/doctor/assignments/${assignmentId}/end`);
      setStatusMessage(response.data.message);
      await fetchDoctorData();
      if (selectedPatientId) {
        setReport(null);
      }
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
  const pendingRequestCount = [...sentRequests, ...receivedRequests]
    .filter((request) => request.status === 'pending').length;
  const displayName = user?.name || 'Doctor';
  const firstName = displayName.split(' ')[0];
  const validSections = ['overview', 'invite', 'assignments', 'requests', 'monitoring', 'history'];
  const sectionDetails = {
    invite: ['Invite a patient', 'Find a patient and send a secure connection request.'],
    assignments: ['Your assignments', 'Review and manage patients currently in your care.'],
    requests: ['Connection requests', 'Respond to incoming requests and track your invitations.'],
    monitoring: ['Patient monitoring', 'Review glucose readings for your assigned patients.'],
    history: ['Assignment history', 'Review your past and current patient assignments.'],
  };

  if (!validSections.includes(section)) {
    return <Navigate to="/doctor" replace />;
  }

  return (
    <div className="page-shell doctor-dashboard">
      <nav className="doctor-navbar" aria-label="Doctor dashboard">
        <Link className="doctor-brand" to="/doctor" aria-label="Sweety doctor dashboard home">
          <span className="doctor-brand-icon"><HeartPulse size={20} /></span>
          <span>Sweety <small>Care</small></span>
        </Link>

        <div className="doctor-nav-links">
          <NavLink to="/doctor" end><LayoutDashboard size={16} />Overview</NavLink>
          <NavLink to="/doctor/invite"><UserPlus size={16} />Invite</NavLink>
          <NavLink to="/doctor/assignments"><Users size={16} />Assignments</NavLink>
          <NavLink to="/doctor/requests"><ClipboardList size={16} />Requests</NavLink>
          <NavLink to="/doctor/monitoring"><Activity size={16} />Monitoring</NavLink>
          <NavLink to="/doctor/history"><XCircle size={16} />History</NavLink>
        </div>

        <div className="doctor-account">
          <span className="doctor-avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
          <span className="doctor-account-name">{displayName}</span>
          <button type="button" className="ghost-button doctor-logout" onClick={() => { logout(); navigate('/auth', { replace: true }); }}>
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      </nav>

      {error ? <p className="error-banner" role="alert">{error}</p> : null}
      {statusMessage && section !== 'invite' && section !== 'requests' ? (
        <p className={statusIsError ? 'error-banner' : 'success-banner'} role={statusIsError ? 'alert' : 'status'}>{statusMessage}</p>
      ) : null}

      {section === 'overview' ? (
        <>
          <header className="doctor-welcome">
            <div>
              <p className="eyebrow">Doctor portal</p>
              <h1>Welcome back, {firstName}.</h1>
              <p className="doctor-welcome-copy">A clear view of your patients and their care.</p>
            </div>
            <Link className="primary-button" to="/doctor/monitoring"><Activity size={16} />Monitor patients</Link>
          </header>
          <section className="doctor-overview-grid">
            <article className="card doctor-overview-stat">
              <span className="doctor-overview-icon"><Users size={19} /></span>
              <div><span>Active patients</span><strong>{patients.length}</strong></div>
              <Link to="/doctor/assignments">View assignments</Link>
            </article>
            <article className="card doctor-overview-stat">
              <span className="doctor-overview-icon requests"><ClipboardList size={19} /></span>
              <div><span>Pending requests</span><strong>{pendingRequestCount}</strong></div>
              <Link to="/doctor/requests">Review requests</Link>
            </article>
            <article className="card doctor-overview-stat">
              <span className="doctor-overview-icon history"><Activity size={19} /></span>
              <div><span>Assignment records</span><strong>{history.length}</strong></div>
              <Link to="/doctor/history">View history</Link>
            </article>
          </section>
          <section className="card doctor-overview-actions">
            <div>
              <p className="eyebrow">Quick action</p>
              <h2>Bring a patient into your care</h2>
              <p>Search by email to send a connection invitation.</p>
            </div>
            <Link className="primary-button" to="/doctor/invite"><UserPlus size={16} />Invite a patient</Link>
          </section>
        </>
      ) : (
        <header className="doctor-page-heading">
          <p className="eyebrow">Doctor portal</p>
          <h1>{sectionDetails[section][0]}</h1>
          <p>{sectionDetails[section][1]}</p>
        </header>
      )}

      {section === 'invite' ? (
      <div className="dashboard-grid">
        <section className="card form-card doctor-search-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Invite</p>
              <h2>Connect with a patient</h2>
            </div>
            <div className="icon-badge primary">
              <UserPlus size={18} />
            </div>
          </div>

          <form className="inline-search" onSubmit={searchPatient}>
            <input
              type="email"
              value={searchEmail}
              onChange={(event) => setSearchEmail(event.target.value)}
              placeholder="patient@example.com"
              aria-label="Search for a patient by email"
            />
            <button type="submit" className="primary-button compact">
              <Search size={16} />
              Search
            </button>
          </form>

          {patientLookup ? (
            <div className="result-box">
              <div>
                <strong>{patientLookup.name}</strong>
                <p>{patientLookup.email}</p>
              </div>
              <button type="button" className="primary-button compact" onClick={invitePatient}>
                Send invite
              </button>
            </div>
          ) : null}

          {statusMessage ? (
            <p className={statusIsError ? 'error-banner' : 'success-banner'} role={statusIsError ? 'alert' : 'status'}>
              {statusMessage}
            </p>
          ) : null}
        </section>
      </div>
      ) : null}

      {section === 'assignments' ? (
      <div className="dashboard-grid">
        <section className="card doctor-patients-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Assignments</p>
              <h2>Active patients</h2>
            </div>
            <div className="icon-badge secondary">
              <ShieldCheck size={18} />
            </div>
          </div>

          {patients.length ? (
            <ul className="patient-list">
              {patients.map((patient) => (
                <li key={patient.id} className="list-row">
                  <div>
                    <strong>{patient.name}</strong>
                    <small>{patient.email}</small>
                  </div>
                  <div className="mini-actions inline-actions">
                    <button type="button" className="secondary-button compact" onClick={() => {
                      setSelectedPatientId(patient.id);
                      loadPatientReport(patient.id);
                      navigate('/doctor/monitoring');
                    }}>
                      View report
                    </button>
                    <button type="button" className="ghost-button compact" onClick={() => endAssignment(patient.assignment_id)}>
                      End assignment
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No active patient assignments.</p>
          )}
        </section>
      </div>
      ) : null}

      {section === 'requests' ? (
      <div className="dashboard-grid">
        <section className="card doctor-requests-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Requests</p>
              <h2>Connection workflow</h2>
            </div>
            <div className="icon-badge tertiary">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="request-panel">
            <h3>Sent</h3>
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
            <h3>Received</h3>
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

      {section === 'monitoring' ? (
      <div className="dashboard-grid">
        <section className="card doctor-report-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Monitoring</p>
              <h2>Patient report</h2>
            </div>
            <div className="icon-badge secondary">
              <BarChart3 size={18} />
            </div>
          </div>

          <label>
            <span>Select patient</span>
            <select value={selectedPatientId} onChange={(event) => {
              const nextId = event.target.value;
              setSelectedPatientId(nextId);
              setReport(null);
              if (nextId) {
                loadPatientReport(nextId);
              }
            }}>
              <option value="">Choose a patient</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>{patient.name}</option>
              ))}
            </select>
          </label>

          {selectedPatientId ? (
            <>
              <div className="selector-row">
                <label>
                  <span>Period</span>
                  <select value={reportType} onChange={(event) => {
                    const nextType = event.target.value;
                    setReportType(nextType);
                    loadPatientReport(selectedPatientId, nextType, reportDate);
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
                      loadPatientReport(selectedPatientId, reportType, nextDate);
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
                        <strong>{slotLabels[reading.time_slot] ?? formatStatus(reading.time_slot)}</strong>
                        <small>{reading.reading_date}</small>
                      </div>
                      <span className="reading-value">{reading.glucose_value} mg/dL</span>
                    </div>
                  ))}
                </div>
              ) : report ? (
                <p className="empty-state">No readings for the selected period.</p>
              ) : (
                <p className="empty-state">Select a patient to view their report.</p>
              )}
            </>
          ) : (
            <p className="empty-state">Select a patient to view their report.</p>
          )}
        </section>
      </div>
      ) : null}

      {section === 'history' ? (
      <div className="card assignment-card doctor-assignment-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">History</p>
            <h2>Assignment activity</h2>
          </div>
          <div className="icon-badge tertiary">
            <XCircle size={18} />
          </div>
        </div>

        {history.length ? (
          <ul className="history-list">
            {history.map((assignment) => (
              <li key={assignment.id}>
                <div>
                  <strong>{assignment.patient_name}</strong>
                  <small>{assignment.status === 'active' ? 'Active assignment' : 'Ended assignment'}</small>
                </div>
                <span className={`status-pill ${assignment.status}`}>{formatStatus(assignment.status)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No assignment history yet.</p>
        )}
      </div>
      ) : null}
    </div>
  );
}
