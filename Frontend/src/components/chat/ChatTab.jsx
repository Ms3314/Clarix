import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

const ChatTab = ({ chatMessages, chatInput, setChatInput, chatLoading, onSendMessage }) => {
  return (
    <div className="h-[500px] flex flex-col" style={{ background: '#0d0d0d', borderRadius: '14px', overflow: 'hidden', border: '1px solid #333333' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #333333', background: '#0d0d0d' }}>
        <h2 className="text-lg font-semibold" style={{ color: '#f0f0f0' }}>Chat with Resources</h2>
        <p className="text-sm" style={{ color: '#888888' }}>Ask questions about your uploaded documents</p>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {chatMessages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666666' }}>
            <div style={{ fontSize: '3rem', opacity: 0.4 }}>📄</div>
            <p style={{ marginTop: '16px' }}>Ask questions about your uploaded resources</p>
            <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>The AI will answer based on your PDFs</p>
          </div>
        )}
        
        {chatMessages.map((msg, idx) => (
          <div key={idx} style={{ 
            display: 'flex', 
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            animation: 'msgIn 0.25s ease'
          }}>
            <div style={{ 
              maxWidth: '65%', 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              {msg.role === 'assistant' && (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#666666', marginBottom: '3px', paddingLeft: '4px' }}>AI</span>
              )}
              <div style={{ 
                padding: '10px 15px', 
                borderRadius: '18px', 
                fontSize: '0.9rem', 
                lineHeight: 1.5,
                wordBreak: 'break-word',
                ...(msg.role === 'user' 
                  ? { background: '#ffffff', color: '#000000', borderBottomRightRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }
                  : { background: '#2a2a2a', color: '#f0f0f0', borderBottomLeftRadius: '4px', border: '1px solid #444444' }
                )
              }}>
                {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
              </div>
            </div>
          </div>
        ))}
        
        {chatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ background: '#2a2a2a', padding: '10px 15px', borderRadius: '18px', borderBottomLeftRadius: '4px', border: '1px solid #444444' }}>
              <span style={{ color: '#888888' }}>Thinking...</span>
            </div>
          </div>
        )}
      </div>
      
      <div style={{ padding: '16px 24px', borderTop: '1px solid #333333', background: '#0d0d0d' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#1a1a1a', border: '1px solid #444444', borderRadius: '14px', padding: '8px 12px 8px 18px' }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !chatLoading) onSendMessage() }}
            placeholder="Ask a question about your resources..."
            disabled={chatLoading}
            style={{ 
              flex: 1, 
              background: 'none', 
              border: 'none', 
              outline: 'none', 
              color: '#f0f0f0', 
              fontFamily: "'DM Sans', sans-serif", 
              fontSize: '0.9rem' 
            }}
          />
          <button 
            onClick={onSendMessage}
            disabled={chatLoading || !chatInput.trim()}
            style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '10px', 
              border: 'none', 
              background: chatInput.trim() ? '#ffffff' : '#333333', 
              color: '#000000', 
              cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatTab