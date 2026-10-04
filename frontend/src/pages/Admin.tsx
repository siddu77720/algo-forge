import { API_URL } from '../config';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Admin() {
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const res = await fetch(`${API_URL}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setUsers(await res.json());
    }
  };

  const toggleStatus = async (id: string, active: boolean) => {
    await fetch(`${API_URL}/api/admin/users/${id}/status`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ active: !active })
    });
    fetchUsers();
  };

  return (
    <div className="bg-brand-card p-6 rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold mb-6 border-b border-slate-700 pb-2">Admin Panel - User Management</h2>
      
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm whitespace-nowrap">
          <thead className="uppercase tracking-wider border-b-2 border-slate-700 bg-slate-800">
            <tr>
              <th className="px-6 py-4">Username</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-700 hover:bg-slate-800 transition-colors">
                <td className="px-6 py-4">{u.username}</td>
                <td className="px-6 py-4">{u.role}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${u.active ? 'bg-brand-success text-brand-dark' : 'bg-brand-danger text-white'}`}>
                    {u.active ? 'ACTIVE' : 'EXPIRED/DISABLED'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => toggleStatus(u.id, u.active)}
                    className="bg-brand-accent hover:bg-blue-600 px-3 py-1 rounded text-white"
                  >
                    Toggle Status
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
