from flask import Flask, request, jsonify, send_file
from flask_pymongo import PyMongo
from flask_cors import CORS
from werkzeug.utils import secure_filename
from bson import ObjectId
from datetime import datetime
import gridfs
import os

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv("MONGO_URI", "mongodb://localhost:27017/cokjibuh")
mongo = PyMongo(app)
CORS(app)
fs = gridfs.GridFS(mongo.db)

# 회원가입
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if mongo.db.users.find_one({'username': data['username']}):
        return jsonify({'error': '이미 존재하는 사용자입니다.'}), 400
    mongo.db.users.insert_one({
        'username': data['username'],
        'password': data['password']
    })
    return jsonify({'message': '회원가입 성공'})

# 로그인
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = mongo.db.users.find_one({'username': data['username'], 'password': data['password']})
    if not user:
        return jsonify({'error': '로그인 실패'}), 401
    return jsonify({'token': user['username']})

# 마지막 장소 기억
@app.route('/api/last_place', methods=['GET'])
def get_last_place():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user = mongo.db.users.find_one({'username': token})
    if not user: return jsonify({'error': '인증 실패'}), 401
    setting = mongo.db.settings.find_one({'username': token})
    if not setting:
        return jsonify({'placeId': None, 'placeName': None})
    return jsonify({'placeId': setting.get('place_id'), 'placeName': setting.get('place_name')})

@app.route('/api/last_place', methods=['PUT'])
def save_last_place():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user = mongo.db.users.find_one({'username': token})
    if not user: return jsonify({'error': '인증 실패'}), 401
    data = request.json
    mongo.db.settings.update_one(
        {'username': token},
        {'$set': {
            'place_id': data.get('placeId'),
            'place_name': data.get('placeName')
        }},
        upsert=True
    )
    return jsonify({'message': '저장됨'})

@app.route('/api/last_place', methods=['DELETE'])
def clear_last_place():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user = mongo.db.users.find_one({'username': token})
    if not user: return jsonify({'error': '인증 실패'}), 401
    mongo.db.settings.delete_one({'username': token})
    return jsonify({'message': '삭제됨'})

# 장소 정보 조회 (자동 로그인용 추가 API)
@app.route('/api/places/<place_id>', methods=['GET'])
def get_place(place_id):
    place = mongo.db.places.find_one({'_id': ObjectId(place_id)})
    if not place:
        return jsonify({'error': '장소 없음'}), 404
    return jsonify({
        'placeId': str(place['_id']),
        'placeName': place['name'],
        'imageUrl': f'/api/image/{place_id}'
    })

# 장소 업로드
@app.route('/api/places', methods=['POST'])
def upload_place():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user = mongo.db.users.find_one({'username': token})
    if not user: return jsonify({'error': '인증 실패'}), 401
    name = request.form.get('name')
    image = request.files['image']
    image_id = fs.put(image, filename=secure_filename(image.filename))
    result = mongo.db.places.insert_one({
        'name': name,
        'image_id': image_id,
        'owner': token,
        'created_at': datetime.utcnow()
    })
    return jsonify({'_id': str(result.inserted_id)})

# 이미지 서빙
@app.route('/api/image/<place_id>')
def get_image(place_id):
    place = mongo.db.places.find_one({'_id': ObjectId(place_id)})
    if not place:
        return jsonify({'error': '이미지 없음'}), 404
    image = fs.get(place['image_id'])
    return send_file(image, mimetype='image/jpeg')

# 핀 저장
@app.route('/api/places/<place_id>/pins', methods=['POST'])
def add_pin(place_id):
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    user = mongo.db.users.find_one({'username': token})
    if not user: return jsonify({'error': '인증 실패'}), 401
    data = request.json
    result = mongo.db.pins.insert_one({
        'place_id': ObjectId(place_id),
        'name': data['name'],
        'emoji': data['emoji'],
        'color': data['color'],
        'x': data['x'],
        'y': data['y'],
        'comment': data.get('comment', '')
    })
    return jsonify({'_id': str(result.inserted_id), **data})

# 핀 목록 불러오기
@app.route('/api/places/<place_id>/pins', methods=['GET'])
def get_pins(place_id):
    pins = list(mongo.db.pins.find({'place_id': ObjectId(place_id)}))
    for p in pins:
        p['_id'] = str(p['_id'])
    return jsonify(pins)

# 핀 수정
@app.route('/api/pins/<pin_id>', methods=['PUT'])
def update_pin(pin_id):
    data = request.json
    mongo.db.pins.update_one(
        {'_id': ObjectId(pin_id)},
        {'$set': {
            'name': data['name'],
            'emoji': data['emoji'],
            'comment': data['comment'],
            'color': data['color']
        }}
    )
    return jsonify({'message': '수정됨'})

# 핀 삭제
@app.route('/api/pins/<pin_id>', methods=['DELETE'])
def delete_pin(pin_id):
    mongo.db.pins.delete_one({'_id': ObjectId(pin_id)})
    return jsonify({'message': '삭제됨'})

# 핀 이동
@app.route('/items/<pin_id>/move', methods=['POST'])
def move_pin(pin_id):
    data = request.json
    mongo.db.pins.update_one({'_id': ObjectId(pin_id)}, {'$set': {'x': data['newX'], 'y': data['newY']}})
    return jsonify({'message': '이동됨'})

# 히스토리 저장
@app.route('/api/places/<place_id>/history', methods=['POST'])
def save_history(place_id):
    data = request.json
    mongo.db.history.insert_one({
        'place_id': ObjectId(place_id),
        'pin_id': ObjectId(data['pin_id']),
        'x': data['x'],
        'y': data['y'],
        'time': datetime.utcnow()
    })
    return jsonify({'message': '저장됨'})

# 히스토리 불러오기
@app.route('/api/places/<place_id>/history', methods=['GET'])
def get_history(place_id):
    records = list(mongo.db.history.find({'place_id': ObjectId(place_id)}))
    result = []
    for r in records:
        r['_id'] = str(r['_id'])
        r['place_id'] = str(r['place_id'])
        r['pin_id'] = str(r['pin_id'])
        result.append(r)
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)
