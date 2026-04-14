from flask import Flask, jsonify, request, send_file, send_from_directory, session
from flask_cors import CORS
import os
import secrets
from utils import (
    init_db, fetch_and_store_news, get_all_news, 
    get_article_by_id, update_article_summary, search_news,
    summarize_text, summarize_text_crisp, get_summary_stats,
    text_to_audio_buffer, text_to_audio_file, list_audio_files,
    signup_user, login_user, get_user_by_id
)
from config import HOST, PORT, DEBUG, AUDIO_FOLDER, CORS_ORIGINS

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Generate a secret key for sessions

# Enable CORS for frontend integration with credentials support
CORS(app)

# Initialize database on startup
init_db()

# ============================================
# ROUTES
# ============================================

@app.route('/')
def home():
    """API documentation endpoint"""
    return jsonify({
        'message': 'UPSC News Backend API',
        'version': '1.0',
        'description': 'Backend API for UPSC news aggregation, summarization, and TTS',
        'endpoints': {
            'GET /': 'API documentation',
            'GET /health': 'Health check',
            'GET /news': 'Fetch all news articles (supports pagination: ?limit=10&offset=0)',
            'GET /news/<id>': 'Get specific article by ID',
            'GET /news/search?q=<query>': 'Search articles by keyword',
            'POST /fetch': 'Fetch new articles from RSS feeds',
            'POST /summarize': 'Summarize text or article (body: {text: "..." or article_id: 1, sentences: 3})',
            'POST /tts': 'Convert text/summary to speech (body: {text: "..." or article_id: 1, save: true/false})',
            'GET /audio': 'List all saved audio files',
            'GET /audio/<filename>': 'Retrieve specific audio file'
        }
    })

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'UPSC News Backend',
        'database': 'connected'
    })

