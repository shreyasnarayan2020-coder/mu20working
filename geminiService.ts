
import { GoogleGenAI, Type } from "@google/genai";
import { HealthData, Recommendation } from '../types';

const getAi = () => {
    if (!process.env.API_KEY) {
        // This is a mock for environments where the key is not set.
        console.warn("API_KEY environment variable not set. Using mocked Gemini service.");
        return null;
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

const mockRecommendations: Omit<Recommendation, 'id' | 'userId' | 'isCompleted'>[] = [
    { goal: "Drink 8 glasses of water daily.", category: "Diet", difficulty: "Easy" },
    { goal: "Go for a 30-minute brisk walk.", category: "Exercise", difficulty: "Medium" },
    { goal: "Practice 10 minutes of mindfulness or meditation.", category: "Mental Health", difficulty: "Easy" },
    { goal: "Incorporate a serving of leafy greens into one meal.", category: "Diet", difficulty: "Easy" },
    { goal: "Do a 20-minute bodyweight strength training routine.", category: "Exercise", difficulty: "Hard" }
];

export const generateHealthGoals = async (healthData: HealthData): Promise<Omit<Recommendation, 'id' | 'userId' | 'isCompleted'>[]> => {
    const ai = getAi();
    if (!ai) {
        // Return mock data if API key is not available
        return new Promise(resolve => setTimeout(() => resolve(mockRecommendations), 1500));
    }

    const prompt = `Based on the following user health profile, generate 5 actionable health goals. For each goal, provide a short description, a category ('Diet', 'Exercise', 'Mental Health', or 'General'), and a difficulty level ('Easy', 'Medium', 'Hard').
    User Profile:
    - Age: ${healthData.age}
    - Gender: ${healthData.gender}
    - Fitness Level: ${healthData.fitnessLevel}
    - Existing Conditions: ${healthData.existingConditions || 'None'}
    - Goals: Improve general wellness, manage weight.

    Return the response as a JSON array of objects.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            goal: { type: Type.STRING },
                            category: { type: Type.STRING, enum: ['Diet', 'Exercise', 'Mental Health', 'General'] },
                            difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] },
                        },
                        required: ["goal", "category", "difficulty"]
                    },
                },
            },
        });
        
        const jsonString = response.text.trim();
        const goals = JSON.parse(jsonString);
        return goals;

    } catch (error) {
        console.error("Error generating health goals with Gemini:", error);
        // Fallback to mock data on API error
        return mockRecommendations;
    }
};
