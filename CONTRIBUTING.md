# Contributing to Neuron

Thank you for your interest in contributing to Neuron! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Git
- A code editor (VS Code recommended)

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/notebooklm-.git
   cd notebooklm-
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Add your API keys to .env
   ```

3. **Set up the frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   ```

4. **Run the development servers**
   
   Terminal 1 (Backend):
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```
   
   Terminal 2 (Frontend):
   ```bash
   cd frontend
   npm run dev
   ```

## 📋 How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

**Good bug reports include:**
- Clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots (if applicable)
- Environment details (OS, Python/Node version)
- Error messages and logs

### Suggesting Features

Feature requests are welcome! Please:
- Use a clear, descriptive title
- Provide detailed description of the feature
- Explain why this feature would be useful
- Include mockups or examples if possible

### Pull Requests

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

3. **Test your changes**
   - Ensure backend starts without errors
   - Test frontend functionality
   - Check for console errors
   - Test edge cases

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add feature: description of your changes"
   ```
   
   **Commit message guidelines:**
   - Use present tense ("Add feature" not "Added feature")
   - Be descriptive but concise
   - Reference issues if applicable (#123)

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then open a Pull Request on GitHub.

## 🎨 Code Style

### Python (Backend)

- Follow PEP 8 style guide
- Use type hints where possible
- Maximum line length: 100 characters
- Use meaningful variable names
- Add docstrings to functions and classes

**Example:**
```python
async def ingest_document(
    content: bytes,
    filename: str,
    user_id: str = "default"
) -> tuple[str, int]:
    """
    Ingest a document into the vector store.
    
    Args:
        content: File content as bytes
        filename: Original filename
        user_id: User ID for data isolation
        
    Returns:
        tuple: (source_id, number_of_chunks)
    """
    # Implementation
    pass
```

### TypeScript/React (Frontend)

- Use TypeScript for type safety
- Follow React best practices
- Use functional components with hooks
- Keep components small and focused
- Use meaningful component and variable names

**Example:**
```typescript
interface MessageProps {
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

export default function Message({ content, role, timestamp }: MessageProps) {
  return (
    <div className={`message ${role}`}>
      {/* Component JSX */}
    </div>
  )
}
```

## 🧪 Testing

Currently, there are no automated tests. When adding new features:

1. **Manual testing checklist:**
   - Test happy path (expected usage)
   - Test edge cases (empty inputs, large files, etc.)
   - Test error handling
   - Test on different browsers (for frontend)
   - Check console for errors

2. **Backend testing:**
   - Test API endpoints with curl or Postman
   - Check logs for errors
   - Verify database operations

3. **Frontend testing:**
   - Test UI interactions
   - Check responsive design
   - Test keyboard shortcuts
   - Verify error messages display correctly

## 📦 Areas for Contribution

### High Priority

- [ ] Add automated tests (pytest for backend, Jest for frontend)
- [ ] Improve error messages and user feedback
- [ ] Add more LLM provider integrations
- [ ] Improve mobile responsiveness
- [ ] Add document preview feature
- [ ] Implement semantic chunking

### Medium Priority

- [ ] Add user authentication system
- [ ] Implement conversation search
- [ ] Add more export formats
- [ ] Improve citation display
- [ ] Add keyboard shortcut customization
- [ ] Implement conversation folders/tags

### Low Priority

- [ ] Add dark mode customization
- [ ] Implement conversation sharing
- [ ] Add voice input support
- [ ] Create browser extension
- [ ] Add multilingual support

## 🐛 Debugging Tips

### Backend Issues

1. **Check logs** - Look for Python tracebacks
2. **Verify environment** - Ensure all API keys are set
3. **Test endpoints** - Use `/docs` for interactive API testing
4. **Check Qdrant** - Verify vector store connection

### Frontend Issues

1. **Check browser console** - Look for JavaScript errors
2. **Check network tab** - Verify API calls are successful
3. **Clear cache** - Sometimes helps with build issues
4. **Check environment** - Verify `NEXT_PUBLIC_API_URL` is correct

## 📚 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 💬 Communication

- **Issues** - For bug reports and feature requests
- **Pull Requests** - For code contributions
- **Discussions** - For questions and general discussion

## ⚖️ Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Neuron! 🎉
