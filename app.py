# Requirements:
# flask
# flask-pymongo
# flask-cors
# python-dotenv
# pymongo (gridfs is part of pymongo)

import os
from io import BytesIO
from datetime import datetime
from flask import Flask, request, jsonify, send_file, abort, send_from_directory
from flask_pymongo import PyMongo
from flask_cors import CORS
from bson import ObjectId
import gridfs

# Load environment variables from a .env file (if present)
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)

@app.route("/")
def index():
    return send_from_directory("static", "index.html")



# MongoDB configuration
MONGO_URI = os.environ["MONGO_URI"]
app.config["MONGO_URI"] = MONGO_URI

# Initialize PyMongo and GridFS
mongo = PyMongo(app)
db = mongo.db
fs = gridfs.GridFS(db)

# ----- Place endpoints -----

@app.route("/items/<itemId>/move", methods=["POST"])
def move_item(itemId):
    data = request.get_json()
    if not data or "newX" not in data or "newY" not in data:
        return jsonify({"error": "Missing 'newX' or 'newY'"}), 400

    entry = {
        "itemId": itemId,  # URL의 itemId를 씀
        "newX": data["newX"],
        "newY": data["newY"],
        "movedAt": datetime.utcnow()
    }
    result = db.changeLocation.insert_one(entry)
    return jsonify({"success": True, "id": str(result.inserted_id)}), 201

@app.route('/api/last_place', methods=['PUT'])
def set_last_place():
    data = request.get_json()
    place_id = data.get('placeId')
    place_name = data.get('placeName')
    db.settings.update_one(
        {"_id": "last_place"},
        {"$set": {"place_id": place_id, "place_name": place_name}},
        upsert=True
    )
    return jsonify({"message": "saved"})

@app.route('/api/last_place', methods=['GET'])
def get_last_place():
    s = db.settings.find_one({"_id": "last_place"})
    return jsonify({
        "placeId": s.get("place_id") if s else None,
        "placeName": s.get("place_name") if s else None
    })

@app.route('/api/last_place', methods=['DELETE'])
def clear_last_place():
    db.settings.delete_one({"_id": "last_place"})
    return jsonify({"message": "cleared"})


@app.route("/api/places", methods=["POST"])
def create_place():
    # Expecting a multipart/form-data request with 'name' and file 'image'
    name = request.form.get("name")
    image = request.files.get("image")
    if not name or not image:
        return jsonify({"error": "Both 'name' and image file are required"}), 400

    # Save image into GridFS
    image_id = fs.put(image, filename=image.filename, content_type=image.content_type)
    place_doc = {"name": name, "image_id": image_id, "created": datetime.utcnow()}
    result = db.places.insert_one(place_doc)

    return jsonify({"_id": str(result.inserted_id)}), 201

@app.route("/api/places/<place_id>", methods=["GET"])
def get_place(place_id):
    try:
        place = db.places.find_one({"_id": ObjectId(place_id)})
    except:
        return jsonify({"error": "Invalid place_id"}), 400
    if not place:
        return jsonify({"error": "Place not found"}), 404

    return jsonify({
        "_id": place_id,
        "name": place["name"],
        "image_url": f"/api/places/{place_id}/image"
    })

@app.route("/api/places/<place_id>/image", methods=["GET"])
def get_place_image(place_id):
    try:
        place = db.places.find_one({"_id": ObjectId(place_id)})
    except:
        abort(404)
    if not place or not place.get("image_id"):
        abort(404)

    grid_out = fs.get(place["image_id"])
    return send_file(
        BytesIO(grid_out.read()),
        mimetype=grid_out.content_type,
        download_name=grid_out.filename,
        as_attachment=False
    )

# ----- Pin endpoints -----
@app.route("/api/places/<place_id>/pins", methods=["GET"])
def list_pins(place_id):
    try:
        oid = ObjectId(place_id)
    except:
        return jsonify({"error": "Invalid place_id"}), 400
    pins = list(db.pins.find({"place_id": oid}))
    for p in pins:
        p["_id"] = str(p["_id"])
        p["place_id"] = str(p["place_id"])
    return jsonify(pins)

@app.route("/api/places/<place_id>/pins", methods=["POST"])
def create_pin(place_id):
    data = request.get_json()
    try:
        oid = ObjectId(place_id)
    except:
        return jsonify({"error": "Invalid place_id"}), 400

    required = ["name", "emoji", "color", "x", "y"]
    if not data or not all(k in data for k in required):
        return jsonify({"error": f"Fields {required} are required in JSON body"}), 400

    pin = {
        "place_id": oid,
        "name": data["name"],
        "emoji": data["emoji"],
        "color": data["color"],
        "x": data["x"],
        "y": data["y"],
        "comment": data.get("comment", ""),
        "updated": datetime.utcnow()
    }
    result = db.pins.insert_one(pin)
    pin["_id"] = str(result.inserted_id)
    pin["place_id"] = place_id
    return jsonify(pin), 201

@app.route("/api/pins/<pin_id>", methods=["PUT"])
def update_pin(pin_id):
    data = request.get_json()
    try:
        oid = ObjectId(pin_id)
    except:
        return jsonify({"error": "Invalid pin_id"}), 400

    update_fields = {}
    for field in ["name", "emoji", "color", "x", "y", "comment"]:
        if field in data:
            update_fields[field] = data[field]
    if not update_fields:
        return jsonify({"error": "No updatable fields provided"}), 400

    result = db.pins.update_one({"_id": oid}, {"$set": update_fields})
    if result.matched_count == 0:
        return jsonify({"error": "Pin not found"}), 404

    pin = db.pins.find_one({"_id": oid})
    pin["_id"] = str(pin["_id"])
    pin["place_id"] = str(pin["place_id"])
    return jsonify(pin)

@app.route("/api/pins/<pin_id>", methods=["DELETE"])
def delete_pin(pin_id):
    try:
        oid = ObjectId(pin_id)
    except:
        return jsonify({"error": "Invalid pin_id"}), 400
    result = db.pins.delete_one({"_id": oid})
    if result.deleted_count == 0:
        return jsonify({"error": "Pin not found"}), 404
    return jsonify({"status": "deleted"}), 200

# ----- Movement history endpoints -----
@app.route("/api/places/<place_id>/history", methods=["GET"])
def list_history(place_id):
    try:
        oid = ObjectId(place_id)
    except:
        return jsonify({"error": "Invalid place_id"}), 400
    hist = list(db.history.find({"place_id": oid}).sort("time", 1))
    for h in hist:
        h["_id"] = str(h["_id"])
        h["place_id"] = str(h["place_id"])
        h["pin_id"] = str(h["pin_id"])
    return jsonify(hist)

@app.route("/api/places/<place_id>/history", methods=["POST"])
def create_history(place_id):
    data = request.get_json()
    try:
        pid = ObjectId(data.get("pin_id", ""))
        oid = ObjectId(place_id)
    except:
        return jsonify({"error": "Invalid IDs"}), 400

    if not all(k in data for k in ("pin_id", "x", "y")):
        return jsonify({"error": "Fields 'pin_id', 'x', 'y' are required"}), 400

    entry = {
        "place_id": oid,
        "pin_id": pid,
        "x": data["x"],
        "y": data["y"],
        "time": datetime.utcnow()
    }
    result = db.history.insert_one(entry)
    entry["_id"] = str(result.inserted_id)
    entry["place_id"] = place_id
    entry["pin_id"] = data["pin_id"]
    return jsonify(entry), 201

# ----- Run server -----
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)