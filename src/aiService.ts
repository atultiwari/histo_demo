import { GoogleGenAI, Type } from '@google/genai';

const parseAIJSON = (text: string | undefined) => {
  if (!text) throw new Error("Empty response from AI");
  try {
    // Remove markdown code blocks if present
    const cleanJson = text.replace(/```json\n?|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("JSON Parse Error. Original text:", text);
    throw new Error("Failed to parse AI response as JSON");
  }
};

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
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert AI pathology assistant. Provide concise, accurate differential or final diagnosis suggestions based on microscopic and gross findings."
      }
    });
    return response.text || "";
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

Provide the response in structured JSON format with the following keys:
"name": A suitable name for this template.
"clinicalHistory": A template for the clinical history/provisional diagnosis.
"grossFindings": A template for the gross findings.
"microscopicFindings": A template for the microscopic findings.
"finalDiagnosis": A template for the final diagnosis (in uppercase).
"ihcAdvice": Suggested IHC markers (as a comma-separated string).
"comments": Any general comments or advice.

Include relevant placeholders like [Size], [cm], etc. Use professional medical terminology.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            clinicalHistory: { type: Type.STRING },
            grossFindings: { type: Type.STRING },
            microscopicFindings: { type: Type.STRING },
            finalDiagnosis: { type: Type.STRING },
            ihcAdvice: { type: Type.STRING },
            comments: { type: Type.STRING }
          },
          required: ["name", "clinicalHistory", "grossFindings", "microscopicFindings", "finalDiagnosis"]
        },
        systemInstruction: "You are an expert AI pathology assistant. Provide structured pathology report templates in JSON format."
      }
    });
    return parseAIJSON(response.text);
  } catch (err) {
    console.error("AI Error in generateTemplate:", err);
    throw err;
  }
};
export const improveText = async (text: string) => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Improve the medical terminology and grammar of the following pathology text, keeping it concise and professional:\n\n${text}`
    });
    return response.text || "";
  } catch (err) {
    console.error("AI Error:", err);
    throw err;
  }
};

export const parseTemplateSections = async (text: string) => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Parse the following pathology report text and extract it into a structured JSON format with these exact keys: "clinicalHistory", "grossFindings", "microscopicFindings", "ihcAdvice", "finalDiagnosis". 
      
If a section is not found or is empty, provide an empty string for that key. Ensure the microscopicFindings captures the bulk of the descriptive text.

Text to parse:
${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clinicalHistory: { type: Type.STRING },
            grossFindings: { type: Type.STRING },
            microscopicFindings: { type: Type.STRING },
            ihcAdvice: { type: Type.STRING },
            finalDiagnosis: { type: Type.STRING }
          },
          required: ["clinicalHistory", "grossFindings", "microscopicFindings", "ihcAdvice", "finalDiagnosis"]
        }
      }
    });
    return parseAIJSON(response.text);
  } catch (err) {
    console.error("AI Error in parseTemplateSections:", err);
    throw err;
  }
};
