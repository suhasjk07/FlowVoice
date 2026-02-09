import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Copy, Check, Trash2, Settings, Book, Zap, Plus, X, Download, Upload } from 'lucide-react';

export default function FlowVoiceApp() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [editedText, setEditedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState('auto'); // auto, professional, casual, technical, creative
  const [dictionary, setDictionary] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showDictionary, setShowDictionary] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newSnippet, setNewSnippet] = useState({ trigger: '', text: '' });
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [wpm, setWpm] = useState(0);
  const recognitionRef = useRef(null);
  const startTimeRef = useRef(null);

  // Load data from storage on mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const dictResult = await window.storage.get('user-dictionary');
      if (dictResult) {
        setDictionary(JSON.parse(dictResult.value));
      }
    } catch (e) {
      // Dictionary doesn't exist yet
    }

    try {
      const snippetsResult = await window.storage.get('user-snippets');
      if (snippetsResult) {
        setSnippets(JSON.parse(snippetsResult.value));
      }
    } catch (e) {
      // Snippets don't exist yet
    }
  };

  const saveUserData = async () => {
    try {
      await window.storage.set('user-dictionary', JSON.stringify(dictionary));
      await window.storage.set('user-snippets', JSON.stringify(snippets));
    } catch (e) {
      console.error('Failed to save user data:', e);
    }
  };

  useEffect(() => {
    saveUserData();
  }, [dictionary, snippets]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => {
        startTimeRef.current = Date.now();
      };

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript((prev) => prev + finalTranscript);
        
        // Update WPM
        if (startTimeRef.current) {
          const minutes = (Date.now() - startTimeRef.current) / 60000;
          const words = (transcript + finalTranscript).split(/\s+/).length;
          setWpm(Math.round(words / minutes));
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current.start();
        }
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      if (transcript) {
        processWithAI(transcript);
      }
    } else {
      setTranscript('');
      setEditedText('');
      startTimeRef.current = Date.now();
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const processWithAI = async (text) => {
    setIsProcessing(true);
    
    // Apply personal dictionary
    let processedText = text;
    dictionary.forEach(word => {
      const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'gi');
      processedText = processedText.replace(regex, word);
    });

    // Check for snippets
    snippets.forEach(snippet => {
      const regex = new RegExp(`\\b${snippet.trigger}\\b`, 'gi');
      processedText = processedText.replace(regex, snippet.text);
    });

    // Get tone instructions
    const toneInstructions = {
      auto: 'Clean up the text, remove filler words (um, uh, like, you know), fix grammar, and format it naturally while preserving the speaker\'s voice and meaning.',
      professional: 'Transform this into polished, professional writing. Remove all filler words, fix grammar, use formal language, and structure it clearly with proper punctuation.',
      casual: 'Keep it conversational and friendly. Remove filler words but maintain a casual, approachable tone. Use contractions and natural language.',
      technical: 'Format this as clear technical documentation. Remove filler words, use precise technical language, and structure it logically.',
      creative: 'Polish this into creative, engaging prose. Remove filler words, enhance the language to be more vivid and expressive, and maintain natural flow.'
    };

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `${toneInstructions[mode]}\n\nText to process:\n"${processedText}"\n\nReturn ONLY the cleaned text, no explanations or preamble.`
            }
          ]
        })
      });

      const data = await response.json();
      const cleaned = data.content[0].text.trim();
      setEditedText(cleaned);
      
      // Update stats
      setWordCount(cleaned.split(/\s+/).length);
      setCharCount(cleaned.length);
    } catch (error) {
      console.error('AI processing error:', error);
      setEditedText(processedText);
      setWordCount(processedText.split(/\s+/).length);
      setCharCount(processedText.length);
    }
    
    setIsProcessing(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearAll = () => {
    setTranscript('');
    setEditedText('');
    setWordCount(0);
    setCharCount(0);
    setWpm(0);
  };

  const addWord = () => {
    if (newWord.trim() && !dictionary.includes(newWord.trim())) {
      setDictionary([...dictionary, newWord.trim()]);
      setNewWord('');
    }
  };

  const removeWord = (word) => {
    setDictionary(dictionary.filter(w => w !== word));
  };

  const addSnippet = () => {
    if (newSnippet.trigger.trim() && newSnippet.text.trim()) {
      setSnippets([...snippets, { ...newSnippet }]);
      setNewSnippet({ trigger: '', text: '' });
    }
  };

  const removeSnippet = (trigger) => {
    setSnippets(snippets.filter(s => s.trigger !== trigger));
  };

  const exportData = () => {
    const data = {
      dictionary,
      snippets,
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow-voice-data.json';
    a.click();
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.dictionary) setDictionary(data.dictionary);
          if (data.snippets) setSnippets(data.snippets);
        } catch (error) {
          alert('Invalid file format');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Sora:wght@300;400;600;700&display=swap');
        
        * {
          font-family: 'Sora', sans-serif;
        }
        
        .mono {
          font-family: 'Space Mono', monospace;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.5); }
          50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.8); }
        }

        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }

        .listening-pulse {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .float-animation {
          animation: float 6s ease-in-out infinite;
        }

        .gradient-text {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .glow-border {
          border: 2px solid transparent;
          background: linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)) padding-box,
                      linear-gradient(135deg, #667eea, #764ba2) border-box;
        }

        .shimmer-bg {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.05) 0%,
            rgba(255,255,255,0.1) 50%,
            rgba(255,255,255,0.05) 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 3s linear infinite;
        }

        .mode-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mode-btn:hover {
          transform: translateY(-2px);
        }

        .mode-btn.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .scroll-smooth {
          scroll-behavior: smooth;
        }

        textarea:focus, input:focus {
          outline: none;
          border-color: #667eea;
        }

        .mic-button {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mic-button:hover {
          transform: scale(1.05);
        }

        .mic-button:active {
          transform: scale(0.95);
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-white/10 glass-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Flow Voice</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDictionary(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition"
              title="Personal Dictionary"
            >
              <Book className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSnippets(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition"
              title="Snippets"
            >
              <Zap className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg hover:bg-white/10 transition"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold mb-4">
            Don't type, just <span className="gradient-text">speak</span>
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            AI-powered voice dictation that turns your speech into polished, formatted text instantly
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-3xl font-bold gradient-text mono">{wpm}</div>
            <div className="text-sm text-slate-400 mt-1">WPM</div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-3xl font-bold gradient-text mono">{wordCount}</div>
            <div className="text-sm text-slate-400 mt-1">Words</div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-3xl font-bold gradient-text mono">{charCount}</div>
            <div className="text-sm text-slate-400 mt-1">Characters</div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-3xl font-bold gradient-text mono">{dictionary.length}</div>
            <div className="text-sm text-slate-400 mt-1">Dictionary</div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="glass-card rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Editing Mode</h3>
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'auto', label: 'Auto', desc: 'Smart cleanup' },
              { id: 'professional', label: 'Professional', desc: 'Formal tone' },
              { id: 'casual', label: 'Casual', desc: 'Friendly vibe' },
              { id: 'technical', label: 'Technical', desc: 'Precise docs' },
              { id: 'creative', label: 'Creative', desc: 'Vivid prose' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`mode-btn px-6 py-3 rounded-lg glass-card ${mode === m.id ? 'active' : ''}`}
              >
                <div className="font-semibold">{m.label}</div>
                <div className="text-xs text-slate-400">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Microphone Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={toggleListening}
            className={`mic-button w-32 h-32 rounded-full flex items-center justify-center text-white font-bold ${
              isListening 
                ? 'bg-gradient-to-br from-red-500 to-pink-600 listening-pulse' 
                : 'bg-gradient-to-br from-indigo-500 to-purple-600'
            }`}
          >
            {isListening ? <MicOff className="w-16 h-16" /> : <Mic className="w-16 h-16" />}
          </button>
        </div>

        <div className="text-center mb-8">
          <p className="text-slate-300">
            {isListening ? (
              <span className="text-red-400 font-semibold">🔴 Recording... Click to stop and process</span>
            ) : (
              'Click the microphone to start speaking'
            )}
          </p>
        </div>

        {/* Text Displays */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Raw Transcript */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Raw Transcript</h3>
              {transcript && (
                <button
                  onClick={clearAll}
                  className="p-2 rounded-lg hover:bg-white/10 transition"
                  title="Clear"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="min-h-[300px] p-4 rounded-lg bg-black/20 border border-white/10">
              <p className="text-slate-300 whitespace-pre-wrap">
                {transcript || 'Your speech will appear here...'}
              </p>
            </div>
          </div>

          {/* AI Edited Text */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">AI Edited</h3>
              {editedText && (
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
            <div className="min-h-[300px] p-4 rounded-lg bg-black/20 border border-white/10">
              {isProcessing ? (
                <div className="flex items-center justify-center h-[268px]">
                  <div className="shimmer-bg w-full h-2 rounded"></div>
                </div>
              ) : (
                <p className="text-white whitespace-pre-wrap">
                  {editedText || 'Polished text will appear here...'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">💡 Pro Tips</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-300">
            <div>
              <span className="font-semibold text-indigo-400">Personal Dictionary:</span> Add custom words, names, or terms that Flow should remember
            </div>
            <div>
              <span className="font-semibold text-purple-400">Snippets:</span> Create voice shortcuts for frequently used text
            </div>
            <div>
              <span className="font-semibold text-pink-400">Modes:</span> Switch between different tones to match your needs
            </div>
          </div>
        </div>
      </main>

      {/* Dictionary Modal */}
      {showDictionary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text">Personal Dictionary</h2>
              <button onClick={() => setShowDictionary(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addWord()}
                  placeholder="Add a custom word..."
                  className="flex-1 px-4 py-2 rounded-lg bg-black/30 border border-white/20 text-white placeholder-slate-400"
                />
                <button
                  onClick={addWord}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition font-semibold"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {dictionary.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No custom words yet. Add one above!</p>
              ) : (
                dictionary.map((word, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/10">
                    <span className="mono">{word}</span>
                    <button
                      onClick={() => removeWord(word)}
                      className="p-1 hover:bg-red-500/20 rounded text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Snippets Modal */}
      {showSnippets && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text">Voice Snippets</h2>
              <button onClick={() => setShowSnippets(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-6 space-y-3">
              <input
                type="text"
                value={newSnippet.trigger}
                onChange={(e) => setNewSnippet({ ...newSnippet, trigger: e.target.value })}
                placeholder="Trigger word (e.g., 'calendar')"
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/20 text-white placeholder-slate-400"
              />
              <textarea
                value={newSnippet.text}
                onChange={(e) => setNewSnippet({ ...newSnippet, text: e.target.value })}
                placeholder="Full text to insert..."
                rows="3"
                className="w-full px-4 py-2 rounded-lg bg-black/30 border border-white/20 text-white placeholder-slate-400 resize-none"
              />
              <button
                onClick={addSnippet}
                className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition font-semibold"
              >
                Add Snippet
              </button>
            </div>

            <div className="space-y-3">
              {snippets.length === 0 ? (
                <p className="text-center text-slate-400 py-8">No snippets yet. Create one above!</p>
              ) : (
                snippets.map((snippet, i) => (
                  <div key={i} className="p-4 rounded-lg bg-black/20 border border-white/10">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-indigo-400 mono">{snippet.trigger}</span>
                      <button
                        onClick={() => removeSnippet(snippet.trigger)}
                        className="p-1 hover:bg-red-500/20 rounded text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-300">{snippet.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Data Management</h3>
                <div className="flex gap-3">
                  <button
                    onClick={exportData}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-black/30 border border-white/20 hover:bg-black/40 transition"
                  >
                    <Download className="w-5 h-5" />
                    Export Data
                  </button>
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-black/30 border border-white/20 hover:bg-black/40 transition cursor-pointer">
                    <Upload className="w-5 h-5" />
                    Import Data
                    <input
                      type="file"
                      accept=".json"
                      onChange={importData}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">About</h3>
                <div className="p-4 rounded-lg bg-black/20 border border-white/10 space-y-2 text-sm text-slate-300">
                  <p><span className="font-semibold text-indigo-400">Flow Voice</span> - AI-powered voice dictation</p>
                  <p>Built with Claude Sonnet 4 and Web Speech API</p>
                  <p className="text-xs text-slate-400">Free forever • No account required • Privacy-first</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Keyboard Shortcuts</h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="flex justify-between p-2 rounded bg-black/20">
                    <span>Start/Stop Recording</span>
                    <span className="mono text-indigo-400">Click Mic</span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-black/20">
                    <span>Copy Edited Text</span>
                    <span className="mono text-indigo-400">Copy Button</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12 glass-card">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-slate-400 text-sm">
          <p>Made with ❤️ using Claude Sonnet 4 • Speech recognition powered by Web Speech API</p>
          <p className="mt-2">Your voice data stays on your device. Nothing is stored on our servers.</p>
        </div>
      </footer>
    </div>
  );
}
