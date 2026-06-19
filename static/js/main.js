// State Management
let appState = {
    activeCategory: 'all',
    papers: [],
    selectedPaper: null,
    geminiApiKey: ''
};

// DOM Elements
const elements = {
    btnSettings: document.getElementById('btn-settings'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnCancelSettings: document.getElementById('btn-cancel-settings'),
    btnClearKey: document.getElementById('btn-clear-key'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
    btnBannerSettings: document.getElementById('btn-banner-settings'),
    btnGenerateTweet: document.getElementById('btn-generate-tweet'),
    btnCopyTweet: document.getElementById('btn-copy-tweet'),
    btnShareTweet: document.getElementById('btn-share-tweet'),
    
    settingsModal: document.getElementById('settings-modal'),
    apiAlert: document.getElementById('api-alert'),
    keyInput: document.getElementById('gemini-key-input'),
    papersContainer: document.getElementById('papers-list-container'),
    paperCount: document.getElementById('paper-count'),
    
    inspectorPlaceholder: document.getElementById('inspector-placeholder'),
    inspectorContent: document.getElementById('inspector-content'),
    inspCategoryBadge: document.getElementById('insp-category-badge'),
    inspArxivLink: document.getElementById('insp-arxiv-link'),
    inspPdfLink: document.getElementById('insp-pdf-link'),
    inspTitle: document.getElementById('insp-title'),
    inspAuthors: document.getElementById('insp-authors'),
    inspDate: document.getElementById('insp-date'),
    inspId: document.getElementById('insp-id'),
    inspAbstract: document.getElementById('insp-abstract'),
    
    tweetResultBox: document.getElementById('tweet-result-box'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    tweetLoader: document.getElementById('tweet-loader'),
    charCount: document.getElementById('char-count'),
    
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadApiKey();
    setupEventListeners();
    fetchPapers(appState.activeCategory);
});

// Load API Key from localStorage
function loadApiKey() {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        appState.geminiApiKey = savedKey;
        elements.apiAlert.classList.add('hidden');
    } else {
        appState.geminiApiKey = '';
        elements.apiAlert.classList.remove('hidden');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Refresh button
    elements.btnRefresh.addEventListener('click', () => {
        fetchPapers(appState.activeState || appState.activeCategory);
    });

    // Modal open/close
    elements.btnSettings.addEventListener('click', () => toggleModal(true));
    elements.btnBannerSettings.addEventListener('click', () => toggleModal(true));
    elements.btnCloseModal.addEventListener('click', () => toggleModal(false));
    elements.btnCancelSettings.addEventListener('click', () => toggleModal(false));
    
    // Close modal on clicking outside
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            toggleModal(false);
        }
    });

    // Save/Clear settings
    elements.btnSaveSettings.addEventListener('click', saveSettings);
    elements.btnClearKey.addEventListener('click', clearSettings);

    // Toggle API key password visibility
    elements.btnToggleKeyVisibility.addEventListener('click', toggleKeyVisibility);

    // Category selection (delegated)
    document.querySelector('.categories-grid').addEventListener('click', (e) => {
        const pill = e.target.closest('.category-pill');
        if (!pill) return;
        
        // Update active pill UI
        document.querySelectorAll('.category-pill').forEach(btn => btn.classList.remove('active'));
        pill.classList.add('active');
        
        const category = pill.dataset.category;
        appState.activeCategory = category;
        fetchPapers(category);
    });

    // Generate Tweet Button
    elements.btnGenerateTweet.addEventListener('click', requestTweetSummary);

    // Copy Tweet Button
    elements.btnCopyTweet.addEventListener('click', copyTweetText);

    // Character counter for tweet textarea
    elements.tweetTextarea.addEventListener('input', updateCharCount);
}

// Toggle settings modal
function toggleModal(show) {
    if (show) {
        elements.keyInput.value = appState.geminiApiKey;
        elements.settingsModal.classList.remove('hidden');
    } else {
        elements.settingsModal.classList.add('hidden');
    }
}

