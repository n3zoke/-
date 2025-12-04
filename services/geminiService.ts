import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { GeneratedStory, StoryParams, AgeGroup, StoryLength, Genre } from "../types";

const storySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The title of the story in Arabic." },
    summary: { type: Type.STRING, description: "A short 1-sentence summary." },
    content: { type: Type.STRING, description: "The full story content, formatted with paragraphs." },
    moral: { type: Type.STRING, description: "The moral or lesson of the story (optional for adult stories)." },
    imagePrompt: { type: Type.STRING, description: "A detailed English description of a visual scene representing the story cover art, suitable for an image generator." },
  },
  required: ["title", "summary", "content", "imagePrompt"],
};

export const generateStory = async (params: StoryParams): Promise<GeneratedStory> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("مفتاح API مفقود. يرجى التأكد من إعداد البيئة بشكل صحيح.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const modelId = "gemini-2.5-flash"; 
  
  // Determine length instruction
  let lengthInstruction = "Make it a detailed story (approx 1000 words).";
  if (params.length === StoryLength.TIER_2) lengthInstruction = "Make it a very detailed story with multiple scenes (aim for 5000 words).";
  if (params.length === StoryLength.TIER_3) lengthInstruction = "Write an extensive story, divided into clear chapters (aim for 10000 words).";
  if (params.length === StoryLength.TIER_4) lengthInstruction = "Write a very long narrative, rich in description and dialogue (aim for 15000 words).";
  if (params.length === StoryLength.TIER_5) lengthInstruction = "Write a novel-length epic, highly detailed, complex plot (aim for 20000 words).";

  // Determine tone based on Age Group
  let toneInstruction = "The story should be suitable for children, safe, and educational.";
  
  if (params.ageGroup === AgeGroup.ADULT) {
    toneInstruction = "Target Audience: Adults (18+). Narrative Style: Mature, complex, and psychologically rich. Focus on deep character psychology, moral ambiguity, and realistic consequences. Explore sophisticated themes suitable for an adult audience.";
    
    // Specific handling for the Adult Romance genre
    if (params.genre === Genre.ADULT_ROMANCE) {
        toneInstruction += " FOCUS: This is an intimate romance story. Focus heavily on emotional connection, physical tension, sensuality, and the complexities of adult relationships. The narrative should be passionate and bold, exploring desire and intimacy deeply, while maintaining a literary quality and adhering to safety guidelines regarding non-consensual content or gratuitous violence.";
    } else {
        toneInstruction += " While the story must remain safe (avoiding gratuitous violence), do not shy away from serious, dark, or challenging topics. The language should be literary and evocative.";
    }
  } else if (params.ageGroup === AgeGroup.TEEN) {
    toneInstruction = "The story is for teenagers. It can have relatable conflicts, romance, and action. Focus on identity and growth.";
  }

  const promptText = `
    Write a creative and engaging story in Arabic based on the following details:
    - Topic/Prompt: ${params.prompt}
    - Genre: ${params.genre}
    - Target Age Group: ${params.ageGroup}
    - Length Instruction: ${lengthInstruction}
    ${params.characterName ? `- Main Character Name: ${params.characterName}` : ''}
    
    Instructions:
    1. ${toneInstruction}
    2. The story should be culturally appropriate, engaging, and well-structured.
    3. Provide the output strictly in JSON format matching the schema.
    4. IMPORTANT: The 'imagePrompt' field MUST be in English to ensure better compatibility with image generation models. The rest of the fields MUST be in Arabic.
    5. For longer stories, MUST ensure the content is very long as requested. Use clear double line breaks between paragraphs.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: storySchema,
        systemInstruction: "You are a professional Arab storyteller (Hakawati) and novelist. You write captivating stories with rich vocabulary appropriate for the target age and selected genre.",
        temperature: params.ageGroup === AgeGroup.ADULT ? 1.0 : 0.8,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No content generated.");
    }
    
    const storyData = JSON.parse(text) as GeneratedStory;
    return storyData;

  } catch (error: any) {
    console.error("Story generation failed:", error);
    throw new Error("عذراً، حدث خطأ أثناء تأليف القصة. تأكد من صحة المفتاح.");
  }
};

export const generateStoryImage = async (imagePrompt: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const modelId = "gemini-2.5-flash-image"; 

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { text: imagePrompt }
        ]
      },
      config: {
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data returned.");

  } catch (error: any) {
    console.error("Image generation failed:", error);
    throw new Error("عذراً، لم نتمكن من رسم المشهد حالياً.");
  }
};

export const generateSpeech = async (text: string, voiceName: string = 'Puck'): Promise<string> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const modelId = "gemini-2.5-flash-preview-tts";
    
    try {
        if (!text || text.trim().length === 0) {
            throw new Error("Empty text provided");
        }

        const response = await ai.models.generateContent({
            model: modelId,
            contents: {
                parts: [{ text: text }]
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName }
                    }
                }
            }
        });

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) {
            throw new Error("No audio data returned");
        }
        return audioData;

    } catch (error: any) {
        console.error("Speech generation failed:", error.message || error);
        throw new Error("عذراً، تعذر توليد الصوت.");
    }
};