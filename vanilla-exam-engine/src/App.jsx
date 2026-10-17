import React, { createContext, useContext, useState, useEffect } from 'react';
import { AlertTriangle, Clock, CheckCircle, LayoutGrid, ArrowRight, ArrowLeft } from 'lucide-react';

// --- LOCAL DATABASES FOR NON-API SUBJECTS ---
const BUSINESS_DB = [
  { id: 'bus1', text: "What does SWOT analysis stand for?", options: ["Strengths, Weaknesses, Opportunities, Threats", "Sales, Wealth, Operations, Taxes", "Systems, Workflows, Output, Time", "Strategy, Wages, Objectives, Tactics"], correct: "Strengths, Weaknesses, Opportunities, Threats", topic: "Business Admin" },
  { id: 'bus2', text: "Which management function involves structuring resources and activities?", options: ["Planning", "Organizing", "Leading", "Controlling"], correct: "Organizing", topic: "Business Admin" },
  { id: 'bus3', text: "What is the primary goal of a for-profit organization?", options: ["Maximize employee happiness", "Increase market share", "Maximize shareholder wealth", "Minimize taxes"], correct: "Maximize shareholder wealth", topic: "Business Admin" },
  { id: 'bus4', text: "In marketing, what are the 4 Ps?", options: ["Product, Price, Place, Promotion", "People, Process, Physical, Plan", "Package, Price, Profit, Percent", "Product, Purchase, Payment, Profit"], correct: "Product, Price, Place, Promotion", topic: "Business Admin" },
  { id: 'bus5', text: "Which theory focuses on employee motivation through basic needs, safety, and self-actualization?", options: ["Maslow's Hierarchy", "Taylor's Scientific Management", "Fayol's Principles", "Weber's Bureaucracy"], correct: "Maslow's Hierarchy", topic: "Business Admin" },
  { id: 'bus6', text: "What defines a 'Sole Proprietorship'?", options: ["Owned by shareholders", "Owned by a single individual", "A government-owned entity", "A partnership between two companies"], correct: "Owned by a single individual", topic: "Business Admin" }
];

const ACCOUNTING_DB = [
  { id: 'acc1', text: "What is the fundamental accounting equation?", options: ["Assets = Liabilities + Equity", "Revenue - Expenses = Profit", "Assets + Liabilities = Equity", "Equity = Assets + Revenue"], correct: "Assets = Liabilities + Equity", topic: "Accountancy" },
  { id: 'acc2', text: "Which financial statement shows a company's financial position at a specific point in time?", options: ["Income Statement", "Cash Flow Statement", "Balance Sheet", "Statement of Retained Earnings"], correct: "Balance Sheet", topic: "Accountancy" },
  { id: 'acc3', text: "In double-entry bookkeeping, what must every transaction have?", options: ["A receipt and an invoice", "An equal debit and credit entry", "Approval from a manager", "A corresponding tax deduction"], correct: "An equal debit and credit entry", topic: "Accountancy" },
  { id: 'acc4', text: "What type of account is 'Accounts Receivable'?", options: ["Liability", "Revenue", "Asset", "Expense"], correct: "Asset", topic: "Accountancy" },
  { id: 'acc5', text: "Which accounting principle states that expenses should be recorded in the same period as the revenues they helped generate?", options: ["Going Concern Principle", "Matching Principle", "Cost Principle", "Materiality Principle"], correct: "Matching Principle", topic: "Accountancy" },
  { id: 'acc6', text: "What does 'COGS' stand for?", options: ["Cost of General Sales", "Cash on Goods Sold", "Cost of Goods Sold", "Credit of Gross Sales"], correct: "Cost of Goods Sold", topic: "Accountancy" }
];

