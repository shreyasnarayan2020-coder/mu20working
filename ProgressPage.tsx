
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../App';
import { Recommendation } from '../types';
import { generateHealthGoals } from '../services/geminiService';
import { supabase } from '../services/supabaseService';
import { StarIcon } from './icons';

const difficultyColors = {
    Easy: 'bg-green-100 text-green-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    Hard: 'bg-red-100 text-red-800',
};

const difficultyPoints = {
    Easy: 10,
    Medium: 25,
    Hard: 50,
};

const ProgressPage: React.FC = () => {
    const { user, healthData, updateUser } = useAuth();
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const fetchRecommendations = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const data = await supabase.recommendations.get(user.id);
        setRecommendations(data);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchRecommendations();
    }, [fetchRecommendations]);

    const handleGenerateGoals = async () => {
        if (!healthData) {
            setMessage('Health data is not available to generate goals.');
            return;
        }
        setGenerating(true);
        setMessage('');
        const newGoals = await generateHealthGoals(healthData);
        const { recommendations: savedRecs, error } = await supabase.recommendations.create(user!.id, newGoals);
        if (error) {
            setMessage('Error generating new goals.');
        } else {
            setRecommendations(savedRecs);
        }
        setGenerating(false);
    };

    const handleToggleCompletion = (id: string) => {
        setRecommendations(prev => 
            prev.map(rec => rec.id === id ? { ...rec, isCompleted: !rec.isCompleted } : rec)
        );
    };

    const handleSaveChanges = async () => {
        if (!user) return;
        setSaving(true);
        setMessage('');
        
        let pointsEarned = 0;
        const originalRecs = await supabase.recommendations.get(user.id);

        for (const rec of recommendations) {
            const originalRec = originalRecs.find(r => r.id === rec.id);
            if (originalRec && !originalRec.isCompleted && rec.isCompleted) {
                pointsEarned += difficultyPoints[rec.difficulty];
            }
        }

        const { error } = await supabase.recommendations.updateStatus(recommendations);
        if (error) {
            setMessage('Error saving changes.');
        } else {
            if (pointsEarned > 0) {
                const newTotalPoints = user.points + pointsEarned;
                await supabase.user.updatePoints(user.id, newTotalPoints);
                updateUser({ points: newTotalPoints });
                setMessage(`Changes saved! You've earned ${pointsEarned} points!`);
            } else {
                setMessage('Your progress has been saved.');
            }
        }
        setSaving(false);
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Your Progress</h1>
                    <p className="mt-2 text-gray-600">Complete your goals to earn points and improve your health.</p>
                </div>
                <button 
                    onClick={handleGenerateGoals} 
                    disabled={generating}
                    className="py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-opacity-50 flex items-center justify-center"
                >
                    {generating ? (
                        <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg> Generating...</>
                    ) : (
                        'Generate New Goals'
                    )}
                </button>
            </div>
            
            {loading ? (
                <p className="mt-8 text-center text-gray-500">Loading your goals...</p>
            ) : recommendations.length === 0 ? (
                <div className="mt-8 text-center bg-white p-8 rounded-lg shadow">
                    <h3 className="text-xl font-semibold">No goals yet!</h3>
                    <p className="text-gray-600 mt-2">Click the "Generate New Goals" button to get started.</p>
                </div>
            ) : (
                <div className="mt-8 space-y-4">
                    {recommendations.map(rec => (
                        <div key={rec.id} className={`p-4 bg-white rounded-lg shadow-sm flex items-center justify-between transition-all ${rec.isCompleted ? 'opacity-60' : ''}`}>
                            <div className="flex items-center">
                                <input 
                                    type="checkbox"
                                    checked={rec.isCompleted}
                                    onChange={() => handleToggleCompletion(rec.id)}
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <div className="ml-4">
                                    <p className={`font-medium ${rec.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>{rec.goal}</p>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${difficultyColors[rec.difficulty]}`}>{rec.difficulty}</span>
                                </div>
                            </div>
                             <div className="flex items-center space-x-1 text-yellow-600 font-semibold">
                                <StarIcon className="w-4 h-4" />
                                <span>{difficultyPoints[rec.difficulty]}</span>
                             </div>
                        </div>
                    ))}
                    <div className="flex justify-end pt-4">
                         {message && <p className="text-sm text-green-600 mr-4 self-center">{message}</p>}
                        <button 
                            onClick={handleSaveChanges} 
                            disabled={saving}
                            className="py-2 px-6 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgressPage;
