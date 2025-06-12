"use client"

import type React from "react"

import { useState, useRef } from "react"
import Image from "next/image"
import {
  Play,
  Square,
  Clock,
  Trash2,
  Settings,
  Radio,
  Upload,
  Youtube,
  Facebook,
  LogOut,
  User,
  Crown,
  Monitor,
  Smartphone,
} from "lucide-react"

export default function Dashboard() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [streamKey, setStreamKey] = useState("")
  const [selectedServer, setSelectedServer] = useState<"youtube" | "facebook">("youtube")
  const [resolution, setResolution] = useState("720p")
  const [liveMode, setLiveMode] = useState<"portrait" | "landscape">("landscape")
  const [autoLoop, setAutoLoop] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [liveCount, setLiveCount] = useState(0)
  const [showConfig, setShowConfig] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resolutions = [
    { value: "144p", label: "144p", premium: false },
    { value: "240p", label: "240p", premium: false },
    { value: "360p", label: "360p", premium: false },
    { value: "480p", label: "480p", premium: false },
    { value: "720p", label: "720p", premium: false },
    { value: "1080p", label: "1080p", premium: true },
    { value: "2K", label: "2K", premium: true },
    { value: "4K", label: "4K", premium: true },
  ]

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 200 * 1024 * 1024) {
        // 200MB
        alert("Ukuran file maksimal 200MB")
        return
      }
      setVideoFile(file)
    }
  }

  const handleStartLive = () => {
    if (liveCount >= 3) {
      alert("Anda telah mencapai batas maksimal 3x live streaming untuk akun gratis")
      return
    }

    if (!videoFile || !streamKey) {
      alert("Silakan upload video dan masukkan stream key terlebih dahulu")
      return
    }

    setIsLive(true)
    setLiveCount((prev) => prev + 1)
  }

  const handleStopLive = () => {
    setIsLive(false)
  }

  const handleDeleteVideo = () => {
    setVideoFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const checkLiveStatus = () => {
    // Simulate ffmpeg status check
    alert(`Status Live: ${isLive ? "AKTIF" : "TIDAK AKTIF"}\nServer: ${selectedServer}\nResolusi: ${resolution}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Image src="/images/logo.png" alt="SiPaling.pro" width={40} height={40} className="rounded-full" />
              <h1 className="text-xl font-bold text-gray-900">Dashboard Streaming</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Crown className="w-4 h-4 text-yellow-500" />
                <span>Gratis ({3 - liveCount}/3 live tersisa)</span>
              </div>
              <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
                <User className="w-5 h-5" />
                <span className="hidden sm:inline">Profil</span>
              </button>
              <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video Upload Section */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Video</h2>

              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-400 transition-colors">
                {videoFile ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto">
                      <Upload className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{videoFile.name}</p>
                      <p className="text-xs text-gray-500">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button
                      onClick={handleDeleteVideo}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                      id="delete-video-btn"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Hapus Video
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto">
                      <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900">Upload Video</p>
                      <p className="text-sm text-gray-500">Maksimal 200MB</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                      id="video-upload"
                    />
                    <button onClick={() => fileInputRef.current?.click()} className="btn-primary" id="upload-btn">
                      Pilih Video
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stream Configuration */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Konfigurasi Stream</h2>
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
                  id="show-config-btn"
                >
                  <Settings className="w-5 h-5" />
                  <span>Show Configure</span>
                </button>
              </div>

              {showConfig && (
                <div className="space-y-6">
                  {/* RTMP Server Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">RTMP Server</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setSelectedServer("youtube")}
                        className={`flex items-center justify-center space-x-3 p-4 rounded-2xl border-2 transition-all ${
                          selectedServer === "youtube"
                            ? "border-red-500 bg-red-50 text-red-700"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        id="youtube-server-btn"
                      >
                        <Youtube className="w-6 h-6" />
                        <span className="font-medium">YouTube</span>
                      </button>
                      <button
                        onClick={() => setSelectedServer("facebook")}
                        className={`flex items-center justify-center space-x-3 p-4 rounded-2xl border-2 transition-all ${
                          selectedServer === "facebook"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        id="facebook-server-btn"
                      >
                        <Facebook className="w-6 h-6" />
                        <span className="font-medium">Facebook</span>
                      </button>
                    </div>
                  </div>

                  {/* Stream Key */}
                  <div>
                    <label htmlFor="stream-key" className="block text-sm font-medium text-gray-700 mb-2">
                      Stream Key
                    </label>
                    <input
                      type="password"
                      id="stream-key"
                      value={streamKey}
                      onChange={(e) => setStreamKey(e.target.value)}
                      className="input-field"
                      placeholder="Masukkan stream key"
                    />
                  </div>

                  {/* Resolution */}
                  <div>
                    <label htmlFor="resolution" className="block text-sm font-medium text-gray-700 mb-2">
                      Resolusi
                    </label>
                    <select
                      id="resolution"
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="input-field"
                    >
                      {resolutions.map((res) => (
                        <option key={res.value} value={res.value} disabled={res.premium}>
                          {res.label} {res.premium ? "(Premium)" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Akun gratis maksimal 720p</p>
                  </div>

                  {/* Live Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Mode Live</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setLiveMode("landscape")}
                        className={`flex items-center justify-center space-x-3 p-4 rounded-2xl border-2 transition-all ${
                          liveMode === "landscape"
                            ? "border-red-500 bg-red-50 text-red-700"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        id="landscape-mode-btn"
                      >
                        <Monitor className="w-6 h-6" />
                        <span className="font-medium">Landscape 🟥</span>
                      </button>
                      <button
                        onClick={() => setLiveMode("portrait")}
                        className={`flex items-center justify-center space-x-3 p-4 rounded-2xl border-2 transition-all ${
                          liveMode === "portrait"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        id="portrait-mode-btn"
                      >
                        <Smartphone className="w-6 h-6" />
                        <span className="font-medium">Portrait 🟦</span>
                      </button>
                    </div>
                  </div>

                  {/* Auto Loop */}
                  <div className="flex items-center justify-between">
                    <label htmlFor="auto-loop" className="text-sm font-medium text-gray-700">
                      Auto Loop 🔁
                    </label>
                    <button
                      onClick={() => setAutoLoop(!autoLoop)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoLoop ? "bg-blue-600" : "bg-gray-200"
                      }`}
                      id="auto-loop-toggle"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          autoLoop ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Kontrol Streaming</h2>

              <div className="space-y-4">
                <button
                  onClick={handleStartLive}
                  disabled={isLive || !videoFile || !streamKey}
                  className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl font-medium transition-all ${
                    isLive || !videoFile || !streamKey
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                  id="start-live-btn"
                >
                  <Play className="w-5 h-5" />
                  <span>Start Live ▶️</span>
                </button>

                <button
                  onClick={handleStopLive}
                  disabled={!isLive}
                  className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl font-medium transition-all ${
                    !isLive ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 text-white"
                  }`}
                  id="stop-live-btn"
                >
                  <Square className="w-5 h-5" />
                  <span>Stop Live ⏹️</span>
                </button>

                <button
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl font-medium bg-yellow-600 hover:bg-yellow-700 text-white transition-all"
                  id="schedule-stop-btn"
                >
                  <Clock className="w-5 h-5" />
                  <span>Jadwal Stop 🕒</span>
                </button>

                <button
                  onClick={checkLiveStatus}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all"
                  id="check-status-btn"
                >
                  <Radio className="w-5 h-5" />
                  <span>Cek Status Live 📡</span>
                </button>
              </div>
            </div>

            {/* Live Status */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Live</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isLive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {isLive ? "🔴 LIVE" : "⚫ OFFLINE"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Server:</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">{selectedServer}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Resolusi:</span>
                  <span className="text-sm font-medium text-gray-900">{resolution}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Mode:</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {liveMode} {liveMode === "portrait" ? "🟦" : "🟥"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Auto Loop:</span>
                  <span className="text-sm font-medium text-gray-900">{autoLoop ? "ON 🔁" : "OFF"}</span>
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistik Penggunaan</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Live Streaming:</span>
                  <span className="text-sm font-medium text-gray-900">{liveCount}/3</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(liveCount / 3) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">Upgrade ke Premium untuk unlimited streaming</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center">
            <p className="text-sm text-gray-500">
              Dibuat oleh{" "}
              <a
                href="https://SiPaling.pro"
                className="text-blue-600 hover:text-blue-700 font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                SiPalingpro
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
