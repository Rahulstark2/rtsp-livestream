import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Plus, Edit, Trash,Loader } from 'lucide-react';
import axios from 'axios';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from './ui/toaster';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LivestreamPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [rtspUrl, setRtspUrl] = useState('');
  const [volume, setVolume] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamStarted, setIsStreamStarted] = useState(false); 
  const [overlays, setOverlays] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  
  const [newOverlay, setNewOverlay] = useState({ type: 'text', content: '', position: 'center' });
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const prevVolumeRef = useRef(100);
  const [editingOverlay, setEditingOverlay] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const editFileInputRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('http://127.0.0.1:5000/me');
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
  
    const interval = setInterval(() => {
      fetchData();
    }, 21600000);
  
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  

  useEffect(() => {
    
    return async () => {
      try {
        await axios.post('http://127.0.0.1:5000/stop_stream');
        
      } catch (error) {
        console.error("Error stopping stream:", error);
        toast({
          variant: "destructive",
          title: "Stream Stop Error",
          description: "An error occurred while stopping the stream.",
        });
      }
    };
  }, []);

  useEffect(() => {
    fetchOverlays();
  }, []);

  const fetchOverlays = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/overlays');
      setOverlays(response.data);
    } catch (error) {
      console.error('Error fetching overlays:', error);
      toast({
        variant: "destructive",
        title: "Error fetching overlays",
        description: "An error occurred while fetching overlays.",
      });
    }
  };

  const handlePlay = async () => {
    if (!rtspUrl) {
      toast({
        variant: "destructive",
        title: "Error: RTSP URL is empty.",
        description: "Please enter a valid RTSP URL.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('http://127.0.0.1:5000/stream', { rtspUrl });
      setIsPlaying(true);
      setIsPaused(false);
      setIsStreamStarted(true);
    } catch (error) {
      console.error('Error:', error.response?.data?.error || error.message);
      toast({
        variant: "destructive",
        title: "Stream Error",
        description: error.response?.data?.error || "An error occurred while starting the stream.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post('http://127.0.0.1:5000/pause_stream');
      if (response.status === 200) {
        setIsPlaying(false);
        setIsPaused(true);
      }
    } catch (error) {
      console.error('Error pausing stream:', error);
      toast({
        variant: "destructive",
        title: "Pause Error",
        description: "An error occurred while pausing the stream.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post('http://127.0.0.1:5000/stream', { rtspUrl });
      if (response.status === 200) {
        setIsPlaying(true);
        setIsPaused(false);
      }
    } catch (error) {
      console.error('Error resuming stream:', error);
      toast({
        variant: "destructive",
        title: "Resume Error",
        description: "An error occurred while resuming the stream.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setVolume(prevVolumeRef.current);
    } else {
      prevVolumeRef.current = volume;
      setVolume(0);
    }
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue);
    if (newValue > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
  
    if (isPlaying || isPaused) {
      toast({
        title: "Already Streaming",
        description: "The stream is already in progress.",
      });
    } else {
      handlePlay();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    if (file) {
      setNewOverlay({ ...newOverlay, content: file.name });
    }
  };

  const handleCreateOverlay = async () => {
    if (!newOverlay.content) {
      toast({
        variant: "destructive",
        title: "Error creating overlay",
        description: "Content cannot be empty.",
      });
      return;
    }
  
    try {
      let response;
      if (newOverlay.type === 'image' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('type', newOverlay.type);
        formData.append('position', newOverlay.position);

        response = await axios.post('http://127.0.0.1:5000/overlays', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        response = await axios.post('http://127.0.0.1:5000/overlays', newOverlay);
      }

      if (response.data && response.data.id) {
        const newOverlayData = {
          id: response.data.id,
          type: newOverlay.type,
          content: newOverlay.content,
          position: newOverlay.position
        };

        setOverlays(prevOverlays => [...prevOverlays, newOverlayData]);

        setNewOverlay({ type: 'text', content: '', position: 'center' });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        toast({
          title: "Overlay created",
          description: "New overlay has been added successfully.",
        });
        setIsDialogOpen(false);
      } else {
        throw new Error('Invalid server response');
      }
    } catch (error) {
      console.error('Error creating overlay:', error);
      toast({
        variant: "destructive",
        title: "Error creating overlay",
        description: "An error occurred while creating the overlay.",
      });
    }
  };

  const handleEditOverlay = (overlay) => {
    setEditingOverlay(overlay);
    setIsEditDialogOpen(true);
  };

  const handleUpdateOverlay = async () => {
    if (!editingOverlay) return;

    try {
      let response;
      if (editingOverlay.type === 'image' && editFileInputRef.current && editFileInputRef.current.files[0]) {
        const formData = new FormData();
        formData.append('file', editFileInputRef.current.files[0]);
        formData.append('position', editingOverlay.position);
        formData.append('type', 'image');

        
        response = await axios.put(`http://127.0.0.1:5000/overlays/${editingOverlay.id}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        response = await axios.put(`http://127.0.0.1:5000/overlays/${editingOverlay.id}`, editingOverlay);
      }

      setOverlays(overlays.map(overlay => overlay.id === editingOverlay.id ? {...overlay, ...editingOverlay} : overlay));
      toast({
        title: "Overlay updated",
        description: "Overlay has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setEditingOverlay(null);
    } catch (error) {
      console.error('Error updating overlay:', error);
      toast({
        variant: "destructive",
        title: "Error updating overlay",
        description: "An error occurred while updating the overlay.",
      });
    }
  };



  const handleDeleteOverlay = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/overlays/${id}`);
      setOverlays(overlays.filter(overlay => overlay.id !== id));
      toast({
        title: "Overlay deleted",
        description: "Overlay has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting overlay:', error);
      toast({
        variant: "destructive",
        title: "Error deleting overlay",
        description: "An error occurred while deleting the overlay.",
      });
    }
  };

  const formatOverlayContent = (content) => {
    if (typeof content === 'string' && content.includes('\n')) {
      return content.split('\n').map((line, index) => (
        <React.Fragment key={index}>
          {line}
          {index < content.split('\n').length - 1 && <br />}
        </React.Fragment>
      ));
    }
    return content;
  };

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };


    
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden w-full max-w-4xl">
        <div className="relative w-full pt-[56.25%] bg-black">
          {isPlaying || isPaused ? (
            <img
              src="http://127.0.0.1:5000/video_feed"
              alt="Live Stream"
              className="absolute top-0 left-0 w-full h-full object-cover"
            />
          ) : isLoading ? (
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-gray-500 text-lg">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-gray-500 text-lg text-center px-4">
              Enter RTSP URL and click Stream to start the livestream
            </div>
          )}
        </div>
        <div className="p-4 bg-gray-900">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={isPlaying ? handlePause : isPaused ? handleResume : handlePlay}
                  className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors relative"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader className="w-6 h-6 text-white animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white" />
                  )}
                </button>
                <button
                  onClick={handleToggleMute}
                  className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
                </button>
                <Box className="flex-grow ml-2" style={{ minWidth: '100px', maxWidth: '200px' }}>
                  <Slider
                    value={volume}
                    min={0}
                    max={100}
                    onChange={handleVolumeChange}
                    valueLabelDisplay="auto"
                    aria-label="Volume"
                  />
                </Box>
              </div>
            </div>
            <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <input
                type="text"
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                placeholder="Enter RTSP URL"
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="RTSP URL"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Stream
              </button>
            </form>
          </div>
          
          <div className="mt-4">
            <h3 className="text-white text-lg font-semibold mb-2">Overlays</h3>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="mb-2 bg-blue-500 text-white border-0 hover:bg-blue-500 hover:text-white w-full sm:w-auto"
                  disabled={!isStreamStarted}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Overlay
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Overlay</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="type" className="text-right">Type</label>
                    <Select
                      value={newOverlay.type}
                      onValueChange={(value) => setNewOverlay({ ...newOverlay, type: value, content: '' })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select overlay type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="content" className="text-right">Content</label>
                    {newOverlay.type === 'text' ? (
                      <Input
                        id="content"
                        className="col-span-3"
                        value={newOverlay.content}
                        onChange={(e) => setNewOverlay({ ...newOverlay, content: e.target.value })}
                        placeholder="Enter text content"
                      />
                    ) : (
                      <Input
                        id="content"
                        type="file"
                        className={`col-span-3 ${newOverlay.type === 'image' ? 'cursor-pointer' : ''}`}
                        onChange={handleFileChange}
                        ref={fileInputRef}
                        accept="image/*"
                      />
                    )}
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="position" className="text-right">Initial Position</label>
                    <Select
                      value={newOverlay.position}
                      onValueChange={(value) => setNewOverlay({ ...newOverlay, position: value })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="bottom">Bottom</SelectItem>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="bg-blue-500 text-white border-0 hover:bg-blue-500 hover:text-white w-full" onClick={handleCreateOverlay}>Create Overlay</Button>
              </DialogContent>
            </Dialog>

           
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Edit Overlay</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="edit-content" className="text-right">Content</label>
                    {editingOverlay?.type === 'text' ? (
                      <Input
                        id="edit-content"
                        className="col-span-3"
                        value={editingOverlay?.content || ''}
                        onChange={(e) => setEditingOverlay({ ...editingOverlay, content: e.target.value })}
                        placeholder="Enter text content"
                      />
                    ) : (
                      <Input
                        id="edit-content"
                        type="file"
                        className="col-span-3 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setEditingOverlay({ ...editingOverlay, content: file.name });
                          }
                        }}
                        ref={editFileInputRef}
                        accept="image/*"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="edit-position" className="text-right">Position</label>
                    <Select
                      value={editingOverlay?.position || ''}
                      onValueChange={(value) => setEditingOverlay({ ...editingOverlay, position: value })}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="bottom">Bottom</SelectItem>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="bg-blue-500 text-white border-0 hover:bg-blue-600 w-full" onClick={handleUpdateOverlay}>
                  Update Overlay
                </Button>
              </DialogContent>
            </Dialog>

            
            <div className="space-y-2">
              {overlays.map((overlay) => (
                <div key={overlay.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-700 p-2 rounded">
                  <span className="text-white mb-2 sm:mb-0">
                    {capitalizeFirstLetter(overlay.type)}: {formatOverlayContent(overlay.content)}
                  </span>
                  <div className="flex space-x-2">
                    <Button variant="ghost" className="hover:bg-gray-600" onClick={() => handleEditOverlay(overlay)}>
                      <Edit className="w-4 h-4 text-white" />
                    </Button>
                    <Button variant="ghost" className="hover:bg-gray-600" onClick={() => handleDeleteOverlay(overlay.id)}>
                      <Trash className="w-4 h-4 text-white" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}