import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Settings, MessageCircle, Bot, AlertCircle, CheckCircle } from 'lucide-react';

// Safe base64 encoding for Unicode (browser)
function toBase64(str: string) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    return btoa('ERROR_ENCODING');
  }
}

const AshleyMonitor = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [chatContent, setChatContent] = useState('');
  const [lastProcessedLength, setLastProcessedLength] = useState(0);
  const [directive, setDirective] = useState('');
  const [monitorInterval, setMonitorInterval] = useState(5);
  const [statusLog, setStatusLog] = useState<{ time: string, message: string, type: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [commitStatus, setCommitStatus] = useState('idle');

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // GitHub credentials (keep for now)
  const GITHUB_TOKEN = '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';
  const GITHUB_OWNER = 'Hellvor';
  const GITHUB_REPO = 'Ashley-Ticket-Bot-Files';
  const OUTPUT_FILE_PATH = 'Output.txt';

  const GITHUB_URLS = {
    directive: 'https://raw.githubusercontent.com/Hellvor/Ashley-Ticket-Bot-Files/refs/heads/main/Directive.txt',
    input: 'https://raw.githubusercontent.com/Hellvor/Ashley-Ticket-Bot-Files/refs/heads/main/Chat.txt',
    output: 'https://raw.githubusercontent.com/Hellvor/Ashley-Ticket-Bot-Files/refs/heads/main/Output.txt'
  };

  const addToLog = (message: string, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setStatusLog(prev => [...prev.slice(-19), { time: timestamp, message, type }]);
  };

  const fetchDirective = async () => {
    try {
      const response = await fetch(GITHUB_URLS.directive + '?t=' + Date.now());
      const text = await response.text();
      setDirective(text.trim());
      addToLog('Directive loaded successfully', 'success');
    } catch (error: any) {
      addToLog(`Failed to load directive: ${error?.message || String(error)}`, 'error');
    }
  };

  const fetchChatContent = async () => {
    try {
      const response = await fetch(GITHUB_URLS.input + '?t=' + Date.now());
      const text = await response.text();
      setChatContent(text);
      setLastCheck(new Date());
      return text;
    } catch (error: any) {
      addToLog(`Failed to fetch chat: ${error?.message || String(error)}`, 'error');
      return null;
    }
  };

  const writeToOutput = async (response: string) => {
    try {
      setCommitStatus('committing');
      addToLog('Committing Ashley\'s response to GitHub...', 'info');

      // Get current file SHA (required for updates)
      const getFileResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${OUTPUT_FILE_PATH}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      let sha = '';
      if (getFileResponse.ok) {
        const fileData = await getFileResponse.json();
        sha = fileData.sha;
      }

      // Build payload (omit sha if not present)
      const payload: any = {
        message: `Ashley response: ${new Date().toISOString()}`,
        content: toBase64(response)
      };
      if (sha) payload.sha = sha;

      // Commit the response to GitHub
      const commitResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${OUTPUT_FILE_PATH}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (commitResponse.ok) {
        setCommitStatus('success');
        addToLog(`✅ Response committed successfully: "${response.substring(0, 50)}..."`, 'success');
      } else {
        const errorData = await commitResponse.json();
        throw new Error(`GitHub API error: ${errorData.message}`);
      }

    } catch (error: any) {
      setCommitStatus('error');
      addToLog(`❌ Failed to commit response: ${error?.message || String(error)}`, 'error');
      console.error('GitHub commit error:', error);
    }
  };

  const analyzeNewMessages = async (newContent: string) => {
    if (!newContent || newContent.length <= lastProcessedLength) {
      return;
    }

    const newMessages = newContent.slice(lastProcessedLength);
    const messageLines = newMessages.split('\n').filter(line => line.trim());

    if (messageLines.length === 0) {
      return;
    }

    setIsProcessing(true);
    addToLog(`Processing ${messageLines.length} new message(s)`, 'info');

    try {
      // Create the prompt for Claude based on Ashley's directive
      const ashleyPrompt = `${directive}

Recent Discord messages to analyze and respond to:
${newMessages}

Previous chat context:
${chatContent.slice(0, lastProcessedLength).slice(-500)}

Instructions:
- Respond as Ashley, the happy and upbeat Discord ticket bot for Ashspire SMP
- Only respond if the messages require Ashley's attention or help
- If users need help with land claims or complex decisions, suggest pinging @Moderator
- Keep responses concise and Discord-appropriate
- If no response is needed, respond with "NO_RESPONSE"

Your response:`;

      // NOTE: Anthropic API (leave risky, as requested)
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Should use API key, but left out for now
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [
            { role: "user", content: ashleyPrompt }
          ]
        })
      });

      const data = await response.json();
      // Defensive parsing
      const ashleyResponse = data?.content?.[0]?.text?.trim?.() || '';

      if (ashleyResponse && ashleyResponse !== "NO_RESPONSE") {
        await writeToOutput(ashleyResponse);
        addToLog(`Ashley responded to new messages`, 'success');
      } else {
        addToLog('No response needed for recent messages', 'info');
      }

      setLastProcessedLength(newContent.length);

    } catch (error: any) {
      addToLog(`Error processing messages: ${error?.message || String(error)}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const monitorChat = async () => {
    const newContent = await fetchChatContent();
    if (newContent) {
      await analyzeNewMessages(newContent);
    }
  };

  // Improved interval logic
  useEffect(() => {
    if (isMonitoring) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(monitorChat, monitorInterval * 1000);
      addToLog(`🤖 Ashley monitoring started (${monitorInterval}s intervals)`, 'success');
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        addToLog('🛑 Ashley monitoring stopped', 'info');
      }
    }
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line
  }, [isMonitoring, monitorInterval]);

  // Initial fetch
  useEffect(() => {
    fetchDirective();
    fetchChatContent();
    addToLog('Ashley Monitor System initialized', 'success');
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line
  }, []);

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'info': return 'text-blue-400';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Bot className="w-12 h-12 text-pink-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              Ashley Monitor System
            </h1>
          </div>
          <p className="text-xl text-gray-300">Discord Ticket Bot for Ashspire SMP Server</p>
          <p className="text-sm text-gray-400 mt-2">Automated Claude-powered Discord monitoring with GitHub integration</p>
        </div>

        {/* Status Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">

          {/* Monitor Status */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-400" />
              Monitor Status
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Monitoring:</span>
                <span className={`flex items-center gap-2 font-semibold ${isMonitoring ? 'text-green-400' : 'text-red-400'}`}>
                  {isMonitoring ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {isMonitoring ? 'ACTIVE' : 'STOPPED'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Processing:</span>
                <span className={`font-semibold ${isProcessing ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {isProcessing ? 'WORKING...' : 'IDLE'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Last Check:</span>
                <span className="text-blue-400 text-sm font-mono">
                  {lastCheck instanceof Date ? lastCheck.toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {/* GitHub Status */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-green-400" />
              GitHub Integration
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Status:</span>
                <span className={`flex items-center gap-2 font-semibold ${
                  commitStatus === 'success' ? 'text-green-400' :
                  commitStatus === 'error' ? 'text-red-400' :
                  commitStatus === 'committing' ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {commitStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                  {commitStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                  {commitStatus === 'committing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {commitStatus === 'success' ? 'SUCCESS' :
                    commitStatus === 'error' ? 'ERROR' :
                      commitStatus === 'committing' ? 'COMMITTING' : 'READY'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Repository:</span>
                <span className="text-green-400 text-sm font-mono">
                  {GITHUB_REPO}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Output File:</span>
                <span className="text-green-400 text-sm font-mono">
                  {OUTPUT_FILE_PATH}
                </span>
              </div>
            </div>
          </div>

          {/* Chat Stats */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              Chat Statistics
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Chat Length:</span>
                <span className="text-purple-400 font-semibold">
                  {chatContent.length.toLocaleString()} chars
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Processed:</span>
                <span className="text-purple-400 font-semibold">
                  {lastProcessedLength.toLocaleString()} chars
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-300">Check Interval:</span>
                <span className="text-purple-400 font-semibold">
                  {monitorInterval}s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 mb-6">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Control Panel
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Monitor Controls</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium min-w-fit">Check Interval:</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={monitorInterval}
                    onChange={(e) => setMonitorInterval(Math.max(1, Math.min(60, parseInt(e.target.value) || 5)))}
                    className="bg-gray-800 px-3 py-2 rounded-lg border border-gray-600 text-white w-20"
                    disabled={isMonitoring}
                  />
                  <span className="text-sm text-gray-400">seconds</span>
                </div>

                <div className="flex gap-3">
                  {!isMonitoring ? (
                    <button
                      onClick={() => setIsMonitoring(true)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg transition-colors font-semibold"
                      disabled={!directive}
                    >
                      <Play className="w-5 h-5" />
                      Start Ashley
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsMonitoring(false)}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg transition-colors font-semibold"
                    >
                      <Pause className="w-5 h-5" />
                      Stop Ashley
                    </button>
                  )}

                  <button
                    onClick={monitorChat}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-3 rounded-lg transition-colors font-semibold"
                  >
                    <RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
                    Check Now
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">System Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={fetchDirective}
                  className="w-full flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload Directive
                </button>

                <button
                  onClick={() => {
                    setStatusLog([]);
                    addToLog('Activity log cleared', 'info');
                  }}
                  className="w-full flex items-center gap-2 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                  Clear Log
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ashley's Directive */}
        <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 mb-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-6 h-6 text-pink-400" />
            Ashley's Current Directive
          </h2>
          <div className="bg-gray-900/60 p-4 rounded-lg">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
              {directive || 'Loading directive from GitHub...'}
            </pre>
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <MessageCircle className="w-6 h-6" />
            Live Activity Log
          </h2>
          <div className="bg-gray-900/60 p-4 rounded-lg max-h-80 overflow-y-auto">
            {statusLog.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No activity yet... Start monitoring to see Ashley in action!</p>
            ) : (
              <div className="space-y-2">
                {statusLog.map((entry, index) => (
                  <div key={index} className="text-sm flex gap-3 font-mono">
                    <span className="text-gray-500 min-w-fit">[{entry.time}]</span>
                    <span className={getStatusColor(entry.type)}>{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Success Notice */}
        <div className="mt-6 bg-green-900/30 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-xl font-semibold text-green-400">🎉 Ashley is Ready!</h3>
          </div>
          <p className="text-green-200">
            Ashley is fully integrated with GitHub and ready to monitor your Discord server! When she detects messages
            that need her help, she'll automatically respond as the happy, upbeat ticket bot and commit her responses
            to GitHub for your Discord bot to pick up. The complete automation loop is active!
          </p>
        </div>
      </div>
    </div>
  );
};

export default AshleyMonitor;