// Toggle key character visibility
function toggleKeyVisibility() {
    const icon = elements.btnToggleKeyVisibility.querySelector('i');
    if (elements.keyInput.type === 'password') {
        elements.keyInput.type = 'text';
        icon.classList.replace('fa-regular', 'fa-solid');
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        elements.keyInput.type = 'password';
        icon.classList.replace('fa-solid', 'fa-regular');
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// Save settings to LocalStorage
function saveSettings() {
    const key = elements.keyInput.value.trim();
    if (!key) {
        showToast('Please enter a valid key or cancel.', 'error');
        return;
    }
    
    localStorage.setItem('gemini_api_key', key);
    appState.geminiApiKey = key;
    elements.apiAlert.classList.add('hidden');
    toggleModal(false);
    showToast('Gemini API key saved successfully!', 'success');
}

// Clear API key settings
function clearSettings() {
    localStorage.removeItem('gemini_api_key');
    appState.geminiApiKey = '';
    elements.keyInput.value = '';
    elements.apiAlert.classList.remove('hidden');
    toggleModal(false);
    showToast('API key removed. Running in demo mode.', 'warning');
}

// Fetch papers from Flask API
function fetchPapers(category) {
    // Show spinner in refresh button
    const refreshIcon = elements.btnRefresh.querySelector('i');
    refreshIcon.classList.add('rotating');
    elements.btnRefresh.disabled = true;

    // Show skeletons
    elements.papersContainer.innerHTML = `
        <div class="skeleton-loader">
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        </div>
    `;

    fetch(`/api/papers?category=${category}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                appState.papers = data.papers;
                renderPapers();
            } else {
                elements.papersContainer.innerHTML = `
                    <div class="placeholder-card glass-card">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: var(--danger);"></i>
                        <h3>Failed to load papers</h3>
                        <p>${data.error || 'Unknown error occurred while fetching arXiv papers.'}</p>
                        <button class="btn btn-secondary btn-sm" onclick="location.reload()">Retry</button>
                    </div>
                `;
            }
        })
        .catch(err => {
            console.error('Error fetching papers:', err);
            elements.papersContainer.innerHTML = `
                <div class="placeholder-card glass-card">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; color: var(--danger);"></i>
                    <h3>Network Error</h3>
                    <p>Could not connect to the Flask server. Please make sure the app is running.</p>
                </div>
            `;
        })
        .finally(() => {
            refreshIcon.classList.remove('rotating');
            elements.btnRefresh.disabled = false;
        });
}

// Render papers list
function renderPapers() {
    elements.paperCount.textContent = appState.papers.length;
    
    if (appState.papers.length === 0) {
        elements.papersContainer.innerHTML = `
            <div class="placeholder-card glass-card">
                <i class="fa-solid fa-inbox" style="font-size: 2.5rem; color: var(--text-muted);"></i>
                <h3>No papers found</h3>
                <p>No recent papers match the selected category in this query window.</p>
            </div>
        `;
        return;
    }

    elements.papersContainer.innerHTML = '';
    
    appState.papers.forEach(paper => {
        const publishedDate = new Date(paper.published);
        const formattedDate = publishedDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        const card = document.createElement('article');
        card.className = `paper-card glass-card ${appState.selectedPaper && appState.selectedPaper.id === paper.id ? 'selected' : ''}`;
        card.dataset.id = paper.id;
        
        card.innerHTML = `
            <div class="paper-card-header">
                <h3 class="paper-card-title">${escapeHTML(paper.title)}</h3>
                <span class="paper-date-badge">${formattedDate}</span>
            </div>
            <p class="paper-authors">By ${escapeHTML(paper.authors.slice(0, 3).join(', '))}${paper.authors.length > 3 ? ' et al.' : ''}</p>
            <p class="paper-abstract-preview">${escapeHTML(paper.summary)}</p>
            <div class="paper-card-footer">
                <span class="paper-tag">${paper.id.split('v')[0]}</span>
                <span class="paper-action-hint">Analyze <i class="fa-solid fa-arrow-right"></i></span>
            </div>
        `;
        
        card.addEventListener('click', () => selectPaper(paper.id));
        elements.papersContainer.appendChild(card);
    });
}

// Select a paper and display details in Inspector Panel
function selectPaper(paperId) {
    const paper = appState.papers.find(p => p.id === paperId);
    if (!paper) return;

    appState.selectedPaper = paper;
    
    // Highlight paper card in left column
    document.querySelectorAll('.paper-card').forEach(card => {
        if (card.dataset.id === paperId) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    // Populate Inspector fields
    const publishedDate = new Date(paper.published);
    const formattedDate = publishedDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    elements.inspTitle.textContent = paper.title;
    elements.inspAuthors.textContent = `By ${paper.authors.join(', ')}`;
    elements.inspDate.textContent = formattedDate;
    elements.inspId.textContent = paper.id;
    elements.inspAbstract.textContent = paper.summary;
    
    elements.inspArxivLink.href = paper.url;
    elements.inspPdfLink.href = paper.pdf_url;
    
    // Determine and set category badge label
    let badgeText = 'cs.AI';
    if (paper.id.includes('/')) badgeText = 'arXiv';
    elements.inspCategoryBadge.textContent = badgeText;
    
    // Clear previous tweet generator states
    elements.tweetResultBox.classList.add('hidden');
    elements.tweetLoader.classList.add('hidden');
    elements.btnGenerateTweet.classList.remove('hidden');

    // Show Inspector Panel
    elements.inspectorPlaceholder.classList.add('hidden');
    elements.inspectorContent.classList.remove('hidden');
}

// Request Tweet Summary from Server (or use beautiful client demo fallback if no API key configured)
function requestTweetSummary() {
    if (!appState.selectedPaper) return;
    
    const paper = appState.selectedPaper;
    
    // Hide generate button, show loader
    elements.btnGenerateTweet.classList.add('hidden');
    elements.tweetLoader.classList.remove('hidden');
    elements.tweetResultBox.classList.add('hidden');

    // Check if API key is missing. If missing, generate a highly-polished local template-based tweet so the interface is testable.
    if (!appState.geminiApiKey) {
        // Run a simulated loading delay of 1.2s to mimic API call and show off the loader animation
        setTimeout(() => {
            const authorsList = paper.authors[0] + (paper.authors.length > 1 ? ' et al.' : '');
            
            // Clean up title for tweet (truncate if too long)
            let tweetTitle = paper.title;
            if (tweetTitle.length > 100) {
                tweetTitle = tweetTitle.substring(0, 97) + '...';
            }
            
            // Extract a neat preview of what paper does from abstract (first sentence or core keywords)
            let coreIdea = "presents a new framework in AI research";
            const firstSentence = paper.summary.split('.')[0];
            if (firstSentence && firstSentence.length > 30 && firstSentence.length < 130) {
                coreIdea = firstSentence.trim();
            } else if (firstSentence && firstSentence.length >= 130) {
                coreIdea = firstSentence.substring(0, 110).trim() + '...';
            }
            
            const hashtags = appState.activeCategory === 'ml' ? '#MachineLearning #AI' :
                             appState.activeCategory === 'nlp' ? '#NLProc #AI' :
                             appState.activeCategory === 'cv' ? '#ComputerVision #AI' :
                             appState.activeCategory === 'robotics' ? '#Robotics #AI' : '#AI #Research';
                             
            const mockTweet = `📝 New paper alert: "${tweetTitle}" by ${authorsList}.\n\nThis work ${coreIdea.toLowerCase().startsWith('this') ? coreIdea.substring(5) : coreIdea}.\n\nCheck out the full paper here: ${paper.url} ${hashtags}\n\n[⚠️ Configure Gemini API Key for AI Summaries]`;
            
            displayTweetResult(mockTweet);
            showToast('Generated client-side demo summary. Add API key for Gemini.', 'info');
        }, 1200);
        return;
    }

    // Call real Flask API using configured API Key
    fetch('/api/summarize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Gemini-API-Key': appState.geminiApiKey
        },
        body: JSON.stringify({
            title: paper.title,
            abstract: paper.summary,
            authors: paper.authors
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displayTweetResult(data.tweet);
            showToast('AI tweet summary generated!', 'success');
        } else {
            // Restore generate button
            elements.btnGenerateTweet.classList.remove('hidden');
            showToast(data.error || 'Failed to generate summary.', 'error');
        }
    })
    .catch(err => {
        console.error('Error generating summary:', err);
        elements.btnGenerateTweet.classList.remove('hidden');
        showToast('Network error generating tweet summary.', 'error');
    })
    .finally(() => {
        elements.tweetLoader.classList.add('hidden');
    });
}

// Display tweet result and configure share URL
function displayTweetResult(tweetText) {
    elements.tweetTextarea.value = tweetText;
    updateCharCount();
    
    // Setup Twitter Share URL
    const tweetIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    elements.btnShareTweet.href = tweetIntentUrl;
    
    elements.tweetResultBox.classList.remove('hidden');
}

// Copy Tweet text to Clipboard
function copyTweetText() {
    const text = elements.tweetTextarea.value;
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('Copied to clipboard!', 'success');
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
            showToast('Failed to copy text.', 'error');
        });
}

// Update text area character counter
function updateCharCount() {
    const length = elements.tweetTextarea.value.length;
    elements.charCount.textContent = length;
    
    if (length > 280) {
        elements.charCount.style.color = 'var(--danger)';
        elements.btnShareTweet.style.pointerEvents = 'none';
        elements.btnShareTweet.style.opacity = '0.5';
    } else {
        elements.charCount.style.color = 'var(--text-muted)';
        elements.btnShareTweet.style.pointerEvents = 'auto';
        elements.btnShareTweet.style.opacity = '1';
    }
}

// Helper to show modern visual toast
function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    
    // Configure icons and borders based on alert type
    const icon = elements.toast.querySelector('.toast-icon');
    icon.className = 'toast-icon fa-solid';
    
    if (type === 'success') {
        icon.classList.add('fa-circle-check');
        elements.toast.style.borderColor = 'var(--success)';
        icon.style.color = 'var(--success)';
    } else if (type === 'error') {
        icon.classList.add('fa-triangle-exclamation');
        elements.toast.style.borderColor = 'var(--danger)';
        icon.style.color = 'var(--danger)';
    } else if (type === 'warning') {
        icon.classList.add('fa-circle-exclamation');
        elements.toast.style.borderColor = 'var(--warning)';
        icon.style.color = 'var(--warning)';
    } else {
        icon.classList.add('fa-circle-info');
        elements.toast.style.borderColor = 'var(--cyan)';
        icon.style.color = 'var(--cyan)';
    }
    
    // Slide in
    elements.toast.classList.remove('hidden');
    
    // Clear previous timeout if user clicks rapidly
    if (elements.toastTimeout) {
        clearTimeout(elements.toastTimeout);
    }
    
    // Slide out after 3.5 seconds
    elements.toastTimeout = setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3500);
}

// Escape HTML utility to prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
