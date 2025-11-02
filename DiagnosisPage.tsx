
import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useAuth } from '../App';
import { GamepadIcon, ChartIcon, ChevronLeftIcon } from './icons';
import { supabase } from '../services/supabaseService';
import { DailyMetrics } from '../types';

type DiagnosisView = 'main' | 'engagement' | 'tracking';

// Placeholder Game Components defined inside DiagnosisPage
const ClickerGame = ({ onGameEnd }: { onGameEnd: (score: number) => void }) => {
    const [clicks, setClicks] = useState(0);
    const [timeLeft, setTimeLeft] = useState(10);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        let timer: number;
        if (isActive && timeLeft > 0) {
            timer = window.setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
        } else if (timeLeft === 0) {
            setIsActive(false);
            onGameEnd(clicks);
        }
        return () => clearTimeout(timer);
    }, [timeLeft, isActive, clicks, onGameEnd]);

    const startGame = () => {
        setClicks(0);
        setTimeLeft(10);
        setIsActive(true);
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md text-center">
            <h3 className="text-xl font-bold">Click Frenzy</h3>
            <p className="text-gray-600 mt-2">Click the button as many times as you can in 10 seconds!</p>
            <div className="my-6">
                <p className="text-5xl font-bold text-primary">{isActive ? timeLeft : clicks}</p>
                <p className="text-gray-500">{isActive ? 'Seconds Left' : 'Total Clicks'}</p>
            </div>
            {isActive ? (
                <button onClick={() => setClicks(c => c + 1)} className="w-full py-3 text-lg font-semibold rounded-md text-white bg-green-500 hover:bg-green-600 transition-colors">
                    Click Me!
                </button>
            ) : (
                <button onClick={startGame} className="w-full py-3 text-lg font-semibold rounded-md text-white bg-primary hover:bg-primary/90 transition-colors">
                    {timeLeft === 0 ? 'Play Again' : 'Start Game'}
                </button>
            )}
        </div>
    );
};

const MemoryGame = ({ onGameEnd }: { onGameEnd: (score: number) => void }) => {
    // This is a simplified placeholder
    const [tries, setTries] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    
    const handleWin = () => {
        onGameEnd(tries);
        setIsComplete(true);
    }

    return (
        <div className="p-6 bg-white rounded-lg shadow-md text-center">
             <h3 className="text-xl font-bold">Memory Match</h3>
             <p className="text-gray-600 mt-2">Find all the matching pairs. (Simplified for demo)</p>
             <div className="my-6">
                <p className="text-5xl font-bold text-primary">{tries}</p>
                <p className="text-gray-500">Tries</p>
            </div>
            <div className="flex gap-4 justify-center">
                 <button onClick={() => setTries(t => t + 1)} className="py-2 px-4 rounded-md text-white bg-secondary">
                    Flip Card
                </button>
                <button onClick={handleWin} disabled={isComplete} className="py-2 px-4 rounded-md text-white bg-green-500 hover:bg-green-600 disabled:bg-opacity-50">
                    {isComplete ? 'Game Over' : 'Finish Game'}
                </button>
                 <button onClick={() => {setTries(0); setIsComplete(false)}} className="py-2 px-4 rounded-md text-white bg-primary">
                    Reset
                </button>
            </div>
        </div>
    );
};
// End of placeholder components

