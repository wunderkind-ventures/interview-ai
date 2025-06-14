import React, { useState, useEffect, useCallback } from 'react';
import { Bot, User, Upload, BarChart, BookOpen, Users, Play, Send, ChevronDown, CheckCircle, XCircle } from 'lucide-react';

// --- MOCK DATA & CONFIGURATION ---

const PM_COMPETENCIES = {
  "Problem Definition & Structuring": { description: "Deconstructing ambiguous problems, asking clarifying questions, and outlining a logical approach.", score: 0, feedback: [], recommendations: ["Read 'The Pyramid Principle' by Barbara Minto.", "Practice the CIRCLES method for product design questions."] },
  "User Empathy & Product Vision": { description: "Identifying user needs, articulating pain points, and demonstrating a user-centric mindset.", score: 0, feedback: [], recommendations: ["Watch videos on 'Jobs to be Done' framework.", "Create user personas for a fictional product."] },
  "Strategic Thinking & Business Acumen": { description: "Connecting solutions to business goals, understanding market dynamics, and defining success metrics.", score: 0, feedback: [], recommendations: ["Analyze the business model of a popular tech company.", "Read 'Good Strategy Bad Strategy' by Richard Rumelt."] },
  "Solution Ideation & Prioritization": { description: "Brainstorming creative solutions and using frameworks to prioritize features effectively.", score:0, feedback: [], recommendations: ["Learn about the RICE scoring model.", "Practice brainstorming exercises like 'Crazy Eights'."] },
  "Communication & Influence": { description: "Articulating ideas clearly, persuasively, and structuring responses logically.", score: 0, feedback: [], recommendations: ["Record yourself answering a behavioral question and analyze it.", "Practice telling a compelling story about a project you worked on."] },
};

const INTERVIEW_TYPES = [
  { id: 'product-design', name: 'Product Design', description: 'Focuses on your ability to design a new product or improve an existing one.' },
  { id: 'product-strategy', name: 'Product Strategy', description: 'Tests your strategic thinking and business acumen in market scenarios.' },
  { id: 'behavioral', name: 'Behavioral', description: 'Assesses your past experiences and how you handle work-related situations.' },
];