// --- 1. GLOBAL STATE (CONTEXT) ---
const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [examState, setExamState] = useState('not_started'); // not_started, active, finished
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [warnings, setWarnings] = useState(0);

  // DYNAMIC EXAM GENERATOR
  const configureAndStartExam = async (config) => {
    setIsLoading(true);
    setTimeLeft(config.time * 60); // Convert minutes to seconds
    setWarnings(0);
    setAnswers({});
    setCurrentIdx(0);

    if (config.category === 'cs') {
      try {
        // This fetch real CS questions from the API based on user's quantity amount
        const response = await fetch(`https://opentdb.com/api.php?amount=${config.amount}&category=18&type=multiple`);
        const data = await response.json();
        
        const formattedQuestions = data.results.map((q, index) => {
          const allOptions = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);
          return {
            id: `cs-${index}`,
            text: new DOMParser().parseFromString(q.question, 'text/html').body.textContent,
            options: allOptions.map(opt => new DOMParser().parseFromString(opt, 'text/html').body.textContent),
            correct: new DOMParser().parseFromString(q.correct_answer, 'text/html').body.textContent,
            topic: "Computer Science"
          };
        });
        setQuestions(formattedQuestions);
      } catch (error) {
        alert("Failed to load live questions. Check internet connection.");
        setIsLoading(false);
        return;
      }
    } else {
      // Pull from our local databases for Business & Accounting
      const sourceDB = config.category === 'business' ? BUSINESS_DB : ACCOUNTING_DB;
      
      // Shuffle the local array and slice it to match the requested amount
      const shuffled = [...sourceDB].sort(() => Math.random() - 0.5).slice(0, config.amount);
      
      // If they ask for more questions than we have hardcoded, warn them
      if (config.amount > sourceDB.length) {
        alert(`Note: We only have ${sourceDB.length} ${config.category} questions in the local database. Proceeding with ${sourceDB.length}.`);
      }
      setQuestions(shuffled);
    }

    setIsLoading(false);
    setExamState('active');
  };

  const submitExam = () => setExamState('finished');
  const addWarning = () => setWarnings(prev => prev + 1);
  const selectAnswer = (qId, option) => setAnswers(prev => ({ ...prev, [qId]: option }));

  // TIMER LOGIC
  useEffect(() => {
    let timer;
    if (examState === 'active' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => {
        if (prev <= 1) { submitExam(); return 0; }
        return prev - 1;
      }), 1000);
    }
    return () => clearInterval(timer);
  }, [examState, timeLeft]);

  return (
    <AppContext.Provider value={{
      questions, isLoading, examState, configureAndStartExam, submitExam,
      currentIdx, setCurrentIdx, answers, selectAnswer, timeLeft, warnings, addWarning, setExamState
    }}>
      {children}
    </AppContext.Provider>
  );
};

