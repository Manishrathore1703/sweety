import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, LogOut, Search, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const today = new Date().toISOString().slice(0, 10);
const reportTypes = [
  { value: 'daily', label: 'Daily' },
  { value: 'month-to-date', label: 'Month to date' },
  { value: 'previous-month', label: 'Previous month' },
];

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [patients, setPatients] = useState([]);
  const [history, setHistory] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [patientLookup, setPatientLookup] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
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

    try {
      const response = await api.get('/patients/search', {
        params: { email: searchEmail },
      });
      setPatientLookup(response.data.patient);
      if (!response.data.patient) {
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

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Doctor portal</p>
          <h1>Welcome, {user?.name || 'Doctor'}</h1>
        </div>

        <button type="button" className="ghost-button" onClick={() => { logout(); navigate('/auth', { replace: true }); }}>
          <LogOut size={16} />
          Log out
        </button>
      </header>

      <div className="dashboard-grid dashboard-grid-two">
        <section className="card form-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Invite</p>
              <h2>Connect with a patient</h2>
            </div>
            <div className="icon-badge primary">
              <UserRound size={18} />
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

          {statusMessage ? <p className="success-banner">{statusMessage}</p> : null}
          {error ? <p className="error-banner">{error}</p> : null}
        </section>

        <section className="card">
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

      <div className="dashboard-grid dashboard-grid-two bottom-grid">
        <section className="card">
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
                    <span>{request.recipient_name || request.patient_email || request.doctor_email}</span>
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
            <h3>Received</h3>
            {receivedRequests.length ? (
              <ul>
                {receivedRequests.map((request) => (
                  <li key={request.id}>
                    <span>{request.initiator_name || request.patient_email || request.doctor_email}</span>
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

        <section className="card">
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
                        <strong>{reading.time_slot}</strong>
                        <small>{reading.reading_date}</small>
                      </div>
                      <span>{reading.glucose_value} mg/dL</span>
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

      <div className="card assignment-card">
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
                <span>{assignment.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No assignment history yet.</p>
        )}
      </div>
    </div>
  );
}
