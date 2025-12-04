'use client';
import { useState, useEffect, useRef } from 'react';

export default function ChatPage() {
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WEBSOCKET_URL!);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chunk') {
          // Lambda sends data.data, not data.content
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            
            if (lastMessage && lastMessage.role === 'assistant') {
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: lastMessage.content + data.data
              };
            } else {
              newMessages.push({ role: 'assistant', content: data.data });
            }
            return newMessages;
          });
        } else if (data.type === 'complete') {
          console.log('Stream completed');
        } else if (data.type === 'error') {
          console.error('Error from server:', data.message);
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Error: ${data.message}` 
          }]);
        }
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;

    setMessages(prev => [...prev, { role: 'user', content: input }]);

    wsRef.current.send(JSON.stringify({
      action: 'sendMessage',
      message: input
    }));

    setInput('');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <p>WebSocket: {isConnected ? 'Connected ✓' : 'Disconnected ✗'}</p>
      <hr />

      <div style={{ 
        border: '1px solid #ccc', 
        height: '500px', 
        overflowY: 'auto', 
        padding: '10px',
        marginBottom: '10px'
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '15px' }}>
            <strong>{msg.role === 'user' ? 'You' : 'Claude'}:</strong>
            <div style={{ 
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              marginTop: '5px'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ccc'
          }}
        />
        <button 
          onClick={sendMessage}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}