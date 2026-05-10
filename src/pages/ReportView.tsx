import { useEffect, useState, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../error-handler';

export default function ReportView() {
  const { id } = useParams();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchReport() {
      if (!id || !auth.currentUser) return;
      try {
        const docRef = doc(db, 'reports', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setReport(docSnap.data());
        } else {
          console.error("No such document!");
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `reports/${id}`);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  if (loading) return <div className="p-8">Loading report...</div>;
  if (!report) return <div className="p-8">Report not found.</div>;

  return (
    <div className="bg-[#f1f5f9] min-h-screen py-8 print:py-0 print:bg-white text-slate-900 font-sans">
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden px-4">
        <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 border border-slate-300 px-3 py-1.5 rounded bg-white transition hover:bg-slate-50">
          &larr; Back to Dashboard
        </Link>
        <div className="flex gap-3">
          {report.status === 'Pending' && (
            <Link 
              to={`/edit-report/${id}`}
              className="px-4 py-1.5 border border-blue-600 text-blue-600 rounded text-sm font-medium hover:bg-blue-50"
            >
              Edit Report
            </Link>
          )}
          <button 
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-700"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* A4 Paper Container */}
      <div ref={reportRef} className="max-w-4xl mx-auto bg-white shadow-sm border border-slate-200 print:shadow-none print:border-none min-h-[1122px] p-12 print:p-0 relative font-serif text-slate-900 leading-relaxed">
        
        {/* Header */}
        <header className="border-b-2 border-slate-900 pb-6 mb-8 text-center print:pt-4">
          <h1 className="text-3xl font-extrabold uppercase tracking-widest mb-1 text-slate-900">General Hospital</h1>
          <h2 className="text-lg font-medium text-slate-600 uppercase tracking-widest">Department of Histopathology</h2>
          <p className="text-sm text-slate-500 mt-2 font-sans tracking-wide">123 Medical Drive, Health City &bull; Ph: (555) 123-4567</p>
        </header>

        {/* Patient Details Grid */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm mb-10 pb-6 border-b border-slate-200 font-sans">
          <div className="grid grid-cols-[120px_1fr] items-baseline">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Patient Name:</span>
            <span className="font-bold text-base text-slate-900">{report.patientName}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-baseline">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Report No:</span>
            <span className="font-bold text-slate-900">{report.reportNumber}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-baseline">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Age/Gender:</span>
            <span className="text-slate-800">{report.age} Yrs / {report.gender}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-baseline">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Hospital No:</span>
            <span className="text-slate-800">{report.hospitalNumber}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-baseline">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Ref. Doctor:</span>
            <span className="text-slate-800">{report.referringDoctor}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-baseline">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Organ System:</span>
            <span className="text-slate-800">{report.organSystem || 'N/A'}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-baseline">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Report Date:</span>
            <span className="text-slate-800">{report.dateOfReport}</span>
          </div>
        </div>

        {/* Report Content */}
        <main className="space-y-8 min-h-[500px]">
          {report.clinicalHistory && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest border-b border-slate-200 pb-1 mb-3 text-slate-500 font-sans">Clinical History</h3>
              <p className="text-sm whitespace-pre-wrap">{report.clinicalHistory}</p>
            </section>
          )}

          {report.grossFindings && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest border-b border-slate-200 pb-1 mb-3 text-slate-500 font-sans">Gross Findings</h3>
              <p className="text-sm whitespace-pre-wrap">{report.grossFindings}</p>
            </section>
          )}

          {report.microscopicFindings && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest border-b border-slate-200 pb-1 mb-3 text-slate-500 font-sans">Microscopic Examination</h3>
              <p className="text-sm whitespace-pre-wrap">{report.microscopicFindings}</p>
            </section>
          )}

          {report.ihcAdvice && report.ihcAdvice.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest border-b border-slate-200 pb-1 mb-3 text-slate-500 font-sans">IHC Markers Advised</h3>
              <p className="text-sm font-sans font-medium text-slate-700">{report.ihcAdvice.join(', ')}</p>
            </section>
          )}

          <section className="bg-slate-50 print:bg-transparent print:border-y print:border-slate-900 p-6 rounded my-10 border border-slate-200">
            <h3 className="text-[10px] text-center font-bold uppercase tracking-widest pb-2 mb-2 text-slate-500 font-sans">Final Diagnosis</h3>
            <p className="text-xl font-bold text-center uppercase whitespace-pre-wrap text-slate-900 font-sans tracking-wide">{report.finalDiagnosis || 'No diagnosis entered'}</p>
          </section>

          {report.comments && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest border-b border-slate-200 pb-1 mb-3 text-slate-500 font-sans">Comments</h3>
              <p className="text-sm whitespace-pre-wrap italic text-slate-600">{report.comments}</p>
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-slate-200 font-sans">
          <div className="flex justify-end">
            <div className="text-center w-64">
              <div className="h-16 border-b border-slate-300 mb-2"></div>
              <p className="font-bold text-[10px] uppercase tracking-widest text-slate-800">Consultant Pathologist</p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Electronically Signed</p>
            </div>
          </div>
          <div className="mt-12 text-center text-[10px] tracking-widest uppercase font-bold text-slate-400 print:text-slate-900">
            <p>*** END OF REPORT ***</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
