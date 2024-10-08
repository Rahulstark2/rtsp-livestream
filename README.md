# RTSP Livestream Player

RTSP Livestream Player is a web-based application that enables real-time streaming and overlay management of RTSP feeds. Built with React and Flask, it allows users to view streams and dynamically add text or image overlays with customizable positioning and controls.

## Features

- Real-time RTSP stream playback
- Stream control (play, pause, resume)
- Volume control and muting
- Dynamic overlay management:
  - Text overlays with multiline support
  - Image overlays with automatic resizing
  - Customizable positioning (top, bottom, left, right, center)
  - Edit and delete functionality
- Responsive design
- User-friendly interface

## Tech Stack

### Frontend
- React
- Tailwind CSS
- Lucide Icons
- shadcn/ui components
- Axios for API communication

### Backend
- Flask
- OpenCV for video processing
- Flask-CORS for cross-origin resource sharing

## Prerequisites

- Node.js (v14 or higher)
- Python (v3.7 or higher)
- pip (Python package manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/RTSP_Livestream_Player.git
cd RTSP_Livestream_Player
```

2. Install frontend dependencies:
```bash
cd frontend
npm install
```

3. Install backend dependencies:
```bash
cd ../backend
pip install -r requirements.txt
```

## Configuration

1. Create an `uploads` directory in the backend folder for storing overlay images:
```bash
mkdir uploads
```

2. Ensure your RTSP stream URL is accessible and in the correct format:
```
rtsp://username:password@ip:port/path
```

## Running the Application

1. Start the backend server:
```bash
cd backend
python app.py
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

3. Access the application at `http://localhost:5173` (or the port specified by your Vite configuration)
