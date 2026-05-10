import { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, or } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../error-handler';
import { generateTemplate, parseTemplateSections } from '../aiService';

interface Template {
  id: string;
  name: string;
  content?: string;
  clinicalHistory?: string;
  grossFindings?: string;
  microscopicFindings?: string;
  ihcAdvice?: string;
  finalDiagnosis?: string;
  authorId?: string;
  isPublic?: boolean;
  organSystem?: string;
  clinicalKeywords?: string;
}

const ORGAN_SYSTEMS = ["Gastrointestinal", "Gynecologic", "Breast", "Dermatopathology", "Genitourinary", "Respiratory", "Head and Neck", "Central Nervous System", "Prostate", "Other"];

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState({ 
    name: '', 
    content: '', 
    clinicalHistory: '',
    grossFindings: '',
    microscopicFindings: '',
    ihcAdvice: '',
    finalDiagnosis: '',
    isPublic: false, 
    organSystem: '', 
    clinicalKeywords: '' 
  });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // AI Gen State
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiHistory, setAiHistory] = useState('');
  const [aiSpecimen, setAiSpecimen] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiParsing, setAiParsing] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

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
      const fetched: Template[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() as Omit<Template, 'id'> });
      });
      setTemplates(fetched);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const hasSection = newTemplate.clinicalHistory || newTemplate.grossFindings || newTemplate.microscopicFindings || newTemplate.finalDiagnosis || newTemplate.ihcAdvice;
    if (!auth.currentUser || !newTemplate.name || (!newTemplate.content && !hasSection)) {
      if (!newTemplate.name) alert("Template name is required.");
      else if (!newTemplate.content && !hasSection) alert("Template content or sections (Clinical/Gross/Micro/Diagnosis) are required.");
      return;
    }
    setLoading(true);
    try {
      if (editingTemplateId) {
        const templateRef = doc(db, 'templates', editingTemplateId);
        await updateDoc(templateRef, {
          name: newTemplate.name,
          content: newTemplate.content,
          clinicalHistory: newTemplate.clinicalHistory,
          grossFindings: newTemplate.grossFindings,
          microscopicFindings: newTemplate.microscopicFindings,
          ihcAdvice: newTemplate.ihcAdvice,
          finalDiagnosis: newTemplate.finalDiagnosis,
          isPublic: newTemplate.isPublic,
          organSystem: newTemplate.organSystem,
          clinicalKeywords: newTemplate.clinicalKeywords,
          updatedAt: serverTimestamp(),
        });
      } else {
        const templateRef = doc(collection(db, 'templates'));
        await setDoc(templateRef, {
          name: newTemplate.name,
          content: newTemplate.content,
          clinicalHistory: newTemplate.clinicalHistory,
          grossFindings: newTemplate.grossFindings,
          microscopicFindings: newTemplate.microscopicFindings,
          ihcAdvice: newTemplate.ihcAdvice,
          finalDiagnosis: newTemplate.finalDiagnosis,
          isPublic: newTemplate.isPublic,
          organSystem: newTemplate.organSystem,
          clinicalKeywords: newTemplate.clinicalKeywords,
          authorId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      handleCloseModal();
      await fetchTemplates();
    } catch (err) {
      console.error("Save error:", err);
      handleFirestoreError(err, editingTemplateId ? OperationType.UPDATE : OperationType.CREATE, 'templates');
      alert("Failed to save template. Please check your permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'templates', id));
      await fetchTemplates();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'templates');
      alert("Failed to delete template.");
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (tmpl: Template) => {
    setNewTemplate({ 
      name: tmpl.name, 
      content: tmpl.content || '', 
      clinicalHistory: tmpl.clinicalHistory || '',
      grossFindings: tmpl.grossFindings || '',
      microscopicFindings: tmpl.microscopicFindings || '',
      ihcAdvice: tmpl.ihcAdvice || '',
      finalDiagnosis: tmpl.finalDiagnosis || '',
      isPublic: tmpl.isPublic || false,
      organSystem: tmpl.organSystem || '',
      clinicalKeywords: tmpl.clinicalKeywords || ''
    });
    setEditingTemplateId(tmpl.id);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNewTemplate({ 
      name: '', 
      content: '', 
      clinicalHistory: '',
      grossFindings: '',
      microscopicFindings: '',
      ihcAdvice: '',
      finalDiagnosis: '',
      isPublic: false, 
      organSystem: '', 
      clinicalKeywords: '' 
    });
    setEditingTemplateId(null);
    setShowAiGen(false);
    setAiHistory('');
    setAiSpecimen('');
  }

  const handleAiGenerate = async () => {
    if (!aiHistory || !aiSpecimen) return;
    setAiGenerating(true);
    try {
      console.log("Starting AI template generation for:", aiSpecimen);
      const generated = await generateTemplate(aiHistory, aiSpecimen);
      console.log("AI Generation successful:", generated);
      
      setNewTemplate(prev => ({ 
        ...prev, 
        name: generated.name || prev.name || `Template for ${aiSpecimen}`,
        clinicalHistory: generated.clinicalHistory || prev.clinicalHistory,
        grossFindings: generated.grossFindings || prev.grossFindings,
        microscopicFindings: generated.microscopicFindings || prev.microscopicFindings,
        ihcAdvice: generated.ihcAdvice || prev.ihcAdvice,
        finalDiagnosis: generated.finalDiagnosis || prev.finalDiagnosis,
        content: ''
      }));
      setShowAiGen(false);
    } catch (error: any) {
      console.error("AI Generation failed:", error);
      alert(`AI generation failed: ${error.message || "Unknown error"}`);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAutoParse = async () => {
    if (!newTemplate.content && !newTemplate.microscopicFindings) return;
    const textToParse = newTemplate.content || newTemplate.microscopicFindings;
    setAiParsing(true);
    try {
      const result = await parseTemplateSections(textToParse);
      setNewTemplate(prev => ({
        ...prev,
        clinicalHistory: result.clinicalHistory || prev.clinicalHistory,
        grossFindings: result.grossFindings || prev.grossFindings,
        microscopicFindings: result.microscopicFindings || prev.microscopicFindings,
        ihcAdvice: result.ihcAdvice || prev.ihcAdvice,
        finalDiagnosis: result.finalDiagnosis || prev.finalDiagnosis,
        content: '' 
      }));
    } catch (error: any) {
      console.error("Parse error:", error);
      alert(`Failed to parse sections: ${error.message || "Unknown error"}`);
    } finally {
      setAiParsing(false);
    }
  };

  if (loading) return <div className="p-8">Loading templates...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Report Templates</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition"
        >
          + New Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map(tmpl => (
          <div key={tmpl.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group">
            <div className="space-y-1.5 mb-2">
              <h3 className="font-bold text-slate-800 text-lg leading-tight">{tmpl.name}</h3>
              <div className="flex flex-wrap gap-1.5">
                {tmpl.organSystem && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase rounded">{tmpl.organSystem}</span>}
                {tmpl.isPublic && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold uppercase rounded">Public</span>}
              </div>
            </div>
            <div className="text-xs text-slate-600 line-clamp-3 italic mb-2">
              {tmpl.finalDiagnosis || tmpl.microscopicFindings || tmpl.grossFindings || tmpl.content || "No preview available"}
            </div>
            <div className="absolute top-4 right-4 hidden group-hover:flex gap-2">
              <button onClick={() => setViewingTemplate(tmpl)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded" title="View">
                 View
              </button>
              {tmpl.authorId === auth.currentUser?.uid && (
                <>
                  <button onClick={() => handleEdit(tmpl)} className="p-1.5 bg-slate-100 hover:bg-blue-100 text-blue-600 rounded" title="Edit">
                     Edit
                  </button>
                  <button onClick={() => handleDelete(tmpl.id)} className="p-1.5 bg-slate-100 hover:bg-red-100 text-red-600 rounded" title="Delete">
                     Del
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full text-center p-12 bg-white rounded-xl border border-slate-200 text-slate-500">
            No templates found. Create one.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{editingTemplateId ? "Edit Template" : "Create Template"}</h2>
              {!editingTemplateId && (
                <button 
                  onClick={() => setShowAiGen(!showAiGen)}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded text-xs font-semibold hover:bg-indigo-100 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {showAiGen ? "Hide AI Generator" : "Generate with AI"}
                </button>
              )}
            </div>

            <div className="space-y-5">
              {showAiGen && !editingTemplateId && (
                <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 space-y-4 mb-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-indigo-400 tracking-widest mb-1.5">Clinical History</label>
                    <input 
                      type="text" 
                      className="w-full border border-indigo-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                      value={aiHistory}
                      onChange={e => setAiHistory(e.target.value)}
                      placeholder="e.g. suspicion of adenocarcinoma"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-indigo-400 tracking-widest mb-1.5">Specimen Type</label>
                    <input 
                      type="text" 
                      className="w-full border border-indigo-200 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                      value={aiSpecimen}
                      onChange={e => setAiSpecimen(e.target.value)}
                      placeholder="e.g. colon biopsy"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAiGenerate}
                      disabled={aiGenerating || !aiHistory || !aiSpecimen}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
                    >
                      {aiGenerating ? (
                         <>
                           <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                           Generating...
                         </>
                      ) : (
                        "Generate Template"
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Template Name</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-sm"
                  value={newTemplate.name}
                  onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                  placeholder="e.g. Normal Appendix"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Organ System</label>
                  <select 
                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-sm"
                    value={newTemplate.organSystem}
                    onChange={e => setNewTemplate({...newTemplate, organSystem: e.target.value})}
                  >
                    <option value="">None / General</option>
                    {ORGAN_SYSTEMS.map(os => <option key={os} value={os}>{os}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Clinical Keywords (for matching)</label>
                  <input 
                    type="text" 
                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-sm"
                    value={newTemplate.clinicalKeywords}
                    onChange={e => setNewTemplate({...newTemplate, clinicalKeywords: e.target.value})}
                    placeholder="e.g. pain, right lower quadrant"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {(newTemplate.content) && (
                  <div className="bg-amber-50 p-3 rounded border border-amber-200 flex justify-between items-center">
                    <p className="text-[10px] text-amber-700 font-medium">Unstructured content found. Segregate into sections for better report entry?</p>
                    <button 
                      onClick={handleAutoParse}
                      disabled={aiParsing}
                      className="px-2 py-1 bg-amber-600 text-white text-[10px] font-bold uppercase rounded hover:bg-amber-700 disabled:opacity-50 transition flex items-center gap-1"
                    >
                      {aiParsing ? "Parsing..." : "✨ AI Segregate"}
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Template Clinical History</label>
                    <textarea 
                      rows={3}
                      className="w-full border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-slate-50"
                      value={newTemplate.clinicalHistory}
                      onChange={e => setNewTemplate({...newTemplate, clinicalHistory: e.target.value})}
                      placeholder="Provisional diagnosis or history..."
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Gross Findings</label>
                    <textarea 
                      rows={3}
                      className="w-full border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-slate-50"
                      value={newTemplate.grossFindings}
                      onChange={e => setNewTemplate({...newTemplate, grossFindings: e.target.value})}
                      placeholder="Gross description..."
                    ></textarea>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Microscopic Findings</label>
                  <textarea 
                    rows={4}
                    className="w-full border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-slate-50 font-mono"
                    value={newTemplate.microscopicFindings}
                    onChange={e => setNewTemplate({...newTemplate, microscopicFindings: e.target.value})}
                    placeholder="Microscopic details..."
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">Final Diagnosis</label>
                    <textarea 
                      rows={3}
                      className="w-full border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-slate-50 font-bold"
                      value={newTemplate.finalDiagnosis}
                      onChange={e => setNewTemplate({...newTemplate, finalDiagnosis: e.target.value})}
                      placeholder="Final opinion..."
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1.5">IHC/Advice</label>
                    <textarea 
                      rows={3}
                      className="w-full border border-slate-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-slate-50"
                      value={newTemplate.ihcAdvice}
                      onChange={e => setNewTemplate({...newTemplate, ihcAdvice: e.target.value})}
                      placeholder="Special stains or advice..."
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isPublic"
                  checked={newTemplate.isPublic}
                  onChange={e => setNewTemplate({...newTemplate, isPublic: e.target.checked})}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isPublic" className="text-sm text-slate-600 font-medium">Make this template public for everyone in the app</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={handleCloseModal} className="px-5 py-2 border border-slate-300 text-sm font-medium rounded hover:bg-slate-50 transition">Cancel</button>
                <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-500/20 rounded hover:bg-blue-700 transition">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingTemplate && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{viewingTemplate.name}</h2>
                {viewingTemplate.isPublic && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded">Public Template</span>
                )}
              </div>
              <button onClick={() => setViewingTemplate(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 overflow-y-auto max-h-[60vh] space-y-4">
              {viewingTemplate.clinicalHistory && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Clinical History</h4>
                  <p className="text-sm text-slate-700">{viewingTemplate.clinicalHistory}</p>
                </div>
              )}
              {viewingTemplate.grossFindings && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gross Findings</h4>
                  <p className="text-sm text-slate-700">{viewingTemplate.grossFindings}</p>
                </div>
              )}
              {viewingTemplate.microscopicFindings && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Microscopic Findings</h4>
                  <p className="text-sm text-slate-700 font-mono italic">{viewingTemplate.microscopicFindings}</p>
                </div>
              )}
              {viewingTemplate.finalDiagnosis && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Final Diagnosis</h4>
                  <p className="text-sm text-slate-900 font-bold">{viewingTemplate.finalDiagnosis}</p>
                </div>
              )}
              {viewingTemplate.ihcAdvice && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">IHC / Special Stains</h4>
                  <p className="text-sm text-slate-700">{viewingTemplate.ihcAdvice}</p>
                </div>
              )}
              {viewingTemplate.content && (
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Legacy Content</h4>
                  <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700">{viewingTemplate.content}</pre>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-slate-100">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(viewingTemplate.content);
                  alert('Content copied to clipboard!');
                }} 
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium shadow-sm rounded hover:bg-blue-700 transition"
              >
                Copy Content
              </button>
              <button 
                onClick={() => setViewingTemplate(null)} 
                className="px-5 py-2 border border-slate-300 text-sm font-medium rounded hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
