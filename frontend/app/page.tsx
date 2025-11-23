'use client';

import { useState, useEffect, useRef } from 'react';

export default function ChatPage() {
  // Array holding user and model messages
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WEBSOCKET_URL!);
    
    ws.onopen = () => {
      setIsConnected(true);
    };
    
    // When the model sends us a message
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // If its a text chunk add it to our messages array
      if (data.type === 'chunk') {
        setMessages(prev => {
          // Copy existing message array
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          
          // Don't start a new message from model if the last message came from model
          if (lastMessage && lastMessage.role === 'assistant') {
            newMessages[newMessages.length - 1] = {
              ...lastMessage,
              content: lastMessage.content + data.content
            };
          } else {
            // Create a new message and push it to the message array
            newMessages.push({ role: 'assistant', content: data.content });
          }
          
          return newMessages;
        });
      }
    };
    
    ws.onclose = () => {
      setIsConnected(false);
    };
    
    // Store the WebSocket in ref
    wsRef.current = ws;
    
    return () => {
      ws.close();
    };
  }, []);

  // When user sends a message
  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;
    
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    
    // Send message through Websocket to API gateway
    wsRef.current.send(JSON.stringify({
      // This action field routes to the sendMessage Lambda in the backend
      action: 'sendMessage',
      message: input
    }));
    
    // Clear the input box
    setInput('');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <p>WebSocket: {isConnected ? 'Connected ✓' : 'Disconnected ✗'}</p>
      <hr />
      
      {/* Chat window */}
      <div style={{ 
        border: '1px solid #ccc', 
        height: '500px', 
        overflowY: 'scroll', 
        padding: '10px',
        marginBottom: '10px'
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '15px' }}>
            <strong>{msg.role === 'user' ? 'You' : 'Claude'}:</strong>
            <div>{msg.content}</div>
          </div>
        ))}
      </div>
      
      {/* Input area */}
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