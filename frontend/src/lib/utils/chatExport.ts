/**
 * Export chat conversation to markdown or text format
 */

interface Message {
  role: string;
  content: string;
}

export function exportToMarkdown(messages: Message[], sessionId: string): string {
  const timestamp = new Date().toLocaleString();
  let markdown = `# Chat Export\n\n`;
  markdown += `**Session ID:** ${sessionId}\n`;
  markdown += `**Exported:** ${timestamp}\n\n`;
  markdown += `---\n\n`;

  messages.forEach((msg, index) => {
    const role = msg.role === 'user' ? '👤 You' : '🤖 Neuron';
    markdown += `### ${role}\n\n`;
    markdown += `${msg.content}\n\n`;
    if (index < messages.length - 1) {
      markdown += `---\n\n`;
    }
  });

  return markdown;
}

export function downloadMarkdown(content: string, filename: string = 'chat-export.md') {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToText(messages: Message[], sessionId: string): string {
  const timestamp = new Date().toLocaleString();
  let text = `CHAT EXPORT\n`;
  text += `Session ID: ${sessionId}\n`;
  text += `Exported: ${timestamp}\n\n`;
  text += `${'='.repeat(60)}\n\n`;

  messages.forEach((msg, index) => {
    const role = msg.role === 'user' ? 'YOU' : 'NEURON';
    text += `${role}:\n`;
    text += `${msg.content}\n\n`;
    if (index < messages.length - 1) {
      text += `${'-'.repeat(60)}\n\n`;
    }
  });

  return text;
}

export function downloadText(content: string, filename: string = 'chat-export.txt') {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportChatHistory(sessionId: string, format: 'markdown' | 'text' = 'markdown') {
  try {
    // Fetch conversation history from API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/conversations/${sessionId}/history`);
    if (!response.ok) {
      throw new Error('Failed to fetch conversation history');
    }
    
    const data = await response.json();
    const messages = data.messages || [];
    
    if (messages.length === 0) {
      throw new Error('No messages to export');
    }

    const timestamp = new Date().toISOString().split('T')[0];
    
    if (format === 'markdown') {
      const markdown = exportToMarkdown(messages, sessionId);
      downloadMarkdown(markdown, `neuron-chat-${timestamp}.md`);
    } else {
      const text = exportToText(messages, sessionId);
      downloadText(text, `neuron-chat-${timestamp}.txt`);
    }
    
    return true;
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}
