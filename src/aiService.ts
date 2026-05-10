import { GoogleGenAI, Type } from '@google/genai';

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey });
};

export const suggestDiagnosis = async (microscopicFindings: string, grossFindings: string, clinicalHistory: string) => {
  const ai = getAiClient();
  const prompt = `Based on the following pathology findings, suggest a differential diagnosis or a precise final diagnosis. Do not output absolute certainty, but rather standard pathology diagnostic terminology.
  
Clinical History: ${clinicalHistory}
Gross Findings: ${grossFindings}
Microscopic Findings: ${microscopicFindings}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert AI pathology assistant. Provide concise, accurate differential or final diagnosis suggestions based on microscopic and gross findings."
      }
    });
    return response.text;
  } catch (err) {
    console.error("AI Error:", err);
    throw err;
  }
};

export const generateTemplate = async (clinicalHistory: string, specimenType: string) => {
  const ai = getAiClient();
  const prompt = `Generate a structured histopathology report template.
Clinical History: ${clinicalHistory}
Specimen Type: ${specimenType}

Create a template with sections for Gross Findings, Microscopic Findings, Special Stains/IHC, Final Diagnosis, and Comments. Include relevant placeholders (like [Size], [Number], etc.) and standard pathology terminology appropriate for this specimen and history. Do not use Markdown formatting for the section headers if possible, just clear uppercase headers.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert AI pathology assistant. Provide a structured histopathology report template based on the given history and specimen."
      }
    });
    return response.text;
  } catch (err) {
    console.error("AI Error:", err);
    throw err;
  }
};
export const improveText = async (text: string) => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Improve the medical terminology and grammar of the following pathology text, keeping it concise and professional:\n\n${text}`
    });
    return response.text;
  } catch (err) {
    console.error("AI Error:", err);
    throw err;
  }
};
