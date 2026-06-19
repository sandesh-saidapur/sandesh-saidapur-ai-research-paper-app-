import os
import xml.etree.ElementTree as ET
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# arXiv API namespaces
NAMESPACES = {'atom': 'http://www.w3.org/2005/Atom'}

CATEGORY_MAP = {
    'all': 'cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:cs.CV OR cat:cs.RO',
    'ml': 'cat:cs.LG',
    'nlp': 'cat:cs.CL',
    'cv': 'cat:cs.CV',
    'robotics': 'cat:cs.RO',
    'ai_general': 'cat:cs.AI'
}

def clean_text(text):
    if not text:
        return ""
    # Remove newlines, double spaces, and strip whitespace
    return " ".join(text.split())

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/papers')
def get_papers():
    category_key = request.args.get('category', 'all')
    query_category = CATEGORY_MAP.get(category_key, CATEGORY_MAP['all'])
    
    # arXiv API Query Parameters
    url = f"http://export.arxiv.org/api/query?search_query={query_category}&sortBy=submittedDate&sortOrder=descending&max_results=15"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        root = ET.fromstring(response.content)
        papers = []
        
        for entry in root.findall('atom:entry', NAMESPACES):
            # Extract standard fields
            title_el = entry.find('atom:title', NAMESPACES)
            title = clean_text(title_el.text) if title_el is not None else "Untitled"
            
            summary_el = entry.find('atom:summary', NAMESPACES)
            summary = clean_text(summary_el.text) if summary_el is not None else "No abstract available."
            
            published_el = entry.find('atom:published', NAMESPACES)
            published_date = published_el.text if published_el is not None else ""
            
            id_el = entry.find('atom:id', NAMESPACES)
            raw_id_url = id_el.text.strip() if id_el is not None else ""
            paper_id = raw_id_url.split('/abs/')[-1] if '/abs/' in raw_id_url else raw_id_url
            
            # Format authors list
            authors = []
            for author in entry.findall('atom:author', NAMESPACES):
                name_el = author.find('atom:name', NAMESPACES)
                if name_el is not None:
                    authors.append(clean_text(name_el.text))
            
            # Get links
            pdf_url = ""
            for link in entry.findall('atom:link', NAMESPACES):
                rel = link.attrib.get('rel')
                title_attr = link.attrib.get('title')
                href = link.attrib.get('href', '')
                
                if title_attr == 'pdf' or (rel == 'related' and 'pdf' in href) or link.attrib.get('type') == 'application/pdf':
                    pdf_url = href
            
            if not pdf_url and paper_id:
                pdf_url = f"https://arxiv.org/pdf/{paper_id}.pdf"
                
            papers.append({
                'id': paper_id,
                'title': title,
                'summary': summary,
                'authors': authors if authors else ["Unknown Author"],
                'published': published_date,
                'url': raw_id_url,
                'pdf_url': pdf_url
            })
            
        return jsonify({'success': True, 'papers': papers})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/summarize', methods=['POST'])
def summarize_paper():
    data = request.get_json() or {}
    title = data.get('title', '')
    abstract = data.get('abstract', '')
    authors = ", ".join(data.get('authors', []))
    
    # Retrieve Gemini API Key from header or environment variable
    api_key = request.headers.get('X-Gemini-API-Key') or os.environ.get('GEMINI_API_KEY')
    
    if not api_key:
        return jsonify({
            'success': False, 
            'error': 'Gemini API key is required. Please set it in the Settings panel.'
        }), 400
        
    # Construct prompt
    prompt = (
        "Summarize the following AI research paper into a highly engaging, professional tweet (maximum 280 characters). "
        "Highlight the primary contribution, its practical impact, or why it matters. "
        "Include 1-2 relevant hashtags (like #AI, #MachineLearning, #NLP, #ComputerVision). "
        "Make it compelling for tech-savvy readers. Do not surround the tweet in quotes.\n\n"
        f"Title: {title}\n"
        f"Authors: {authors}\n"
        f"Abstract: {abstract}"
    )
    
    # Call Gemini API
    # We use the recommended gemini-2.5-flash model via the REST endpoint
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "maxOutputTokens": 150,
            "temperature": 0.7
        }
    }
    
    try:
        response = requests.post(gemini_url, json=payload, headers={'Content-Type': 'application/json'}, timeout=15)
        
        # If API returns error
        if response.status_code != 200:
            error_data = response.json()
            error_msg = error_data.get('error', {}).get('message', 'Failed to generate tweet.')
            return jsonify({'success': False, 'error': f"Gemini API Error: {error_msg}"}), response.status_code
            
        result = response.json()
        
        # Extract response text
        tweet_text = ""
        candidates = result.get('candidates', [])
        if candidates:
            content = candidates[0].get('content', {})
            parts = content.get('parts', [])
            if parts:
                tweet_text = parts[0].get('text', '').strip()
                
        # Clean quotes if model wrapped it in quotes
        if tweet_text.startswith('"') and tweet_text.endswith('"'):
            tweet_text = tweet_text[1:-1].strip()
        if tweet_text.startswith("'") and tweet_text.endswith("'"):
            tweet_text = tweet_text[1:-1].strip()
            
        return jsonify({'success': True, 'tweet': tweet_text})
        
    except Exception as e:
        return jsonify({'success': False, 'error': f"Server error: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
