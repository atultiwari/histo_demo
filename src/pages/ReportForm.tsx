import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc, serverTimestamp, or } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../error-handler';
import { suggestDiagnosis, improveText } from '../aiService';
import ReactMarkdown from 'react-markdown';

const IHC_MARKERS = ["CK7", "CK20", "TTF1", "p63", "CDX2", "PAS", "GMS", "ZN Stain", "Ki-67", "ER", "PR", "HER2"];

export default function ReportForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [suggestedTemplates, setSuggestedTemplates] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    patientName: '',
    age: '',
    gender: 'Female',
    hospitalNumber: '',
    reportNumber: `PAT-${format(new Date(), 'yyyyMMdd-HHmm')}`,
    referringDoctor: '',
    dateOfProcedure: format(new Date(), 'yyyy-MM-dd'),
    dateOfReport: format(new Date(), 'yyyy-MM-dd'),
    specimenReceivedDate: format(new Date(), 'yyyy-MM-dd'),
    organSystem: '',
    clinicalHistory: '',
    grossFindings: '',
    microscopicFindings: '',
    ihcAdvice: [] as string[],
    finalDiagnosis: '',
    comments: '',
    status: 'Pending'
  });

  useEffect(() => {
    if (id) {
      const fetchReport = async () => {
        try {
          const docRef = doc(db, 'reports', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              ...formData,
              patientName: data.patientName || '',
              age: data.age?.toString() || '',
              gender: data.gender || 'Female',
              hospitalNumber: data.hospitalNumber || '',
              reportNumber: data.reportNumber || formData.reportNumber,
              referringDoctor: data.referringDoctor || '',
              dateOfProcedure: data.dateOfProcedure || format(new Date(), 'yyyy-MM-dd'),
              dateOfReport: data.dateOfReport || format(new Date(), 'yyyy-MM-dd'),
              specimenReceivedDate: data.specimenReceivedDate || format(new Date(), 'yyyy-MM-dd'),
              organSystem: data.organSystem || '',
              clinicalHistory: data.clinicalHistory || '',
              grossFindings: data.grossFindings || '',
              microscopicFindings: data.microscopicFindings || '',
              ihcAdvice: data.ihcAdvice || [],
              finalDiagnosis: data.finalDiagnosis || '',
              comments: data.comments || '',
              status: data.status || 'Pending'
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'reports');
        }
      };
      fetchReport();
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleIhcToggle = (marker: string) => {
    setFormData(prev => {
      const exists = prev.ihcAdvice.includes(marker);
      return {
        ...prev,
        ihcAdvice: exists ? prev.ihcAdvice.filter(m => m !== marker) : [...prev.ihcAdvice, marker]
      };
    });
  };

  const handleSave = async (statusOverride?: string) => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      const finalStatus = statusOverride || formData.status;
      
      if (id) {
        const reportRef = doc(db, 'reports', id);
        await updateDoc(reportRef, {
          ...formData,
          age: parseInt(formData.age) || 0,
          status: finalStatus,
          updatedAt: serverTimestamp()
        });
      } else {
        const reportRef = doc(collection(db, 'reports')); // generate new ID
        await setDoc(reportRef, {
          ...formData,
          age: parseInt(formData.age) || 0,
          status: finalStatus,
          authorId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      navigate('/');
    } catch (err) {
      handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'reports');
    } finally {
      setSaving(false);
    }
  };

  const handleAiDiagnosis = async () => {
    if (!formData.microscopicFindings) {
      alert("Please enter microscopic findings first.");
      return;
    }
    setAiLoading(true);
    try {
      const result = await suggestDiagnosis(formData.microscopicFindings, formData.grossFindings, formData.clinicalHistory);
      setAiSuggestion(result || '');
    } catch (err) {
      alert("Failed to get AI suggestion.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'templates'),
          or(
            where('authorId', '==', auth.currentUser.uid),
            where('isPublic', '==', true)
          )
        );
        const snapshot = await getDocs(q);
        const fetched: any[] = [];
        snapshot.forEach(doc => {
          fetched.push({ id: doc.id, ...doc.data() });
        });
        setTemplates(fetched);
      } catch (err) {
        console.error("Failed to fetch templates", err);
      }
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (!formData.organSystem && !formData.clinicalHistory) {
      setSuggestedTemplates([]);
      return;
    }

    const filtered = templates.filter(t => {
      // Must match organ system if template has one specified
      const osMatch = !t.organSystem || t.organSystem === formData.organSystem;
      return osMatch;
    }).map(t => {
      let score = 0;
      if (t.organSystem === formData.organSystem) score += 10;
      
      if (t.clinicalKeywords && formData.clinicalHistory) {
        const keywords = t.clinicalKeywords.toLowerCase().split(',').map((s: string) => s.trim());
        const history = formData.clinicalHistory.toLowerCase();
        keywords.forEach((kw: string) => {
          if (kw && history.includes(kw)) score += 5;
        });
      }
      return { ...t, score };
    }).filter(t => t.score > 0)
      .sort((a, b) => b.score - a.score);

    setSuggestedTemplates(filtered);
  }, [formData.organSystem, formData.clinicalHistory, templates]);

  const applyTemplate = (t: any) => {
    setFormData(prev => ({
      ...prev,
      clinicalHistory: t.clinicalHistory || prev.clinicalHistory,
      grossFindings: t.grossFindings || prev.grossFindings,
      microscopicFindings: t.microscopicFindings || t.content || prev.microscopicFindings,
      finalDiagnosis: t.finalDiagnosis || prev.finalDiagnosis,
      comments: t.comments || prev.comments
    }));
    
    // Auto-select markers if provided in a specific format (comma separated string)
    if (t.ihcAdvice && typeof t.ihcAdvice === 'string') {
      const markers = t.ihcAdvice.split(',').map((s: string) => s.trim().toUpperCase());
      const validMarkers = IHC_MARKERS.filter(m => markers.includes(m.toUpperCase()));
      if (validMarkers.length > 0) {
        setFormData(prev => ({
          ...prev, 
          ihcAdvice: Array.from(new Set([...prev.ihcAdvice, ...validMarkers]))
        }));
      }
    }
    
    // Jump to the first section that was updated
    if (t.clinicalHistory || t.grossFindings) setActiveTab('clinical');
    else if (t.microscopicFindings || t.content || t.ihcAdvice) setActiveTab('microscopic');
    else if (t.finalDiagnosis) setActiveTab('diagnosis');
  };
  const handleImproveText = async (field: 'grossFindings' | 'microscopicFindings') => {
    if (!formData[field]) return;
    setAiLoading(true);
    try {
      const result = await improveText(formData[field]);
      if (result) {
        setFormData(prev => ({ ...prev, [field]: result }));
      }
    } catch (err) {
      alert("Failed to improve text.");
    } finally {
      setAiLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'clinical', label: 'Clinical & Gross' },
    { id: 'microscopic', label: 'Microscopic & IHC' },
    { id: 'diagnosis', label: 'Final Diagnosis' }
  ];

  const TemplateSuggestions = () => (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
      <h4 className="text-[10px] font-bold uppercase text-blue-600 mb-2">Suggested Templates</h4>
      <div className="grid grid-cols-1 gap-2">
        {suggestedTemplates.slice(0, 4).map(t => (
          <button 
            key={t.id}
            onClick={() => applyTemplate(t)}
            className="w-full text-left p-2.5 bg-white hover:bg-blue-100 rounded-lg border border-blue-200 transition group shadow-sm hover:shadow"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">{t.name}</span>
              <span className="text-[10px] text-blue-400 group-hover:text-blue-600 font-bold">Apply →</span>
            </div>
            {(t.organSystem || t.clinicalKeywords || t.clinicalHistory || t.grossFindings || t.microscopicFindings || t.finalDiagnosis) && (
              <div className="space-y-1.5 mt-2">
                <div className="flex flex-wrap gap-1">
                  {t.clinicalHistory && <span className="text-[7px] px-1 bg-indigo-50 text-indigo-500 rounded uppercase font-bold border border-indigo-100">Clinical</span>}
                  {t.grossFindings && <span className="text-[7px] px-1 bg-green-50 text-green-500 rounded uppercase font-bold border border-green-100">Gross</span>}
                  {t.microscopicFindings && <span className="text-[7px] px-1 bg-amber-50 text-amber-500 rounded uppercase font-bold border border-amber-100">Micro</span>}
                  {t.finalDiagnosis && <span className="text-[7px] px-1 bg-rose-50 text-rose-500 rounded uppercase font-bold border border-rose-100">Diagnosis</span>}
                </div>
                <div className="flex gap-2">
                  {t.organSystem && <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase font-bold">{t.organSystem}</span>}
                  {t.clinicalKeywords && <span className="text-[8px] text-blue-400 italic truncate">Match: {t.clinicalKeywords}</span>}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative h-full flex flex-col bg-[#f1f5f9] font-sans text-slate-900">
      {/* Sticky Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">New Pathology Report</h1>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 mr-4 uppercase tracking-widest">{formData.reportNumber}</span>
          <button 
            onClick={() => handleSave('Pending')} 
            disabled={saving}
            className="px-4 py-1.5 border border-slate-300 text-sm font-medium hover:bg-slate-50 rounded"
          >
            Save Draft
          </button>
          <button 
            onClick={() => handleSave('Finalized')} 
            disabled={saving}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-700"
          >
            Finalize Report
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8 max-w-5xl mx-auto w-full">
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl mb-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition ${
                activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Areas */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          
          {activeTab === 'basic' && (
            <div className="p-8 space-y-6">
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight mb-4">Patient Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Patient Name</label>
                  <input type="text" name="patientName" value={formData.patientName} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Age</label>
                    <input type="number" name="age" value={formData.age} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Gender</label>
                    <select name="gender" value={formData.gender} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50">
                      <option>Female</option>
                      <option>Male</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Hospital Number (UHID)</label>
                  <input type="text" name="hospitalNumber" value={formData.hospitalNumber} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Referring Doctor</label>
                  <input type="text" name="referringDoctor" value={formData.referringDoctor} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Organ System</label>
                  <select name="organSystem" value={formData.organSystem} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50">
                    <option value="">Select Organ System...</option>
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
                  
                  {suggestedTemplates.length > 0 && <TemplateSuggestions />}
                </div>
              </div>

              <hr className="border-slate-100 my-6" />
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight mb-4">Dates</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Procedure Date</label>
                  <input type="date" name="dateOfProcedure" value={formData.dateOfProcedure} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Specimen Received</label>
                  <input type="date" name="specimenReceivedDate" value={formData.specimenReceivedDate} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Report Date</label>
                  <input type="date" name="dateOfReport" value={formData.dateOfReport} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clinical' && (
            <div className="p-8 space-y-8">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">Clinical History / Provisional Diagnosis</label>
                <textarea rows={4} name="clinicalHistory" value={formData.clinicalHistory} onChange={handleChange} placeholder="Enter relevant history, radiology findings..." className="w-full px-4 py-3 border border-slate-300 bg-slate-50 border-dashed rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"></textarea>
                {suggestedTemplates.length > 0 && <TemplateSuggestions />}
              </div>
              <hr className="border-slate-100" />
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest">Gross Findings</label>
                  <button onClick={() => handleImproveText('grossFindings')} className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded flex items-center gap-1 border border-blue-100 hover:border-blue-200">
                    ✨ AI Improve
                  </button>
                </div>
                <textarea rows={6} name="grossFindings" value={formData.grossFindings} onChange={handleChange} placeholder="Specimen description, measurements, consistency..." className="w-full px-4 py-3 border border-slate-300 bg-slate-50 border-dashed rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"></textarea>
              </div>
            </div>
          )}

          {activeTab === 'microscopic' && (
            <div className="p-8 space-y-8">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest">Microscopic Findings</label>
                  <button onClick={() => handleImproveText('microscopicFindings')} className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded flex items-center gap-1 border border-blue-100 hover:border-blue-200">
                    ✨ AI Improve
                  </button>
                </div>
                <textarea rows={8} name="microscopicFindings" value={formData.microscopicFindings} onChange={handleChange} placeholder="Detailed microscopy..." className="w-full px-4 py-3 border border-slate-300 bg-slate-50 border-dashed rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-serif leading-relaxed italic text-slate-700"></textarea>
              </div>
              
              <hr className="border-slate-100" />
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3">Special Stains / IHC Advice</label>
                <div className="flex flex-wrap gap-2">
                  {IHC_MARKERS.map(marker => (
                    <button
                      key={marker}
                      onClick={() => handleIhcToggle(marker)}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all border ${
                        formData.ihcAdvice.includes(marker) 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' 
                          : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      {marker}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'diagnosis' && (
            <div className="p-8 space-y-8">
              <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-lg shadow-blue-500/5">
                <div className="flex justify-between items-center mb-4 border-b border-blue-50/50 pb-3">
                  <div className="flex items-center gap-2">
                     <div className="w-4 h-4 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-full animate-pulse"></div>
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Gemini Medical AI</h3>
                  </div>
                  <button onClick={handleAiDiagnosis} disabled={aiLoading} className="px-3 py-1 border border-blue-200 text-blue-600 bg-white hover:bg-blue-50 rounded text-xs font-bold transition uppercase tracking-wider">
                    {aiLoading ? 'Analyzing...' : 'Generate Suggestion ✨'}
                  </button>
                </div>
                {aiSuggestion && (
                  <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 border border-slate-100 whitespace-pre-wrap leading-relaxed">
                     <div className="markdown-body">
                       <ReactMarkdown>{aiSuggestion}</ReactMarkdown>
                     </div>
                  </div>
                )}
                {!aiSuggestion && !aiLoading && (
                  <p className="text-xs text-blue-400 italic">Click generate to analyze findings and get standard diagnostic terminology.</p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-5">
                <label className="block text-[10px] font-black uppercase text-blue-400 tracking-widest mb-2">FINAL DIAGNOSIS</label>
                <textarea rows={3} name="finalDiagnosis" value={formData.finalDiagnosis} onChange={handleChange} placeholder="e.g. Infiltrating Ductal Carcinoma, Grade 2..." className="w-full px-0 py-1 bg-transparent border-none focus:ring-0 text-blue-900 font-bold text-lg leading-tight uppercase placeholder-blue-300 resize-none outline-none"></textarea>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Comments / Notes</label>
                <textarea rows={3} name="comments" value={formData.comments} onChange={handleChange} placeholder="Clinical correlation advice..." className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-slate-50"></textarea>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
