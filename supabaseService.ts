import { User, HealthData, GameSession, Recommendation, DailyMetrics } from '../types';

// Simple UUID generator since we can't import external libraries easily.
const simpleUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// n8n Webhook for OTP
const N8N_WEBHOOK_URL = 'https://shreyopb.app.n8n.cloud/webhook/03b19fbf-8717-4fc6-b7c8-3e5a92b71461/';

export const getOtp = async (email: string): Promise<string> => {
    try {
        const response = await fetch(`${N8N_WEBHOOK_URL}${email}`);
        if (!response.ok) {
            throw new Error(`Webhook failed with status: ${response.status}`);
        }
        const otp = await response.text();
        // Store the OTP with the email for verification later
        localStorage.setItem(`otp_${email}`, otp);
        return otp;
    } catch (error) {
        console.error("Error fetching OTP from n8n:", error);
        // Fallback for local dev if webhook fails
        const mockOtp = "123456";
        localStorage.setItem(`otp_${email}`, mockOtp);
        alert(`(DEV) OTP for ${email} is ${mockOtp}`); // Show OTP in dev
        return mockOtp;
    }
};

// MOCK DATABASE using localStorage for persistence during preview
const db = {
    users: JSON.parse(localStorage.getItem('db_users') || '{}'),
    healthData: JSON.parse(localStorage.getItem('db_healthData') || '{}'),
    gameSessions: JSON.parse(localStorage.getItem('db_gameSessions') || '[]'),
    recommendations: JSON.parse(localStorage.getItem('db_recommendations') || '[]'),
    dailyMetrics: JSON.parse(localStorage.getItem('db_dailyMetrics') || '[]'),
    
    save() {
        localStorage.setItem('db_users', JSON.stringify(this.users));
        localStorage.setItem('db_healthData', JSON.stringify(this.healthData));
        localStorage.setItem('db_gameSessions', JSON.stringify(this.gameSessions));
        localStorage.setItem('db_recommendations', JSON.stringify(this.recommendations));
        localStorage.setItem('db_dailyMetrics', JSON.stringify(this.dailyMetrics));
    }
};

// Mock Supabase Client to simulate the real API
export const supabase = {
    auth: {
        signUp: async ({ email, password }: { email: string, password?: string }) => {
            if (db.users[email]) {
                return { user: null, error: 'User already exists.' };
            }
            const userId = simpleUuid();
            // In a real app, password would be hashed.
            db.users[email] = { id: userId, email, password, points: 0, firstName: '', lastName: '' };
            db.save();
            return { user: { id: userId, email }, error: null };
        },
        signInWithPassword: async ({ email, password }: { email: string, password?: string }) => {
            const user = db.users[email];
            if (!user || user.password !== password) {
                return { user: null, error: 'Invalid credentials.' };
            }
            return { user: { id: user.id, email: user.email }, error: null };
        },
        verifyOtp: async (email: string, otp: string) => {
            const storedOtp = localStorage.getItem(`otp_${email}`);
            if (otp !== storedOtp && otp !== "123456") { // allow master OTP for dev
                return { user: null, healthData: null, error: 'Invalid OTP.' };
            }
            const userRecord = db.users[email];
            if (!userRecord) {
                 return { user: null, healthData: null, error: 'User not found.' };
            }
            const user: User = {
                id: userRecord.id,
                email: userRecord.email,
                firstName: userRecord.firstName,
                lastName: userRecord.lastName,
                points: userRecord.points
            };
            const healthData = db.healthData[userRecord.id] || null;
            localStorage.removeItem(`otp_${email}`);
            return { user, healthData, error: null };
        },
    },
    user: {
        saveInitialDetails: async (userData: Omit<User, 'points'>, healthData: HealthData) => {
             const userEmail = userData.email;
             if (!db.users[userEmail]) {
                 return { user: null, error: "User not found." };
             }
             db.users[userEmail] = { ...db.users[userEmail], firstName: userData.firstName, lastName: userData.lastName, points: 0 };
             db.healthData[userData.id] = healthData;
             db.save();

             const finalUser: User = db.users[userEmail];
             return { user: finalUser, error: null };
        },
        updateDetails: async (userId: string, updates: Partial<User> & { password?: string }) => {
            const userEmail = Object.keys(db.users).find(email => db.users[email].id === userId);
            if (!userEmail) {
                return { updatedUser: null, error: 'User not found' };
            }
            db.users[userEmail] = { ...db.users[userEmail], ...updates };
            db.save();
            return { updatedUser: db.users[userEmail], error: null };
        },
        updatePoints: async (userId: string, points: number) => {
             const userEmail = Object.keys(db.users).find(email => db.users[email].id === userId);
             if (!userEmail) return;
             db.users[userEmail].points = points;
             db.save();
        }
    },
    metrics: {
        hasSubmittedToday: async (userId: string): Promise<boolean> => {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            return db.dailyMetrics.some((m: DailyMetrics) => m.userId === userId && m.date === today);
        },
        save: async (userId: string, metrics: Partial<DailyMetrics>) => {
            const today = new Date().toISOString().split('T')[0];
            db.dailyMetrics.push({ userId, date: today, ...metrics });
            db.save();
            return { error: null };
        }
    },
    games: {
        saveSession: async (session: Omit<GameSession, 'timestamp'>) => {
            db.gameSessions.push({ ...session, timestamp: new Date() });
            db.save();
            return { error: null };
        }
    },
    recommendations: {
        get: async (userId: string): Promise<Recommendation[]> => {
            return db.recommendations.filter((r: Recommendation) => r.userId === userId);
        },
        create: async (userId: string, newGoals: Omit<Recommendation, 'id' | 'userId' | 'isCompleted'>[]) => {
            // Clear old recommendations for the user
            db.recommendations = db.recommendations.filter((r: Recommendation) => r.userId !== userId);
            
            const savedRecs: Recommendation[] = newGoals.map(goal => ({
                ...goal,
                id: simpleUuid(),
                userId,
                isCompleted: false,
            }));
            db.recommendations.push(...savedRecs);
            db.save();
            return { recommendations: savedRecs, error: null };
        },
        updateStatus: async (updatedRecs: Recommendation[]) => {
            updatedRecs.forEach(updatedRec => {
                const index = db.recommendations.findIndex((r: Recommendation) => r.id === updatedRec.id);
                if (index !== -1) {
                    db.recommendations[index] = updatedRec;
                }
            });
            db.save();
            return { error: null };
        }
    }
};
