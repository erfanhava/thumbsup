// DOM Elements
const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const repeatCount = document.getElementById('repeatCount');
const generateBtn = document.getElementById('generateBtn');
const copyBtn = document.getElementById('copyBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const shareBtn = document.getElementById('shareBtn');
const darkModeToggle = document.getElementById('darkModeToggle');
const charCount = document.getElementById('charCount');
const lineCount = document.getElementById('lineCount');
const wordCount = document.getElementById('wordCount');
const sepOptions = document.querySelectorAll('.sep-option');
const presetButtons = document.querySelectorAll('.preset');
const toast = document.getElementById('toast');

// Global variables
let currentSeparator = '';
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// Initialize
function init() {
    // Set dark mode if enabled
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i> Light Mode';
    }
    
    // Set active separator button
    sepOptions.forEach(btn => {
        if (btn.dataset.sep === currentSeparator) {
            btn.classList.add('active');
        }
        
        btn.addEventListener('click', () => {
            sepOptions.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSeparator = btn.dataset.sep;
            generateText();
        });
    });
    
    // Set up preset buttons
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.dataset.text;
            const count = btn.dataset.count;
            const sep = btn.dataset.sep;
            
            inputText.value = text;
            repeatCount.value = count;
            
            // Find and click the corresponding separator button
            sepOptions.forEach(sepBtn => {
                sepBtn.classList.remove('active');
                if (sepBtn.dataset.sep === sep) {
                    sepBtn.classList.add('active');
                    currentSeparator = sep;
                }
            });
            
            generateText();
        });
    });
    
    // Set up event listeners
    generateBtn.addEventListener('click', generateText);
    copyBtn.addEventListener('click', copyToClipboard);
    resetBtn.addEventListener('click', resetAll);
    downloadBtn.addEventListener('click', downloadText);
    shareBtn.addEventListener('click', shareText);
    darkModeToggle.addEventListener('click', toggleDarkMode);
    
    // Input events for real-time generation
    inputText.addEventListener('input', generateText);
    repeatCount.addEventListener('input', generateText);
    
    // Initial generation
    generateText();
}

// Generate repeated text
function generateText() {
    const text = inputText.value;
    const count = parseInt(repeatCount.value) || 1;
    
    // Validate count
    if (count > 1000) {
        repeatCount.value = 1000;
        showToast('Maximum repeat count is 1000', 'warning');
        return;
    }
    
    // Process separator (handle newlines)
    let separator = currentSeparator;
    if (separator === '\\n') separator = '\n';
    if (separator === '\\n\\n') separator = '\n\n';
    
    // Generate repeated text
    const repeatedText = Array(count).fill(text).join(separator);
    outputText.value = repeatedText;
    
    // Update statistics
    updateStats(repeatedText);
}

// Update statistics
function updateStats(text) {
    const chars = text.length;
    const lines = text.split('\n').length;
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    charCount.textContent = `Characters: ${chars.toLocaleString()}`;
    lineCount.textContent = `Lines: ${lines.toLocaleString()}`;
    wordCount.textContent = `Words: ${words.toLocaleString()}`;
}

// Copy to clipboard
async function copyToClipboard() {
    try {
        await navigator.clipboard.writeText(outputText.value);
        showToast('Text copied to clipboard!');
    } catch (err) {
        // Fallback for older browsers
        outputText.select();
        document.execCommand('copy');
        showToast('Text copied to clipboard!');
    }
}

// Reset all inputs
function resetAll() {
    inputText.value = 'Hello';
    repeatCount.value = 5;
    outputText.value = '';
    sepOptions[0].click(); // Reset to "None" separator
    updateStats('');
    showToast('All inputs reset');
}

// Download text as file
function downloadText() {
    const text = outputText.value;
    if (!text.trim()) {
        showToast('No text to download', 'warning');
        return;
    }
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repeated-text.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Text downloaded as TXT file');
}

// Share text (Web Share API or fallback)
function shareText() {
    const text = outputText.value;
    if (!text.trim()) {
        showToast('No text to share', 'warning');
        return;
    }
    
    if (navigator.share) {
        navigator.share({
            title: 'Repeated Text from Text Repeater Tool',
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            url: window.location.href
        });
    } else {
        // Fallback: Copy shareable link to clipboard
        const shareUrl = `${window.location.origin}${window.location.pathname}?text=${encodeURIComponent(inputText.value)}&repeat=${repeatCount.value}&sep=${encodeURIComponent(currentSeparator)}`;
        navigator.clipboard.writeText(shareUrl);
        showToast('Shareable link copied to clipboard!');
    }
}

// Toggle dark mode
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    
    if (isDarkMode) {
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i> Light Mode';
        localStorage.setItem('darkMode', 'true');
    } else {
        darkModeToggle.innerHTML = '<i class="fas fa-moon"></i> Dark Mode';
        localStorage.setItem('darkMode', 'false');
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = 'toast';
    toast.classList.add('show');
    
    // Different colors for different types
    if (type === 'warning') {
        toast.style.background = '#ff9e00';
    } else if (type === 'error') {
        toast.style.background = '#ff0054';
    }
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// URL parameter handling (for shareable links)
function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('text')) {
        inputText.value = decodeURIComponent(params.get('text'));
    }
    
    if (params.has('repeat')) {
        repeatCount.value = params.get('repeat');
    }
    
    if (params.has('sep')) {
        const sep = decodeURIComponent(params.get('sep'));
        sepOptions.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.sep === sep) {
                btn.classList.add('active');
                currentSeparator = sep;
            }
        });
    }
    
    // Generate if we have params
    if (params.toString()) {
        generateText();
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    handleUrlParams();
    init();
});

// PWA Support (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}