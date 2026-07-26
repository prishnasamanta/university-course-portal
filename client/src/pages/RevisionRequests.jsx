import { useEffect, useState } from 'react';
import { api } from '../api';

export default function RevisionRequests() {
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState(null);

  const load = () => api.getRevisionRequests().then(setRequests);
  useEffect(() => { load(); }, []);

  const review = async (id, status) => {
    await api.reviewRevision(id, status);
    setMessage({ type: 'success', text: `Request ${status}` });
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Marks Revision Requests</h1>
        <p>Review and approve/reject instructor revision requests with audit trail</p>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card">
        {requests.length === 0 ? (
          <p className="muted">No pending revision requests.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Component</th>
                <th>Old → New</th>
                <th>Requested By</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td>{r.student_name} ({r.roll_number})</td>
                  <td>{r.component_name}</td>
                  <td>{r.old_value} → {r.new_value}</td>
                  <td>{r.requested_by_name}</td>
                  <td>{r.reason}</td>
                  <td className="actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => review(r.id, 'approved')}>Approve</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => review(r.id, 'rejected')}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
