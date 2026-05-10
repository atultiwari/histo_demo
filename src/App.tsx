/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDocFromServer } from 'firebase/firestore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ReportForm from './pages/ReportForm';
import ReportView from './pages/ReportView';
import Templates from './pages/Templates';
import CaseSearch from './pages/CaseSearch';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {user ? (
        <div className="flex h-screen bg-[#f1f5f9] font-sans text-slate-900 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col">
            <div className="p-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">H</div>
              <h1 className="text-lg font-semibold tracking-tight text-white">HistoPath<span className="text-blue-400 font-normal underline decoration-2 underline-offset-4">Pro</span></h1>
            </div>
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-2">
              <Link to="/" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-md transition-colors text-sm font-medium">
                Dashboard
              </Link>
              <Link to="/new-report" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-md transition-colors text-sm font-medium">
                New Report
              </Link>
              <Link to="/templates" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-md transition-colors text-sm font-medium">
                Templates
              </Link>
              <Link to="/search" className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-md transition-colors text-sm font-medium">
                Search Cases
              </Link>
            </nav>
            <div className="p-4 border-t border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <div className="text-xs overflow-hidden">
                  <p className="font-medium text-white truncate">{user.email}</p>
                  <p className="text-slate-500">Pathologist</p>
                </div>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="w-full text-center px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-400 border border-slate-700 rounded-md hover:bg-slate-800 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="flex-1 flex flex-col min-w-0 overflow-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new-report" element={<ReportForm />} />
              <Route path="/edit-report/:id" element={<ReportForm />} />
              <Route path="/view-report/:id" element={<ReportView />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/search" element={<CaseSearch />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
