import Script from 'next/script';

export default function PresentationDirectPage() {
  return (
    <>
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      <div className="presentation-container">
        <style jsx global>{`
          .presentation-container {
            font-family: 'Inter', sans-serif;
            background-color: #f8fafc;
          }
          .presentation-container .section {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 5rem 1.5rem;
            border-bottom: 1px solid #e2e8f0;
          }
          .presentation-container .gradient-text {
            background: linear-gradient(to right, #4f46e5, #9333ea);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .presentation-container .card {
            background-color: white;
            border-radius: 1rem;
            padding: 2.5rem;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.1);
            border: 1px solid #e2e8f0;
            width: 100%;
            max-width: 1100px;
          }
          .presentation-container .progress-bar-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 6px;
            background-color: #e2e8f0;
            z-index: 50;
          }
          .presentation-container .progress-bar {
            height: 100%;
            background: linear-gradient(to right, #4f46e5, #9333ea);
            width: 0%;
            transition: width 0.1s ease-out;
          }
          .presentation-container .section-title {
            font-size: 0.875rem;
            font-weight: 700;
            color: #4f46e5;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 1rem;
          }
          .presentation-container .main-heading {
            font-size: 2.5rem;
            font-weight: 800;
            color: #1e293b;
            margin-bottom: 1.5rem;
            text-align: center;
            letter-spacing: -0.025em;
          }
          .presentation-container .sub-heading {
            font-size: 1.25rem;
            line-height: 1.6;
            color: #475569;
            max-width: 70ch;
            text-align: center;
          }
          .presentation-container .diagram-box {
            border-radius: 0.5rem;
            padding: 1rem;
            border-width: 2px;
          }
          .presentation-container .diagram-title {
            font-size: 1.125rem;
            font-weight: 700;
            text-align: center;
            margin-bottom: 1rem;
          }
          .presentation-container .diagram-component {
            border-radius: 0.375rem;
            padding: 0.75rem;
            text-align: center;
            font-weight: 500;
            border-width: 1px;
          }
        `}</style>

        <div className="progress-bar-container">
          <div id="progressBar" className="progress-bar"></div>
        </div>

        {/* Section 1: Introduction */}
        <section id="introduction" className="section bg-white">
          <div className="text-center">
            <div className="section-title">Introduction (0:30)</div>
            <h1 className="main-heading">InterviewAI: Democratizing Elite Interview Coaching</h1>
            <p className="sub-heading mx-auto">Good morning. I'm the Product Lead for InterviewAI. Our mission is to make world-class interview preparation accessible and affordable for every tech professional through a self-improving coaching engine that learns and adapts continuously.</p>
            <p className="mt-6 font-semibold text-purple-700">Featuring Bleeding Edge Prompting Techniques</p>
          </div>
        </section>

        {/* Section 2: Problem & Discovery */}
        <section id="problem" className="section">
          <div className="card">
            <div className="section-title text-center">Problem & Discovery (1:00)</div>
            <h2 className="main-heading">The Great Recalibration Has Changed the Game</h2>
            
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-8 rounded-r-lg mb-12 max-w-4xl mx-auto">
              <p className="text-lg text-slate-700 italic leading-relaxed">"This project was born from my own experience. After being laid off, I was thrown back into the job market and was shocked to find I couldn't clearly articulate my own accomplishments. I got nervous in interviews, struggled to tell compelling stories about my work, and realized the system was stacked against anyone who wasn't a perfect, polished interviewer. I knew there had to be a better way."</p>
              <p className="text-right font-semibold text-indigo-700 mt-4">- Kenneth Sylvain, Founder</p>
            </div>

            <p className="sub-heading mx-auto mb-12">My personal experience reflects a new market reality. An influx of talent from industry-wide layoffs has created a hyper-competitive environment. Employers can now be far more selective, creating a systemic challenge for even the most qualified candidates.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="bg-slate-50 p-6 rounded-lg border">
                <h3 className="text-xl font-bold text-slate-800">Hyper-Competition</h3>
                <p className="text-3xl font-bold text-indigo-600 my-2">2x Candidates</p>
                <p className="text-sm text-slate-500">For every open role, there are now at least two qualified job seekers, a dramatic market reversal.</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-lg border">
                <h3 className="text-xl font-bold text-slate-800">The New Bar: Articulating Impact</h3>
                <p className="text-3xl font-bold text-indigo-600 my-2">Results, Not Responsibilities</p>
                <p className="text-sm text-slate-500">Candidates fail by listing responsibilities, not by proving their quantifiable results.</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-lg border">
                <h3 className="text-xl font-bold text-slate-800">Underserved Market</h3>
                <p className="text-3xl font-bold text-indigo-600 my-2">$10B+</p>
                <p className="text-sm text-slate-500">The career services market is substantial, yet existing solutions are inaccessible or ineffective.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Your AI Solution */}
        <section id="solution" className="section bg-white">
          <div className="card">
            <div className="section-title text-center">Your AI Solution (1:00)</div>
            <h2 className="main-heading">A Self-Optimizing, Multi-Agent Coaching System</h2>
            <p className="sub-heading mx-auto mb-12">InterviewAI is a team of specialized AI agents that deliver a dynamic, personalized coaching experience for all tech roles—from engineering to product and design. Our key competitive advantage is a self-optimizing prompt system that continuously learns from user interactions to provide fairer, more accurate, and more effective feedback than any static solution.</p>
            
            {/* Diagram 1 */}
            <div className="diagram-box bg-blue-50 border-blue-200 mb-8">
              <h3 className="diagram-title text-blue-800">Product Architecture Overview</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="diagram-box bg-blue-100 border-blue-300">
                  <h4 className="diagram-title text-blue-900">User Experience</h4>
                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    <div className="diagram-component bg-white border-blue-200 text-blue-800">Resume Optimization</div>
                    <div className="diagram-component bg-white border-blue-200 text-blue-800">Mock Interviews</div>
                    <div className="diagram-component bg-white border-blue-200 text-blue-800">Achievement Tracking</div>
                    <div className="diagram-component bg-white border-blue-200 text-blue-800">Assessment Repository</div>
                  </div>
                </div>
                <div className="diagram-box bg-orange-50 border-orange-300">
                  <h4 className="diagram-title text-orange-900">🤖 AI Multi-Agent System</h4>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="diagram-component bg-white border-orange-200 text-orange-800">Orchestrator</div>
                    <div className="diagram-component bg-white border-orange-200 text-orange-800">Evaluator</div>
                    <div className="diagram-component bg-white border-orange-200 text-orange-800">Interviewer</div>
                    <div className="diagram-component bg-white border-orange-200 text-orange-800">Context</div>
                  </div>
                </div>
                <div className="diagram-box bg-green-50 border-green-300 lg:col-span-2">
                  <h4 className="diagram-title text-green-900">🧠 AI Infrastructure</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <div className="diagram-component bg-white border-green-200 text-green-800">Google Gemini (LLM)</div>
                    <div className="diagram-component bg-white border-green-200 text-green-800">RAG System</div>
                    <div className="diagram-component bg-white border-green-200 text-green-800">Vertex AI Embeddings</div>
                    <div className="diagram-component bg-white border-green-200 text-green-800">BigQuery Analytics</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagram 2 */}
            <div className="diagram-box bg-purple-50 border-purple-200">
              <h3 className="diagram-title text-purple-800">Core Innovation: Darwin-Gödel Machine Prompt Optimization (DGM-PO)</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="diagram-box bg-green-100 border-green-300">
                  <h4 className="diagram-title text-green-900">Generation Layer</h4>
                  <div className="space-y-2">
                    <div className="diagram-component bg-white border-green-200 text-green-800">Meta-Prompts</div>
                    <div className="diagram-component bg-white border-green-200 text-green-800">Templates</div>
                    <div className="diagram-component bg-white border-green-200 text-green-800">Generation Engine</div>
                  </div>
                </div>
                <div className="diagram-box bg-purple-100 border-purple-300">
                  <h4 className="diagram-title text-purple-900">Evolution Layer</h4>
                  <div className="space-y-2">
                    <div className="diagram-component bg-white border-purple-200 text-purple-800">Mutation Engine</div>
                    <div className="diagram-component bg-white border-purple-200 text-purple-800">Crossover Engine</div>
                    <div className="diagram-component bg-white border-purple-200 text-purple-800">Selection Engine</div>
                  </div>
                </div>
                <div className="diagram-box bg-blue-100 border-blue-300">
                  <h4 className="diagram-title text-blue-900">Evaluation Layer</h4>
                  <div className="space-y-2">
                    <div className="diagram-component bg-white border-blue-200 text-blue-800">Evaluator Engine</div>
                    <div className="diagram-component bg-white border-blue-200 text-blue-800">AI Scoring (GPT-4)</div>
                    <div className="diagram-component bg-white border-blue-200 text-blue-800 border-dashed">Human Validation</div>
                  </div>
                </div>
                <div className="diagram-box bg-orange-100 border-orange-300">
                  <h4 className="diagram-title text-orange-900">Learning Layer</h4>
                  <div className="space-y-2">
                    <div className="diagram-component bg-white border-orange-200 text-orange-800">Diagnostic Engine</div>
                    <div className="diagram-component bg-white border-orange-200 text-orange-800">Meta Learning</div>
                    <div className="diagram-component bg-white border-orange-200 text-orange-800">Self-Modification</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Impact & Value */}
        <section id="impact" className="section">
          <div className="card">
            <div className="section-title text-center">Impact & Value (1:00)</div>
            <h2 className="main-heading">Driving Real-World Results Through Rapid Iteration</h2>
            <p className="sub-heading mx-auto mb-12">Our impact is measured by user success. The platform is designed for continual learning through user feedback, enhancing its effectiveness with every interaction. This creates a powerful competitive moat and a clear value proposition.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-50 p-8 rounded-lg border">
                <h3 className="text-xl font-bold mb-4">Key Business Value</h3>
                <ul className="space-y-3 list-disc list-inside text-slate-600">
                  <li><span className="font-semibold text-slate-800">Freemium Model:</span> Drives low-cost user acquisition and provides rich data for model improvement.</li>
                  <li><span className="font-semibold text-slate-800">Paid Tiers:</span> Unlock high-margin revenue through advanced analytics and personalized coaching.</li>
                  <li><span className="font-semibold text-slate-800">Rapid Iteration:</span> Our adaptable architecture allows us to quickly integrate user data, constantly improving the product.</li>
                </ul>
              </div>
              <div className="bg-slate-50 p-8 rounded-lg border">
                <h3 className="text-xl font-bold mb-4">Anticipated User Impact</h3>
                <ul className="space-y-3 list-disc list-inside text-slate-600">
                  <li><span className="font-semibold text-slate-800">Increased Confidence:</span> Users feel prepared and empowered to tackle tough interviews.</li>
                  <li><span className="font-semibold text-slate-800">Higher Success Rates:</span> Measurable improvements in interview performance lead to more job offers.</li>
                  <li><span className="font-semibold text-slate-800">Tangible ROI:</span> A small investment in preparation leads to significant salary increases.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Launch Plan & Closing */}
        <section id="launch" className="section bg-white">
          <div className="card text-center">
            <div className="section-title">Launch Plan & Closing (0:30)</div>
            <h2 className="main-heading">A Phased Launch Focused on Validation and Scale</h2>
            <p className="sub-heading mx-auto mb-12">Our go-to-market strategy prioritizes quality and user feedback, ensuring a strong product-market fit before aggressive scaling. We believe now is the moment to level the playing field, using AI to deliver fair, personalized, and outcome-driven coaching for all.</p>
            <div className="w-full max-w-4xl mx-auto">
              <div className="relative">
                {/* The line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-indigo-200"></div>
                {/* The steps */}
                <div className="relative flex justify-between">
                  <div className="text-center w-1/3">
                    <div className="mx-auto w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">1</div>
                    <p className="mt-2 font-semibold">Personal Beta</p>
                    <p className="text-xs text-slate-500">Validate core experience & gather expert input</p>
                  </div>
                  <div className="text-center w-1/3">
                    <div className="mx-auto w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">2</div>
                    <p className="mt-2 font-semibold">Public Beta</p>
                    <p className="text-xs text-slate-500">Test scalability & refine funnel</p>
                  </div>
                  <div className="text-center w-1/3">
                    <div className="mx-auto w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">3</div>
                    <p className="mt-2 font-semibold">Scale</p>
                    <p className="text-xs text-slate-500">Drive growth via partnerships & word of mouth</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-16 text-xl font-semibold gradient-text">Thank you.</p>
          </div>
        </section>

        <Script id="progress-bar-script" strategy="afterInteractive">{`
          document.addEventListener('scroll', () => {
            const progressBar = document.getElementById('progressBar');
            const totalHeight = document.body.scrollHeight - window.innerHeight;
            if (totalHeight > 0 && progressBar) {
              const progress = (window.scrollY / totalHeight) * 100;
              progressBar.style.width = progress + '%';
            }
          });
        `}</Script>
      </div>
    </>
  );
}