const INTERVIEWER_PERSONAS = {
  'faang-pm': "I'm a Senior PM at a large tech company. I value data-driven decisions and structured thinking.",
  'startup-founder': "I'm the founder of a fast-growing startup. I'm looking for scrappiness, user obsession, and a bias for action.",
  'non-tech-hm': "I'm a hiring manager from a non-technical background. Explain your ideas in a simple, clear, and compelling way.",
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [appState, setAppState] = useState('setup'); // 'setup', 'interview', 'report'
  const [interviewConfig, setInterviewConfig] = useState({
    interviewType: INTERVIEW_TYPES[0].id,
    persona: Object.keys(INTERVIEWER_PERSONAS)[0],
    resume: null,
  });
  const [transcript, setTranscript] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [feedbackReport, setFeedbackReport] = useState(null);

  const handleStartInterview = () => {
    setTranscript([
      { sender: 'system', text: `Interview starts. Persona: ${INTERVIEWER_PERSONAS[interviewConfig.persona]}` },
      { sender: 'bot', text: "Hello, thanks for joining me today. Let's start with our first question." }
    ]);
    setAppState('interview');
    // In a real app, the Orchestrator Agent would initiate the Interviewer Agent.
    setTimeout(() => askQuestion(INTERVIEW_TYPES.find(t => t.id === interviewConfig.interviewType).name), 1000);
  };

  const askQuestion = useCallback((type) => {
    setIsTyping(true);
    // Interviewer Agent generates a question
    let question = "";
    if (type === 'Product Design') {
      question = "Let's say you're a PM at Google Maps. How would you design a feature to help users find parking?";
    } else if (type === 'Product Strategy') {
      question = "Imagine you are the CEO of Spotify. How would you respond to the growing threat of TikTok in the audio space?";
    } else {
      question = "Tell me about a time you had to influence a difficult stakeholder without formal authority.";
    }
    setTimeout(() => {
      setTranscript(prev => [...prev, { sender: 'bot', text: question }]);
      setIsTyping(false);
    }, 2000);
  }, []);

  const handleUserResponse = (text) => {
    const newTranscript = [...transcript, { sender: 'user', text }];
    setTranscript(newTranscript);
    setIsTyping(true);

    // Orchestrator sends user response to Feedback & Skill-Mapper Agents in the background
    // And prompts Interviewer Agent for a follow-up or next question
    setTimeout(() => {
      if (Math.random() > 0.4 && newTranscript.length < 5) { // Occasionally asks a follow-up
          setTranscript(prev => [...prev, { sender: 'bot', text: "Interesting. Can you elaborate on the trade-offs you considered?" }]);
      } else if (newTranscript.length >= 5) {
          endInterview(newTranscript);
      } else {
          askQuestion(INTERVIEW_TYPES.find(t => t.id === interviewConfig.interviewType).name);
      }
      setIsTyping(false);
    }, 2500);
  };

  const endInterview = (finalTranscript) => {
    setTranscript(prev => [...prev, { sender: 'system', text: "Thank you, that's all the time we have. Generating your feedback report now..." }]);
    
    // Simulate multi-agent analysis to generate report
    // Feedback Agent analyzes transcript
    // Skill-Mapper Agent scores competencies
    // Learning Agent provides recommendations
    const report = JSON.parse(JSON.stringify(PM_COMPETENCIES)); // Deep copy
    Object.keys(report).forEach(key => {
        report[key].score = Math.floor(Math.random() * 3) + 3; // Random score between 3-5
        report[key].feedback.push("You did a great job structuring your initial thoughts.");
        if(report[key].score < 4) {
             report[key].feedback.push("However, you could have delved deeper into the user pain points before jumping to solutions.");
        } else {
             report[key].feedback.push("Your connection of user needs to business impact was particularly strong.");
        }
    });

    setTimeout(() => {
        setFeedbackReport(report);
        setAppState('report');
    }, 3000);
  }

  const resetApp = () => {
    setAppState('setup');
    setInterviewConfig({
      interviewType: INTERVIEW_TYPES[0].id,
      persona: Object.keys(INTERVIEWER_PERSONAS)[0],
      resume: null,
    });
    setTranscript([]);
    setFeedbackReport(null);
  }

  return (
    <div className="bg-slate-900 text-white min-h-screen font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{height: '90vh'}}>
        <header className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg"><Bot size={24} /></div>
            <h1 className="text-xl font-bold text-slate-200">PM AI Mock Interview</h1>
          </div>
          {appState !== 'setup' && <button onClick={resetApp} className="text-sm text-slate-400 hover:text-white">Start Over</button>}
        </header>

        <main className="flex-grow p-6 overflow-y-auto">
          {appState === 'setup' && <InterviewSetup config={interviewConfig} setConfig={setInterviewConfig} onStart={handleStartInterview} />}
          {appState === 'interview' && <InterviewScreen transcript={transcript} isTyping={isTyping} onSend={handleUserResponse} />}
          {appState === 'report' && <FeedbackReport report={feedbackReport} />}
        </main>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function InterviewSetup({ config, setConfig, onStart }) {
  const [fileName, setFileName] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setConfig(prev => ({ ...prev, resume: file }));
      setFileName(file.name);
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Prepare for Your Interview</h2>
        <p className="text-slate-400 mt-1">Configure your mock interview session to match your goals.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Interview Type */}
        <div>
          <label className="text-slate-300 font-medium flex items-center gap-2 mb-3"><BookOpen size={18}/> Interview Type</label>
          <div className="bg-slate-900 rounded-lg p-2 space-y-2">
            {INTERVIEW_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setConfig(prev => ({...prev, interviewType: type.id}))}
                className={`w-full text-left p-3 rounded-md transition-all duration-200 ${config.interviewType === type.id ? 'bg-indigo-600 shadow-lg' : 'hover:bg-slate-700/50'}`}
              >
                <p className="font-semibold">{type.name}</p>
                <p className="text-xs text-slate-400">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Interviewer Persona */}
        <div>
          <label className="text-slate-300 font-medium flex items-center gap-2 mb-3"><Users size={18}/> Interviewer Persona</label>
          <div className="relative">
            <select
              value={config.persona}
              onChange={(e) => setConfig(prev => ({...prev, persona: e.target.value}))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3 appearance-none focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {Object.entries(INTERVIEWER_PERSONAS).map(([id, text]) => (
                <option key={id} value={id} className="bg-slate-800">{id.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
          </div>
          <p className="text-sm text-slate-400 bg-slate-900/50 p-3 mt-3 rounded-lg border border-slate-700">"{INTERVIEWER_PERSONAS[config.persona]}"</p>
        </div>
      </div>
      
      {/* Resume Upload */}
      <div>
        <label className="text-slate-300 font-medium flex items-center gap-2 mb-3"><Upload size={18}/> Upload Your Resume (Optional)</label>
        <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
            <input type="file" id="resume-upload" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
            <label htmlFor="resume-upload" className="cursor-pointer text-indigo-400 hover:text-indigo-300">
                {fileName ? `Selected: ${fileName}` : "Click to upload a file"}
            </label>
            <p className="text-xs text-slate-500 mt-1">The Interviewer Agent will tailor questions based on your experience.</p>
        </div>
      </div>

      <div className="text-center pt-4">
        <button 
          onClick={onStart} 
          className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-indigo-500 transition-all duration-300 transform hover:scale-105 flex items-center gap-2 mx-auto"
        >
          <Play size={20}/> Start Mock Interview
        </button>
      </div>
    </div>
  );
}

function InterviewScreen({ transcript, isTyping, onSend }) {
  const [input, setInput] = useState('');
  const messagesEndRef = React.useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, isTyping]);

  const handleSend = () => {
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
        <div className="flex-grow overflow-y-auto space-y-6 pr-4">
            {transcript.map((msg, index) => (
                <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                    {msg.sender === 'bot' && <div className="bg-indigo-600 p-2 rounded-full mt-1"><Bot size={20}/></div>}
                    {msg.sender === 'system' && <div className="text-center w-full text-xs text-slate-500 p-2 bg-slate-900/30 rounded-md">--- {msg.text} ---</div>}
                    {msg.sender !== 'system' && (
                        <div className={`max-w-xl p-4 rounded-2xl ${msg.sender === 'user' ? 'bg-slate-700 rounded-br-none' : 'bg-slate-700/50 rounded-bl-none'}`}>
                            <p className="text-slate-200 whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    )}
                     {msg.sender === 'user' && <div className="bg-slate-600 p-2 rounded-full mt-1"><User size={20}/></div>}
                </div>
            ))}
            {isTyping && (
                <div className="flex items-start gap-3">
                    <div className="bg-indigo-600 p-2 rounded-full mt-1"><Bot size={20}/></div>
                    <div className="p-4 rounded-2xl bg-slate-700/50 rounded-bl-none">
                        <div className="flex gap-1.5 items-center">
                            <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce delay-0"></span>
                            <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                            <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce delay-300"></span>
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
        <div className="mt-6 flex gap-3">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isTyping && handleSend()}
                placeholder="Type your answer..." 
                disabled={isTyping}
                className="flex-grow bg-slate-700 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
            />
            <button 
                onClick={handleSend}
                disabled={isTyping}
                className="bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-500 transition-colors disabled:bg-indigo-800 disabled:cursor-not-allowed"
            >
                <Send size={20}/>
            </button>
        </div>
    </div>
  );
}

function FeedbackReport({ report }) {
  if (!report) {
    return (
        <div className="text-center p-8">
            <h2 className="text-xl font-bold">Loading report...</h2>
        </div>
    );
  }

  const overallScore = Object.values(report).reduce((acc, competency) => acc + competency.score, 0) / Object.keys(report).length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-slate-100">Your Interview Feedback</h2>
        <p className="text-slate-400 mt-1">A detailed breakdown of your performance by our AI agents.</p>
      </div>

      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
        <h3 className="text-lg font-semibold flex items-center gap-2"><BarChart size={20}/> Overall Performance</h3>
        <div className="flex items-center gap-4 mt-3">
            <div className="text-4xl font-bold text-indigo-400">{overallScore.toFixed(1)}<span className="text-2xl text-slate-500">/5.0</span></div>
            <p className="text-slate-300">
                {overallScore >= 4 ? "Excellent work! You demonstrated strong product sense and clear communication." : 
                overallScore >= 3 ? "Good job! There are clear strengths and some areas for improvement." : 
                "A solid attempt. Let's focus on building up your core competencies."}
            </p>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Competency Breakdown</h3>
        <div className="space-y-4">
            {Object.entries(report).map(([name, data]) => (
                <div key={name} className="bg-slate-800/70 p-4 rounded-lg border border-slate-700">
                    <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-slate-200">{name}</h4>
                        <span className={`font-bold text-lg ${data.score >= 4 ? 'text-green-400' : 'text-amber-400'}`}>{data.score.toFixed(1)}/5</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1 mb-3">{data.description}</p>
                    <div className="w-full bg-slate-700 rounded-full h-2.5">
                        <div className={`bg-gradient-to-r ${data.score >= 4 ? 'from-green-500 to-teal-400' : 'from-amber-500 to-yellow-400'} h-2.5 rounded-full`} style={{width: `${data.score * 20}%`}}></div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                        <h5 className="font-semibold text-slate-300">Feedback from AI Agent:</h5>
                        {data.feedback.map((fb, i) => (
                          <div key={i} className="flex items-start gap-2 text-slate-400">
                            {fb.includes("great") || fb.includes("strong") ? <CheckCircle className="text-green-500 mt-1 shrink-0" size={16} /> : <XCircle className="text-amber-500 mt-1 shrink-0" size={16} />}
                            <span>{fb}</span>
                          </div>
                        ))}
                    </div>
                     <div className="mt-4 space-y-2 text-sm">
                        <h5 className="font-semibold text-slate-300 flex items-center gap-2"><BookOpen size={16}/> Recommended Next Steps:</h5>
                        {data.recommendations.map((rec, i) => (
                           <p key={i} className="text-indigo-400 pl-4">{rec}</p>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </div>

    </div>
  );
}
