import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Link } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../error-handler';

interface Report {
  id: string;
  reportNumber: string;
  patientName: string;
  hospitalNumber: string;
  dateOfReport: string;
  status: string;
  finalDiagnosis: string;
  microscopicFindings: string;
  grossFindings: string;
  clinicalHistory: string;
}

export default function CaseSearch() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchMode, setSearchMode] = useState<'basic' | 'advanced'>('basic');
  
  // Basic Search State
  const [basicQuery, setBasicQuery] = useState('');

  // Advanced Search State
  const [advPatientName, setAdvPatientName] = useState('');
  const [advDiagnosis, setAdvDiagnosis] = useState('');
  const [advReportNumber, setAdvReportNumber] = useState('');
  const [advHospitalNumber, setAdvHospitalNumber] = useState('');
  const [advMicroscopy, setAdvMicroscopy] = useState('');
  const [advOrganSystem, setAdvOrganSystem] = useState('');

  useEffect(() => {
    async function fetchAllReports() {
      if (!auth.currentUser) return;
      try {
        const reportsRef = collection(db, 'reports');
        const q = query(
          reportsRef, 
          where('authorId', '==', auth.currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
        setReports(data);
        setFilteredReports(data);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'reports');
      } finally {
        setLoading(false);
      }
    }
    fetchAllReports();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [basicQuery, advPatientName, advDiagnosis, advReportNumber, advHospitalNumber, advMicroscopy, advOrganSystem, searchMode, reports]);

  const handleSearch = () => {
    let results = reports;

    if (searchMode === 'basic') {
      const q = basicQuery.toLowerCase();
      if (q) {
        results = results.filter(report => 
          (report.patientName && report.patientName.toLowerCase().includes(q)) ||
          (report.reportNumber && report.reportNumber.toLowerCase().includes(q)) ||
          (report.hospitalNumber && report.hospitalNumber.toLowerCase().includes(q)) ||
          (report.finalDiagnosis && report.finalDiagnosis.toLowerCase().includes(q)) ||
          (report.microscopicFindings && report.microscopicFindings.toLowerCase().includes(q)) ||
          (report.grossFindings && report.grossFindings.toLowerCase().includes(q)) ||
          ((report as any).organSystem && (report as any).organSystem.toLowerCase().includes(q)) ||
          (report.clinicalHistory && report.clinicalHistory.toLowerCase().includes(q))
        );
      }
    } else {
      if (advPatientName) {
        results = results.filter(r => r.patientName?.toLowerCase().includes(advPatientName.toLowerCase()));
      }
      if (advReportNumber) {
        results = results.filter(r => r.reportNumber?.toLowerCase().includes(advReportNumber.toLowerCase()));
      }
      if (advHospitalNumber) {
        results = results.filter(r => r.hospitalNumber?.toLowerCase().includes(advHospitalNumber.toLowerCase()));
      }
      if (advDiagnosis) {
        results = results.filter(r => r.finalDiagnosis?.toLowerCase().includes(advDiagnosis.toLowerCase()));
      }
      if (advMicroscopy) {
        results = results.filter(r => r.microscopicFindings?.toLowerCase().includes(advMicroscopy.toLowerCase()));
      }
      if (advOrganSystem) {
        results = results.filter(r => (r as any).organSystem?.toLowerCase() === advOrganSystem.toLowerCase() || (advOrganSystem === '' && true));
      }
    }

    setFilteredReports(results);
  };

  const clearAdvanced = () => {
    setAdvPatientName('');
    setAdvDiagnosis('');
    setAdvReportNumber('');
    setAdvHospitalNumber('');
    setAdvMicroscopy('');
    setAdvOrganSystem('');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Case Search</h1>
          <p className="mt-1 text-slate-500">Search through all your pathology reports</p>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-lg">
          <button 
            onClick={() => setSearchMode('basic')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${searchMode === 'basic' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Basic
          </button>
          <button 
            onClick={() => setSearchMode('advanced')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${searchMode === 'advanced' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Advanced
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        {searchMode === 'basic' ? (
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <div className="relative max-w-2xl">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input 
                type="text" 
                placeholder="Search by patient name, diagnosis, report no, microscopy..." 
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
                value={basicQuery}
                onChange={(e) => setBasicQuery(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Patient Name</label>
                <input 
                  type="text" 
                  value={advPatientName}
                  onChange={(e) => setAdvPatientName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Report Number</label>
                <input 
                  type="text" 
                  value={advReportNumber}
                  onChange={(e) => setAdvReportNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Hospital Number (UHID)</label>
                <input 
                  type="text" 
                  value={advHospitalNumber}
                  onChange={(e) => setAdvHospitalNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Diagnosis</label>
                <input 
                  type="text" 
                  value={advDiagnosis}
                  onChange={(e) => setAdvDiagnosis(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Organ System</label>
                <select 
                  value={advOrganSystem}
                  onChange={(e) => setAdvOrganSystem(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm"
                >
                  <option value="">Any</option>
                  <option value="Gastrointestinal">Gastrointestinal</option>
                  <option value="Gynecologic">Gynecologic</option>
                  <option value="Breast">Breast</option>
                  <option value="Dermatopathology">Dermatopathology</option>
                  <option value="Genitourinary">Genitourinary</option>
                  <option value="Respiratory">Respiratory</option>
                  <option value="Head and Neck">Head and Neck</option>
                  <option value="Central Nervous System">Central Nervous System</option>
                  <option value="Prostate">Prostate</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="lg:col-span-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Microscopy Findings</label>
                <input 
                  type="text" 
                  value={advMicroscopy}
                  onChange={(e) => setAdvMicroscopy(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm shadow-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button 
                onClick={clearAdvanced}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition px-3 py-1.5"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading cases...</div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No cases found matching your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-200">
                  <th className="p-4">Report Number</th>
                  <th className="p-4">Patient Name</th>
                  <th className="p-4">Diagnosis</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-mono text-sm text-slate-900 font-semibold">{report.reportNumber}</td>
                    <td className="p-4">
                      <div className="font-medium text-slate-900">{report.patientName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">UHID: {report.hospitalNumber || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-slate-800 line-clamp-1">{report.finalDiagnosis || 'None'}</div>
                    </td>
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
          </div>
        )}
      </div>
    </div>
  );
}