@app.route('/news', methods=['GET'])
def get_news():
    """Get all news articles with optional pagination"""
    try:
        # Get pagination parameters
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        news_list, total_count = get_all_news(limit=limit, offset=offset)
        
        # Generate summaries for articles that don't have them
        for article in news_list:
            if not article['summary']:
                full_article = get_article_by_id(article['id'])
                if full_article and full_article['full_content']:
                    summary = summarize_text(full_article['full_content'])
                    update_article_summary(article['id'], summary)
                    article['summary'] = summary
        
        response = {
            'status': 'success',
            'count': len(news_list),
            'total': total_count,
            'articles': news_list
        }
        
        if limit:
            response['limit'] = limit
            response['offset'] = offset
            response['has_more'] = (offset + limit) < total_count
        
        return jsonify(response)
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/news/<int:article_id>', methods=['GET'])
def get_news_by_id(article_id):
    """Get specific article by ID"""
    try:
        article = get_article_by_id(article_id)
        
        if not article:
            return jsonify({'error': 'Article not found'}), 404
        
        # Generate summary if not exists
        if not article['summary'] and article['full_content']:
            summary = summarize_text(article['full_content'])
            update_article_summary(article_id, summary)
            article['summary'] = summary
        
        return jsonify({
            'status': 'success',
            'article': article
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/news/search', methods=['GET'])
def search():
    """Search articles by keyword"""
    query = request.args.get('q', '')
    
    if not query:
        return jsonify({'error': 'Search query parameter "q" is required'}), 400
    
    try:
        results = search_news(query)
        return jsonify({
            'status': 'success',
            'query': query,
            'count': len(results),
            'results': results
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/fetch', methods=['POST'])
def fetch_news():
    """Fetch new articles from RSS feeds"""
    try:
        new_articles = fetch_and_store_news()
        return jsonify({
            'status': 'success',
            'message': f'Fetched {new_articles} new articles',
            'new_articles': new_articles
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/summarize', methods=['POST'])
def summarize():
    """
    Summarize text or article by ID.

    Supports two modes:
    - standard (default): normal length summary
    - crisp: extra-short summary for quick revision of big articles

    Pass {"mode": "crisp"} or {"crisp": true} in the request body to get a
    crisper summary that does not overwrite the stored standard summary.
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Determine if the user requested a crisp / extra-short summary
    mode = data.get('mode', 'standard')
    crisp = mode == 'crisp' or data.get('crisp') is True
    
    try:
        # Handle article ID
        if 'article_id' in data:
            article = get_article_by_id(data['article_id'])
            
            if not article:
                return jsonify({'error': 'Article not found'}), 404
            
            # If we're not in crisp mode and summary exists, return cached one
            if not crisp and article['summary']:
                stats = get_summary_stats(article['full_content'], article['summary'])
                return jsonify({
                    'status': 'success',
                    'summary': article['summary'],
                    'cached': True,
                    'mode': 'standard',
                    'stats': stats
                })
            
            # Generate new summary (standard or crisp) from full content
            if article['full_content']:
                if crisp:
                    summary = summarize_text_crisp(article['full_content'])
                    stats = get_summary_stats(article['full_content'], summary)
                    return jsonify({
                        'status': 'success',
                        'summary': summary,
                        'cached': False,
                        'mode': 'crisp',
                        'stats': stats
                    })
                else:
                    sentences = data.get('sentences', None)
                    summary = summarize_text(article['full_content'], sentences)
                    update_article_summary(article['id'], summary)
                    stats = get_summary_stats(article['full_content'], summary)
                    
                    return jsonify({
                        'status': 'success',
                        'summary': summary,
                        'cached': False,
                        'mode': 'standard',
                        'stats': stats
                    })
            else:
                return jsonify({'error': 'No content available for summarization'}), 400
        
        # Handle raw text
        elif 'text' in data:
            text = data['text']
            
            if crisp:
                summary = summarize_text_crisp(text)
                stats = get_summary_stats(text, summary)
                return jsonify({
                    'status': 'success',
                    'summary': summary,
                    'mode': 'crisp',
                    'stats': stats
                })
            
            sentences = data.get('sentences', None)
            summary = summarize_text(text, sentences)
            stats = get_summary_stats(text, summary)
            
            return jsonify({
                'status': 'success',
                'summary': summary,
                'mode': 'standard',
                'stats': stats
            })
        
        else:
            return jsonify({'error': 'Please provide either "text" or "article_id"'}), 400
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/tts', methods=['POST'])
def text_to_speech():
    """Convert text or article summary to speech"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    text_to_convert = None
    filename = None
    
    try:
        # Handle article ID
        if 'article_id' in data:
            article = get_article_by_id(data['article_id'])
            
            if not article:
                return jsonify({'error': 'Article not found'}), 404
            
            # Generate summary if not exists
            if not article['summary'] and article['full_content']:
                summary = summarize_text(article['full_content'])
                update_article_summary(article['id'], summary)
                text_to_convert = summary
            else:
                text_to_convert = article['summary']
            
            filename = f"article_{article['id']}"
        
        # Handle raw text
        elif 'text' in data:
            text_to_convert = data['text']
        
        else:
            return jsonify({'error': 'Please provide either "text" or "article_id"'}), 400
        
        if not text_to_convert:
            return jsonify({'error': 'No text available for conversion'}), 400
        
        # Generate audio
        save_file = data.get('save', False)
        slow_speech = data.get('slow', False)
        
        if save_file and filename:
            # Save to file
            filepath = text_to_audio_file(text_to_convert, filename, slow=slow_speech)
            return jsonify({
                'status': 'success',
                'message': 'Audio file generated',
                'filename': f"{filename}.mp3",
                'url': f"/audio/{filename}.mp3"
            })
        else:
            # Stream audio
            audio_buffer = text_to_audio_buffer(text_to_convert, slow=slow_speech)
            return send_file(
                audio_buffer,
                mimetype='audio/mpeg',
                as_attachment=True,
                download_name='summary.mp3'
            )
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/audio', methods=['GET'])
def list_audio():
    """List all saved audio files"""
    try:
        files = list_audio_files()
        return jsonify({
            'status': 'success',
            'count': len(files),
            'files': files
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/audio/<filename>')
def serve_audio(filename):
    """Serve saved audio files"""
    try:
        return send_from_directory(AUDIO_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({'error': 'Audio file not found'}), 404

@app.route('/auth/signup', methods=['POST'])
def signup():
    """User signup endpoint"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    result = signup_user(username, email, password)
    
    if result['status'] == 'success':
        return jsonify({
            'status': 'success',
            'message': result['message'],
            'user_id': result['user_id']
        }), 201
    else:
        return jsonify({
            'status': 'error',
            'message': result['message']
        }), 400

@app.route('/auth/login', methods=['POST'])
def login():
    """User login endpoint"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    result = login_user(username, password)
    
    if result['status'] == 'success':
        # Store user info in session
        session['user_id'] = result['user']['id']
        session['username'] = result['user']['username']
        session['email'] = result['user']['email']
        
        return jsonify({
            'status': 'success',
            'message': result['message'],
            'user': result['user']
        }), 200
    else:
        return jsonify({
            'status': 'error',
            'message': result['message']
        }), 401

@app.route('/auth/logout', methods=['POST'])
def logout():
    """User logout endpoint"""
    session.clear()
    return jsonify({
        'status': 'success',
        'message': 'Logged out successfully'
    }), 200

@app.route('/auth/check', methods=['GET'])
def check_auth():
    """Check if user is authenticated"""
    if 'user_id' in session:
        user = get_user_by_id(session['user_id'])
        if user:
            return jsonify({
                'status': 'authenticated',
                'user': {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email']
                }
            }), 200
    
    return jsonify({
        'status': 'not_authenticated'
    }), 401
    



# ============================================
# MAIN
# ============================================

if __name__ == '__main__':
    print("\n" + "="*60)
    print("UPSC NEWS BACKEND STARTING")
    print("="*60)
    
    print("\nFetching initial news articles...")
    try:
        fetch_and_store_news()
    except Exception as e:
        print(f"Warning: {str(e)}")
    
    print("\nServer starting on Render...\n")

    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))