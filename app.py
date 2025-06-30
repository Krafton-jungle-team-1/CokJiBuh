import os
from io import BytesIO
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, send_file, abort, send_from_directory, redirect
from flask_pymongo import PyMongo
from flask_cors import CORS
from bson import ObjectId
import gridfs
from dotenv import load_dotenv
import jwt
from passlib.hash import bcrypt

# Load environment variables
env_path = os.path.join(os.getcwd(), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

app = Flask(__name__)
CORS(app)
app.config['MONGO_URI'] = os.environ.get('MONGO_URI')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change_this_secret_key')

# Initialize MongoDB and GridFS
mongo = PyMongo(app)
db = mongo.db
fs = gridfs.GridFS(db)

# ---------------- JWT 인증 데코레이터 ----------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.split('Bearer ')[-1] if auth_header.startswith('Bearer ') else None
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = payload.get('username')
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except Exception:
            return jsonify({'error': 'Token is invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# ---------------- 인증 (회원가입, 로그인) ----------------
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Missing username or password'}), 400
    if db.users.find_one({'username': username}):
        return jsonify({'error': 'Username already exists'}), 400
    hashed = bcrypt.hash(password)
    db.users.insert_one({'username': username, 'password': hashed})
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/api/check_username/<username>', methods=['GET'])
def check_username(username):
    exists = db.users.find_one({'username': username}) is not None
    return jsonify({'exists': exists})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    user = db.users.find_one({'username': username})
    if not user or not bcrypt.verify(password, user['password']):
        return jsonify({'error': 'Invalid username or password'}), 401
    token = jwt.encode({'username': username, 'exp': datetime.utcnow() + timedelta(hours=24)},
                       app.config['SECRET_KEY'], algorithm='HS256')
    return jsonify({'token': token}), 200

# ---------------- 클라이언트 라우팅 ----------------
@app.route('/')
def root():
    latest = db.settings.find_one({'_id': 'last_place'})
    if latest and latest.get('place_id'):
        return redirect(f"/edit?placeId={latest['place_id']}")
    return redirect('/edit')

@app.route('/edit')
def edit_page():
    return send_from_directory('static', 'index.html')

# ---------------- 장소 관리 (Place) ----------------
@app.route('/api/places', methods=['POST'])
@token_required
def create_place(user):
    name = request.form.get('name')
    image_file = request.files.get('image')
    if not name or not image_file:
        return jsonify({'error': 'Both name and image are required'}), 400
    # Optionally clear old data per user
    db.places.delete_many({'username': user})
    db.pins.delete_many({'username': user})
    db.history.delete_many({'username': user})
    fs_files = db.fs.files.delete_many({'metadata.username': user})
    fs_chunks = db.fs.chunks.delete_many({})

    image_id = fs.put(image_file, filename=image_file.filename,
                      content_type=image_file.content_type, metadata={'username': user})
    place = {'username': user, 'name': name, 'image_id': image_id, 'created': datetime.utcnow()}
    res = db.places.insert_one(place)
    return jsonify({'_id': str(res.inserted_id)}), 201

@app.route('/api/places/<place_id>', methods=['GET'])
@token_required
def get_place(user, place_id):
    try:
        p = db.places.find_one({'_id': ObjectId(place_id), 'username': user})
    except Exception:
        return jsonify({'error': 'Invalid place_id'}), 400
    if not p:
        return jsonify({'error': 'Place not found'}), 404
    return jsonify({'_id': place_id, 'name': p['name'], 'image_url': f"/api/places/{place_id}/image"})

@app.route('/api/places/<place_id>/image', methods=['GET'])
@token_required
def get_place_image(user, place_id):
    try:
        p = db.places.find_one({'_id': ObjectId(place_id), 'username': user})
    except Exception:
        abort(404)
    if not p or 'image_id' not in p:
        abort(404)
    g = fs.get(p['image_id'])
    return send_file(BytesIO(g.read()), mimetype=g.content_type, as_attachment=False,
                     download_name=g.filename)

# ---------------- 핀 (Pin) ----------------
@app.route('/api/places/<place_id>/pins', methods=['GET'])
@token_required
def list_pins(user, place_id):
    try:
        oid = ObjectId(place_id)
    except Exception:
        return jsonify({'error': 'Invalid place_id'}), 400
    docs = list(db.pins.find({'place_id': oid, 'username': user}))
    for d in docs:
        d['_id'], d['place_id'] = str(d['_id']), str(d['place_id'])
    return jsonify(docs)

@app.route('/api/places/<place_id>/pins', methods=['POST'])
@token_required
def create_pin(user, place_id):
    data = request.get_json() or {}
    try:
        oid = ObjectId(place_id)
    except Exception:
        return jsonify({'error': 'Invalid place_id'}), 400
    required = ['name', 'emoji', 'color', 'x', 'y']
    if not all(k in data for k in required):
        return jsonify({'error': f"Fields {required} are required"}), 400
    doc = {k: data[k] for k in required}
    doc.update({'username': user, 'place_id': oid, 'comment': data.get('comment', ''),
                'updated': datetime.utcnow()})
    res = db.pins.insert_one(doc)
    doc['_id'], doc['place_id'] = str(res.inserted_id), place_id
    return jsonify(doc), 201

@app.route('/api/pins/<pin_id>', methods=['PUT'])
@token_required
def update_pin(user, pin_id):
    data = request.get_json() or {}
    try:
        oid = ObjectId(pin_id)
    except Exception:
        return jsonify({'error': 'Invalid pin_id'}), 400
    existing = db.pins.find_one({'_id': oid, 'username': user})
    if not existing:
        return jsonify({'error': 'Pin not found'}), 404
    fields = ['name', 'emoji', 'color', 'x', 'y', 'comment']
    updates = {k: data[k] for k in fields if k in data}
    if not updates:
        return jsonify({'error': 'No updatable fields'}), 400
    db.pins.update_one({'_id': oid}, {'$set': updates})
    updated = db.pins.find_one({'_id': oid})
    updated['_id'], updated['place_id'] = str(updated['_id']), str(updated['place_id'])
    return jsonify(updated)

@app.route('/api/pins/<pin_id>', methods=['DELETE'])
@token_required
def delete_pin(user, pin_id):
    try:
        oid = ObjectId(pin_id)
    except Exception:
        return jsonify({'error': 'Invalid pin_id'}), 400
    res = db.pins.delete_one({'_id': oid, 'username': user})
    if res.deleted_count == 0:
        return jsonify({'error': 'Pin not found'}), 404
    return jsonify({'status': 'deleted'})

# ---------------- 이동 이력 (History) ----------------
@app.route('/api/places/<place_id>/history', methods=['GET'])
@token_required
def list_history(user, place_id):
    try:
        oid = ObjectId(place_id)
    except Exception:
        return jsonify({'error': 'Invalid place_id'}), 400
    docs = list(db.history.find({'place_id': oid, 'username': user}).sort('time', 1))
    for d in docs:
        d['_id'], d['place_id'], d['pin_id'] = str(d['_id']), str(d['place_id']), str(d['pin_id'])
    return jsonify(docs)

@app.route('/api/places/<place_id>/history', methods=['POST'])
@token_required
def create_history(user, place_id):
    data = request.get_json() or {}
    try:
        pid, oid = ObjectId(data.get('pin_id', '')), ObjectId(place_id)
    except Exception:
        return jsonify({'error': 'Invalid IDs'}), 400
    if not all(k in data for k in ['pin_id', 'x', 'y']):
        return jsonify({'error': "Fields 'pin_id','x','y' are required"}), 400
    entry = {'username': user, 'place_id': oid, 'pin_id': pid,
             'x': data['x'], 'y': data['y'], 'time': datetime.utcnow()}
    res = db.history.insert_one(entry)
    entry['_id'], entry['place_id'], entry['pin_id'] = str(res.inserted_id), place_id, data['pin_id']
    return jsonify(entry), 201

# ---------------- 아이템 이동 (Legacy) ----------------
@app.route('/items/<itemId>/move', methods=['POST'])
@token_required
def move_item(user, itemId):
    data = request.get_json() or {}
    if 'newX' not in data or 'newY' not in data:
        return jsonify({'error': "Missing 'newX' or 'newY'"}), 400
    log = {'username': user, 'itemId': itemId,
           'newX': data['newX'], 'newY': data['newY'], 'movedAt': datetime.utcnow()}
    res = db.changeLocation.insert_one(log)
    return jsonify({'success': True, 'id': str(res.inserted_id)}), 201

# ---------------- 마지막 장소 설정 ----------------
@app.route('/api/last_place', methods=['PUT'])
@token_required
def set_last_place(user):
    data = request.get_json() or {}
    db.settings.update_one({'username': user},
                           {'$set': {'place_id': data.get('placeId'), 'place_name': data.get('placeName')}},
                           upsert=True)
    return jsonify({'message': 'saved'})

@app.route('/api/last_place', methods=['GET'])
@token_required
def get_last_place(user):
    s = db.settings.find_one({'username': user})
    return jsonify({'placeId': s.get('place_id') if s else None,
                    'placeName': s.get('place_name') if s else None})

@app.route('/api/last_place', methods=['DELETE'])
@token_required
def clear_last_place(user):
    db.settings.delete_one({'username': user})
    return jsonify({'message': 'cleared'})

# ---------------- 서버 실행 ----------------
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)