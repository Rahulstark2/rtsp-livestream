from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import cv2
import threading
import time
import re
import os
from werkzeug.utils import secure_filename
import uuid
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import copy

app = Flask(__name__)
CORS(app)

video_capture = None
is_streaming = False
is_paused = False
last_frame = None
stream_lock = threading.Lock()
rtsp_url = None

overlays = {}
overlay_cache = {}
last_overlay_update = 0
overlay_update_interval = 1

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


overlay_lock = threading.Lock()
overlay_cache_lock = threading.Lock()


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_frames():
    global video_capture, is_streaming, is_paused, last_frame, rtsp_url, overlays, overlay_cache, last_overlay_update
    while is_streaming:
        if is_paused:
            time.sleep(0.1)
            continue

        if video_capture is None or not video_capture.isOpened():
            video_capture = cv2.VideoCapture(rtsp_url)
            if not video_capture.isOpened():
                print("Failed to open stream")
                break

        success, frame = video_capture.read()
        if not success:
            print("Failed to read frame")
            break
        else:
            current_time = time.time()
            if current_time - last_overlay_update > overlay_update_interval:
                update_overlay_cache()
                last_overlay_update = current_time

            frame = apply_overlays(frame)

            with stream_lock:
                ret, buffer = cv2.imencode('.jpg', frame)
                last_frame = buffer.tobytes()

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + last_frame + b'\r\n')


def update_overlay_cache():
    global overlays, overlay_cache
    with overlay_lock:
        current_overlays = copy.deepcopy(overlays)

    new_cache = {}
    for overlay_id, overlay in current_overlays.items():
        try:
            if overlay['type'] == 'text':
                img = create_text_overlay(overlay)
            elif overlay['type'] == 'image':
                img = create_image_overlay(overlay)
            new_cache[overlay_id] = img
        except Exception as e:
            print(f"Error creating overlay {overlay_id}: {str(e)}")

    with overlay_cache_lock:
        overlay_cache.clear()
        overlay_cache.update(new_cache)


def create_text_overlay(overlay):
    img = Image.new('RGBA', (720, 480), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)


    try:

        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
    except OSError:
        try:

            font = ImageFont.truetype("arial.ttf", 32)
        except OSError:
            try:

                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
            except OSError:

                font = ImageFont.load_default()

    lines = overlay['content'].split('\n')
    y = overlay['y']
    for line in lines:
        draw.text((overlay['x'], y), line, font=font, fill=(255, 255, 255, 255))
        y += 40
    return np.array(img)


def create_image_overlay(overlay):
    img = cv2.imread(overlay['content'], cv2.IMREAD_UNCHANGED)
    if img is not None:

        img = cv2.resize(img, (100, 100))
        if img.shape[2] == 3:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    return img


def apply_overlays(frame):
    frame_height, frame_width = frame.shape[:2]
    with overlay_cache_lock:
        current_cache = copy.deepcopy(overlay_cache)

    for overlay_id, overlay_img in current_cache.items():
        if overlay_img is not None:
            with overlay_lock:
                if overlay_id in overlays:
                    x, y = overlays[overlay_id]['x'], overlays[overlay_id]['y']
                else:
                    continue


            overlay_height, overlay_width = overlay_img.shape[:2]
            x = min(max(x, 0), frame_width - overlay_width)
            y = min(max(y, 0), frame_height - overlay_height)

            if overlay_img.shape[2] == 4:
                alpha_s = overlay_img[:, :, 3] / 255.0
                alpha_l = 1.0 - alpha_s

                for c in range(0, 3):
                    frame[y:y + overlay_height, x:x + overlay_width, c] = (
                            alpha_s * overlay_img[:, :, c] +
                            alpha_l * frame[y:y + overlay_height, x:x + overlay_width, c]
                    )
            else:
                frame[y:y + overlay_height, x:x + overlay_width] = overlay_img[:, :, :3]

    return frame


@app.route('/me', methods=['GET'])
def get():
    return jsonify({'message': 'I am alive'})


@app.route('/stream', methods=['POST'])
def start_stream():
    global video_capture, is_streaming, is_paused, rtsp_url
    data = request.json
    rtsp_url = data.get('rtspUrl')

    rtsp_url_pattern = re.compile(
        r'^rtsp://(([A-Za-z0-9._~!$&\'()*+,;=:-]+@)?[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~!$&\'()*+,;=:-]+)*)?$'
    )
    if not rtsp_url or not rtsp_url_pattern.match(rtsp_url):
        return jsonify({"error": "Invalid RTSP URL"}), 400

    if is_streaming and not is_paused:
        return jsonify({"message": "Stream is already running"}), 400

    if is_paused:
        is_paused = False
        return jsonify({"message": "Stream resumed successfully"}), 200

    video_capture = cv2.VideoCapture(rtsp_url)
    if not video_capture.isOpened():
        return jsonify({"error": "Failed to open RTSP stream"}), 500

    is_streaming = True
    is_paused = False
    return jsonify({"message": "Stream started successfully"}), 200


@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/pause_stream', methods=['POST'])
def pause_stream():
    global is_streaming, is_paused
    if is_streaming:
        is_paused = True
        return jsonify({"message": "Stream paused successfully"}), 200
    else:
        return jsonify({"message": "No active stream to pause"}), 400


