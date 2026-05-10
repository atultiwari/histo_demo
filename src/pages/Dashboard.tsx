import { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../error-handler';

interface ReportStat {
  id: string;
  patientName: string;
  reportNumber: string;
  status: string;
  dateOfReport: string;
}

export default function Dashboard() {
  const [reports, setReports] = useState<ReportStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalActive: 0, pending: 0, finalized: 0 });

  useEffect(() => {
    async function fetchDashboardData() {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'reports'),
          where('authorId', '==', auth.currentUser.uid),
          orderBy('updatedAt', 'desc'),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        
        let pending = 0;
        let finalized = 0;
        const fetchedReports: ReportStat[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedReports.push({
            id: doc.id,
            patientName: data.patientName || 'Unknown',
            reportNumber: data.reportNumber || 'N/A',
            status: data.status,
            dateOfReport: data.dateOfReport || 'N/A'
          });
          if (data.status === 'Pending') pending++;
          if (data.status === 'Finalized') finalized++;
        });

        setReports(fetchedReports);
        setStats({ totalActive: fetchedReports.length, pending, finalized });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'reports');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading dashboard...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="mt-1 text-slate-500">Welcome back, Dr. {auth.currentUser?.email}</p>
        </div>
        <div className="flex gap-4">
          <Link to="/new-report" className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition">
            + New Report
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Cases (Recent)</p>
          <p className="text-3xl font-black text-slate-800">{stats.totalActive}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Pending Sign-out</p>
          <p className="text-3xl font-black text-slate-800">{stats.pending}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Finalized</p>
          <p className="text-3xl font-black text-slate-800">{stats.finalized}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Recent Cases</h2>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search cases..." 
              className="px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        {reports.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No recent cases found. Create a new report to get started.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                <th className="p-4">Report Number</th>
                <th className="p-4">Patient Name</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50 transition cursor-pointer">
                  <td className="p-4 font-mono text-sm text-slate-900 font-semibold">{report.reportNumber}</td>
                  <td className="p-4 font-medium text-slate-900">{report.patientName}</td>
                  <td className="p-4 text-sm text-slate-500">{report.dateOfReport}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      report.status === 'Finalized' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {report.status === 'Pending' ? (
                      <Link to={`/edit-report/${report.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700 transition">
                        Edit / Finalize
                      </Link>
                    ) : (
                      <Link to={`/view-report/${report.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700 transition">
                        View
                      </Link>
                    )}
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
