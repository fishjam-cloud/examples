package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	"conference-to-stream/fishjam"
	"conference-to-stream/foundry"
)

const whepOutputID = "whep_output"

type RoomState struct {
	RoomID         string
	CompositionURL string
	InputIDs       map[string]string // input_id → peer_id
	WhepURL        string
	mu             sync.Mutex
}

type Handler struct {
	fishjamClient  *fishjam.Client
	foundryClient  *foundry.Client
	managementToken string

	mu    sync.Mutex
	rooms map[string]*RoomState // room_name → state
}

func New(fishjamClient *fishjam.Client, foundryClient *foundry.Client) *Handler {
	return &Handler{
		fishjamClient:   fishjamClient,
		foundryClient:   foundryClient,
		managementToken: fishjamClient.ManagementToken(),
		rooms:           make(map[string]*RoomState),
	}
}

type createRoomRequest struct {
	RoomName string `json:"roomName"`
}

type createRoomResponse struct {
	RoomID  string `json:"roomId"`
	WhepURL string `json:"whepUrl"`
}

type createPeerRequest struct {
	PeerName string `json:"peerName"`
}

type createPeerResponse struct {
	PeerToken        string `json:"peerToken"`
	PeerWebsocketURL string `json:"peerWebsocketUrl"`
}

func (h *Handler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	var req createRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.RoomName == "" {
		http.Error(w, "roomName is required", http.StatusBadRequest)
		return
	}

	// Return existing room if already created
	h.mu.Lock()
	if state, ok := h.rooms[req.RoomName]; ok {
		h.mu.Unlock()
		writeJSON(w, createRoomResponse{RoomID: state.RoomID, WhepURL: state.WhepURL})
		return
	}
	h.mu.Unlock()

	// Create composition
	compositionURL, err := h.foundryClient.CreateComposition()
	if err != nil {
		log.Printf("create composition: %v", err)
		http.Error(w, "failed to create composition", http.StatusInternalServerError)
		return
	}
	log.Printf("created composition: %s", compositionURL)

	// Start composition
	if err := h.foundryClient.Start(compositionURL); err != nil {
		log.Printf("start composition: %v", err)
		http.Error(w, "failed to start composition", http.StatusInternalServerError)
		return
	}

	// Register WHEP output
	if err := h.foundryClient.RegisterWhepOutput(compositionURL, whepOutputID); err != nil {
		log.Printf("register whep output: %v", err)
		http.Error(w, "failed to register WHEP output", http.StatusInternalServerError)
		return
	}

	// Create Fishjam room
	room, err := h.fishjamClient.CreateRoom()
	if err != nil {
		log.Printf("create room: %v", err)
		http.Error(w, "failed to create room", http.StatusInternalServerError)
		return
	}
	log.Printf("created room: %s", room.ID)

	// Add track forwarding
	if err := h.fishjamClient.CreateTrackForwarding(room.ID, compositionURL); err != nil {
		log.Printf("create track forwarding: %v", err)
		http.Error(w, "failed to create track forwarding", http.StatusInternalServerError)
		return
	}

	whepURL := h.foundryClient.WhepURL(compositionURL, whepOutputID)

	state := &RoomState{
		RoomID:         room.ID,
		CompositionURL: compositionURL,
		InputIDs:       make(map[string]string),
		WhepURL:        whepURL,
	}

	h.mu.Lock()
	h.rooms[req.RoomName] = state
	h.mu.Unlock()

	// Start WS notifier for this room
	fishjamBaseURL := h.fishjamClient.BaseURL()
	_, err = fishjam.NewNotifier(fishjamBaseURL, h.managementToken, fishjam.NotifierCallbacks{
		OnTrackForwarding: func(event fishjam.TrackForwardingEvent) {
			if event.RoomID != room.ID {
				return
			}
			state.mu.Lock()
			state.InputIDs[event.InputID] = event.PeerID
			inputIDs := collectKeys(state.InputIDs)
			state.mu.Unlock()

			log.Printf("track forwarding: room=%s peer=%s input=%s (total=%d)", event.RoomID, event.PeerID, event.InputID, len(inputIDs))
			if err := h.foundryClient.UpdateOutput(compositionURL, whepOutputID, inputIDs); err != nil {
				log.Printf("update output: %v", err)
			}
		},
		OnTrackForwardingRemoved: func(event fishjam.TrackForwardingEvent) {
			if event.RoomID != room.ID {
				return
			}
			state.mu.Lock()
			delete(state.InputIDs, event.InputID)
			inputIDs := collectKeys(state.InputIDs)
			state.mu.Unlock()

			log.Printf("track forwarding removed: room=%s peer=%s input=%s (total=%d)", event.RoomID, event.PeerID, event.InputID, len(inputIDs))
			if err := h.foundryClient.UpdateOutput(compositionURL, whepOutputID, inputIDs); err != nil {
				log.Printf("update output: %v", err)
			}
		},
	})
	if err != nil {
		log.Printf("start notifier: %v", err)
		http.Error(w, "failed to start notifier", http.StatusInternalServerError)
		return
	}

	writeJSON(w, createRoomResponse{RoomID: room.ID, WhepURL: whepURL})
}

func (h *Handler) CreatePeer(w http.ResponseWriter, r *http.Request) {
	roomID := roomIDFromPath(r.URL.Path)
	if roomID == "" {
		http.Error(w, "room ID required", http.StatusBadRequest)
		return
	}

	var req createPeerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	metadata := map[string]string{}
	if req.PeerName != "" {
		metadata["name"] = req.PeerName
	}

	peerToken, peerWebsocketURL, err := h.fishjamClient.CreatePeer(roomID, metadata)
	if err != nil {
		log.Printf("create peer: %v", err)
		http.Error(w, "failed to create peer", http.StatusInternalServerError)
		return
	}

	writeJSON(w, createPeerResponse{
		PeerToken:        peerToken,
		PeerWebsocketURL: peerWebsocketURL,
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("encode response: %v", err)
	}
}

// roomIDFromPath extracts room ID from /api/rooms/{roomId}/peers
func roomIDFromPath(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	// Expected: ["api", "rooms", "<roomId>", "peers"]
	if len(parts) >= 3 {
		return parts[2]
	}
	return ""
}

func collectKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// Route registers routes on the given mux
func (h *Handler) Route(mux *http.ServeMux) {
	mux.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, fmt.Sprintf("method %s not allowed", r.Method), http.StatusMethodNotAllowed)
			return
		}
		h.CreateRoom(w, r)
	})

	mux.HandleFunc("/api/rooms/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, fmt.Sprintf("method %s not allowed", r.Method), http.StatusMethodNotAllowed)
			return
		}
		h.CreatePeer(w, r)
	})
}