@app.route('/stop_stream', methods=['POST'])
def stop_stream():
    global video_capture, is_streaming, is_paused, last_frame, rtsp_url
    is_streaming = False
    is_paused = False
    if video_capture:
        video_capture.release()
    video_capture = None
    last_frame = None
    rtsp_url = None
    return jsonify({"message": "Stream stopped successfully"}), 200


def wrap_text(text, max_chars_per_line=6):
    return '\n'.join([text[i:i + max_chars_per_line] for i in range(0, len(text), max_chars_per_line)])


@app.route('/overlays', methods=['POST'])
def create_overlay():
    global overlays
    new_overlay = {}
    if 'file' in request.files:
        file = request.files['file']
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            new_overlay = {
                'type': 'image',
                'content': filepath,
                'position': request.form.get('position', 'center')
            }
        else:
            return jsonify({"error": "Invalid file type"}), 400
    else:
        new_overlay = request.json

    new_overlay['id'] = str(uuid.uuid4())

    width = 720
    height = 480

    if new_overlay['type'] == 'text':
        if new_overlay['position'] == 'top':
            new_overlay['x'] = 300
            new_overlay['y'] = 100
        elif new_overlay['position'] == 'bottom':
            new_overlay['x'] = 300
            new_overlay['y'] = 400
        elif new_overlay['position'] == 'left':
            new_overlay['x'] = 50
            new_overlay['y'] = 250
        elif new_overlay['position'] == 'right':
            new_overlay['x'] = 580
            new_overlay['y'] = 250
        elif new_overlay['position'] == 'center':
            new_overlay['x'] = 300
            new_overlay['y'] = 250

    else:
        if new_overlay['position'] == 'top':
            new_overlay['x'] = 300
            new_overlay['y'] = 50
        elif new_overlay['position'] == 'bottom':
            new_overlay['x'] = 300
            new_overlay['y'] = 340
        elif new_overlay['position'] == 'left':
            new_overlay['x'] = 50
            new_overlay['y'] = 200
        elif new_overlay['position'] == 'right':
            new_overlay['x'] = 580
            new_overlay['y'] = 200
        elif new_overlay['position'] == 'center':
            new_overlay['x'] = 300
            new_overlay['y'] = 200

    if new_overlay['type'] == 'text' and len(new_overlay['content']) > 6:
        new_overlay['content'] = wrap_text(new_overlay['content'])

    overlays[new_overlay['id']] = new_overlay
    return jsonify({"message": "Overlay created successfully", "id": new_overlay['id']}), 201


@app.route('/overlays', methods=['GET'])
def get_overlays():
    return jsonify(list(overlays.values())), 200


def convert_position_to_coordinates_text(position, width=720, height=480):
    if position == 'top':
        return 300, 100
    elif position == 'bottom':
        return 300, 400
    elif position == 'left':
        return 50, 250
    elif position == 'right':
        return 580, 250
    elif position == 'center':
        return 300, 250
    else:
        return 300, 250


def convert_position_to_coordinates_image(position, width=720, height=480):
    print("a")
    if position == 'top':
        return 300, 50
    elif position == 'bottom':
        return 300, 340
    elif position == 'left':
        return 50, 200
    elif position == 'right':
        return 580, 200
    elif position == 'center':
        return 300, 200
    else:
        return 300, 250


@app.route('/overlays/<overlay_id>', methods=['PUT'])
def update_overlay(overlay_id):
    if overlay_id not in overlays:
        return jsonify({"error": "Overlay not found"}), 404

    if 'file' in request.files:
        file = request.files['file']
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            overlays[overlay_id]['content'] = filepath
            overlays[overlay_id]['type'] = 'image'
            overlays[overlay_id]['position'] = request.form.get('position')
        else:
            return jsonify({"error": "Invalid file type"}), 400
    else:
        updated_overlay = request.json
        overlays[overlay_id].update(updated_overlay)

    if overlays[overlay_id]['type'] == 'text':
        x, y = convert_position_to_coordinates_text(overlays[overlay_id].get('position', 'center'))
        overlays[overlay_id]['x'] = x
        overlays[overlay_id]['y'] = y
    else:
        x, y = convert_position_to_coordinates_image(overlays[overlay_id].get('position', 'center'))
        overlays[overlay_id]['x'] = x
        overlays[overlay_id]['y'] = y

    if overlays[overlay_id]['type'] == 'text' and len(overlays[overlay_id]['content']) > 6:
        overlays[overlay_id]['content'] = wrap_text(overlays[overlay_id]['content'])

    return jsonify({"message": "Overlay updated successfully"}), 200


@app.route('/overlays/<overlay_id>', methods=['DELETE'])
def delete_overlay(overlay_id):
    global overlays
    with overlay_lock:
        if overlay_id not in overlays:
            return jsonify({"error": "Overlay not found"}), 404
        del overlays[overlay_id]

    with overlay_cache_lock:
        if overlay_id in overlay_cache:
            del overlay_cache[overlay_id]

    return jsonify({"message": "Overlay deleted successfully"}), 200


if __name__ == '__main__':
    app.run(debug=True)