const DiagnosisPage: React.FC = () => {
    const [view, setView] = useState<DiagnosisView>('main');
    const { user, updateUser } = useAuth();
    const [metrics, setMetrics] = useState<Partial<DailyMetrics>>({});
    const [submittedToday, setSubmittedToday] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const checkSubmissionStatus = useCallback(async () => {
        if (!user) return;
        const status = await supabase.metrics.hasSubmittedToday(user.id);
        setSubmittedToday(status);
    }, [user]);

    useEffect(() => {
        checkSubmissionStatus();
    }, [checkSubmissionStatus]);
    
    const handleGameEnd = async (gameType: 'Clicker' | 'Memory', score: number) => {
        if (!user) return;
        await supabase.games.saveSession({ userId: user.id, gameType, score });
        // Give points for playing
        const newPoints = user.points + 10;
        updateUser({ points: newPoints });
        await supabase.user.updatePoints(user.id, newPoints);
        alert(`Game over! You scored ${score} and earned 10 points!`);
    };
    
    const handleMetricsSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        setMessage('');

        const { error } = await supabase.metrics.save(user.id, metrics);
        if (error) {
            setMessage(`Error: ${error}`);
        } else {
            const newPoints = user.points + 25;
            updateUser({ points: newPoints });
            await supabase.user.updatePoints(user.id, newPoints);
            setMessage('Metrics saved successfully! You earned 25 points.');
            setSubmittedToday(true);
        }
        setLoading(false);
    };

    const renderHeader = (title: string) => (
         <div className="flex items-center mb-6">
            <button onClick={() => setView('main')} className="p-2 rounded-full hover:bg-gray-200 mr-4">
                <ChevronLeftIcon className="w-6 h-6"/>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        </div>
    );

    const renderMetricInput = (id: keyof DailyMetrics, label: string, unit: string, type = "number") => (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label} ({unit})</label>
            <input 
                type={type} 
                id={id} 
                value={metrics[id] || ''} 
                onChange={(e) => setMetrics(prev => ({ ...prev, [id]: e.target.valueAsNumber }))}
                className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            />
        </div>
    );

    if (view === 'engagement') {
        return (
            <div className="max-w-4xl mx-auto">
                {renderHeader('Engagement')}
                 <p className="mt-2 text-gray-600 mb-8">Play these games to test your cognitive and physical abilities. You get points for each game played!</p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <ClickerGame onGameEnd={(score) => handleGameEnd('Clicker', score)} />
                    <MemoryGame onGameEnd={(score) => handleGameEnd('Memory', score)} />
                 </div>
            </div>
        );
    }
    
    if (view === 'tracking') {
        return (
            <div className="max-w-2xl mx-auto">
                {renderHeader('Your Tracking')}
                <div className="bg-white p-8 rounded-lg shadow-md">
                    {submittedToday ? (
                        <div className="text-center">
                            <h2 className="text-xl font-semibold text-green-700">Thanks for submitting today!</h2>
                            <p className="text-gray-600 mt-2">Come back tomorrow to log your new metrics.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleMetricsSubmit} className="space-y-6">
                            <h2 className="text-xl font-semibold text-gray-900">Log Your Daily Health Records</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               {renderMetricInput('heartRate', 'Heart Rate', 'bpm')}
                               {renderMetricInput('steps', 'Steps', 'count')}
                               {renderMetricInput('sleepHours', 'Sleep', 'hours')}
                               {renderMetricInput('breathingRate', 'Breathing Rate', 'breaths/min')}
                               {renderMetricInput('distanceTravelled', 'Distance Travelled', 'km')}
                               {renderMetricInput('caloriesBurnt', 'Calories Burnt', 'kcal')}
                            </div>
                            {message && <p className="text-sm text-center text-green-600">{message}</p>}
                            <div className="flex justify-end">
                                <button type="submit" disabled={loading} className="py-2 px-6 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-opacity-50">
                                    {loading ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // Default 'main' view
    return (
        <div className="max-w-4xl mx-auto">
             <h1 className="text-3xl font-bold text-gray-900">Diagnosis</h1>
             <p className="mt-2 text-gray-600 mb-8">Choose an activity to proceed.</p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <button onClick={() => setView('engagement')} className="p-8 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow text-center border border-gray-200 hover:border-primary">
                    <GamepadIcon className="w-12 h-12 mx-auto text-primary"/>
                    <h3 className="mt-4 text-xl font-semibold text-gray-900">Engagement</h3>
                    <p className="mt-1 text-gray-600">Play games to assess your skills.</p>
                 </button>
                 <button onClick={() => setView('tracking')} className="p-8 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow text-center border border-gray-200 hover:border-primary">
                    <ChartIcon className="w-12 h-12 mx-auto text-primary"/>
                    <h3 className="mt-4 text-xl font-semibold text-gray-900">Your Tracking</h3>
                    <p className="mt-1 text-gray-600">Input your daily health records.</p>
                 </button>
             </div>
        </div>
    );
};

export default DiagnosisPage;