// --- 2. PROCTORING HOOK ---
const useProctoring = () => {
  const { examState, addWarning } = useContext(AppContext);
  useEffect(() => {
    const handleVisibility = () => {
      if (examState === 'active' && document.hidden) {
        addWarning();
        alert("PROCTORING ALERT: Tab switching detected. This violation has been logged.");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [examState]);
};

// --- 3. UI COMPONENTS ---
const WelcomeScreen = () => {
  const { configureAndStartExam, isLoading } = useContext(AppContext);
  
  // Local state for the configuration form
  const [config, setConfig] = useState({
    amount: 5,
    time: 5,
    category: 'cs'
  });

  const handleStart = () => configureAndStartExam(config);

  return (
    <div className="card text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 className="mb-2">Assessment Configuration</h1>
      <p className="mb-4" style={{ color: '#6b7280' }}>Customize the parameters of the examination below before beginning.</p>
      
      <div style={{ textAlign: 'left', background: '#f9fafb', padding: '24px', borderRadius: '8px', marginBottom: '32px' }}>
        
        {/* Subject Selection */}
        <div className="mb-4">
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Select Subject</label>
          <select 
            value={config.category} 
            onChange={e => setConfig({...config, category: e.target.value})}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
          >
            <option value="cs">Computer Science (Live API)</option>
            <option value="business">Business Administration (Local DB)</option>
            <option value="accounting">Accountancy (Local DB)</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Question Amount */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Number of Questions</label>
            <input 
              type="number" 
              min="1" 
              max={config.category === 'cs' ? 50 : 6}
              value={config.amount} 
              onChange={e => setConfig({...config, amount: Number(e.target.value)})}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          </div>

          {/* Time Limit */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Time Limit</label>
            <select 
              value={config.time} 
              onChange={e => setConfig({...config, time: Number(e.target.value)})}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            >
              <option value={1}>1 Minute (Speed Test)</option>
              <option value={5}>5 Minutes</option>
              <option value={10}>10 Minutes</option>
              <option value={15}>15 Minutes</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <button disabled className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
          Generating Examination...
        </button>
      ) : (
        <button onClick={handleStart} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          Launch Exam Environment
        </button>
      )}
    </div>
  );
};

const ActiveExam = () => {
  useProctoring();
  const { questions, currentIdx, setCurrentIdx, answers, selectAnswer, timeLeft, warnings, submitExam } = useContext(AppContext);
  
  if (!questions || questions.length === 0) return <div>Loading questions...</div>;

  const question = questions[currentIdx];
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  return (
    <div className="exam-layout">
      {/* Sidebar */}
      <div className="card">
        <div className="timer mb-4">
          <Clock size={24} /> {formatTime(timeLeft)}
        </div>
        <h3 className="mb-2 flex-between" style={{ fontSize: '14px', color: '#6b7280' }}>
          <span><LayoutGrid size={16} /> Grid</span>
        </h3>
        <div className="grid-container">
          {questions.map((q, idx) => (
            <button 
              key={q.id} 
              onClick={() => setCurrentIdx(idx)}
              className={`grid-btn ${currentIdx === idx ? 'active' : ''} ${answers[q.id] ? 'answered' : ''}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
        {warnings > 0 && (
          <div className="alert">
            <AlertTriangle size={18} /> {warnings} Violations
          </div>
        )}
      </div>

      {/* Question Area */}
      <div className="card">
        <div className="flex-between mb-4">
          <span style={{ background: '#f3f4f6', padding: '4px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: '600' }}>{question.topic}</span>
          <span style={{ color: '#6b7280', fontSize: '14px', fontWeight: '600' }}>Question {currentIdx + 1} of {questions.length}</span>
        </div>
        
        <h2 style={{ lineHeight: '1.4' }}>{question.text}</h2>
        
        <div className="options-list">
          {question.options.map(option => (
            <button
              key={option}
              onClick={() => selectAnswer(question.id, option)}
              className={`option-btn ${answers[question.id] === option ? 'selected' : ''}`}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', border: '2px solid',
                borderColor: answers[question.id] === option ? '#4f46e5' : '#d1d5db',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {answers[question.id] === option && <div style={{ width: '10px', height: '10px', background: '#4f46e5', borderRadius: '50%' }} />}
              </div>
              <span style={{ textAlign: 'left' }}>{option}</span>
            </button>
          ))}
        </div>
        
        <div className="flex-between" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
          <button 
            disabled={currentIdx === 0} 
            onClick={() => setCurrentIdx(prev => prev - 1)}
            className="btn btn-secondary"
          >
            <ArrowLeft size={18} /> Previous
          </button>
          
          {currentIdx === questions.length - 1 ? (
            <button onClick={submitExam} className="btn btn-success">
              <CheckCircle size={18} /> Submit Exam
            </button>
          ) : (
            <button onClick={() => setCurrentIdx(prev => prev + 1)} className="btn btn-primary">
              Next <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ResultsDashboard = () => {
  const { questions, answers, warnings, setExamState } = useContext(AppContext);
  
  const score = questions.reduce((total, q) => total + (answers[q.id] === q.correct ? 1 : 0), 0);
  const percentage = Math.round((score / questions.length) * 100);

  return (
    <div className="card text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 className="mb-1">Assessment Complete</h2>
      <p className="mb-4" style={{ color: '#6b7280' }}>Here is your performance breakdown, Phaj.</p>
      
      <div style={{ fontSize: '64px', fontWeight: '900', color: '#4f46e5' }}>{percentage}%</div>
      <p className="mb-4 text-xl">You scored {score} out of {questions.length}</p>
      
      {warnings > 0 && (
        <div className="alert mb-4" style={{ textAlign: 'left', display: 'block' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <AlertTriangle size={18} /> Proctoring Flag Raised
          </h4>
          <p>We detected {warnings} instance(s) of tab-switching during the exam.</p>
        </div>
      )}
      
      <button onClick={() => setExamState('not_started')} className="btn btn-primary mt-4" style={{ width: '100%', justifyContent: 'center' }}>
        Configure New Exam
      </button>
    </div>
  );
};

// --- 4. MAIN APP WRAPPER ---
const MainContent = () => {
  const { examState } = useContext(AppContext);
  if (examState === 'not_started') return <WelcomeScreen />;
  if (examState === 'active') return <ActiveExam />;
  return <ResultsDashboard />;
};

export default function App() {
  return (
    <div className="app-container">
      <AppProvider>
        <MainContent />
      </AppProvider>
    </div>
  );
}