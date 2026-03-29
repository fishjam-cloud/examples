package fishjam

import (
	"fmt"
	"log"
	"net/url"
	"strings"

	pb "conference-to-stream/proto/fishjam"

	"github.com/gorilla/websocket"
	"google.golang.org/protobuf/proto"
)

type TrackForwardingEvent struct {
	RoomID         string
	PeerID         string
	CompositionURL string
	InputID        string
}

type PeerEvent struct {
	RoomID string
	PeerID string
}

type NotifierCallbacks struct {
	OnTrackForwarding        func(TrackForwardingEvent)
	OnTrackForwardingRemoved func(TrackForwardingEvent)
	OnPeerConnected          func(PeerEvent)
	OnPeerDisconnected       func(PeerEvent)
}

type Notifier struct {
	conn      *websocket.Conn
	callbacks NotifierCallbacks
	done      chan struct{}
}

func NewNotifier(fishjamBaseURL, managementToken string, callbacks NotifierCallbacks) (*Notifier, error) {
	wsURL := httpToWebsocket(fishjamBaseURL) + "/socket/server/websocket"

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("dial fishjam ws: %w", err)
	}

	n := &Notifier{
		conn:      conn,
		callbacks: callbacks,
		done:      make(chan struct{}),
	}

	if err := n.authenticate(managementToken); err != nil {
		conn.Close()
		return nil, fmt.Errorf("authenticate: %w", err)
	}

	if err := n.subscribe(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("subscribe: %w", err)
	}

	go n.listen()

	return n, nil
}

func (n *Notifier) Close() {
	n.conn.Close()
	<-n.done
}

func (n *Notifier) authenticate(token string) error {
	msg := &pb.ServerMessage{
		Content: &pb.ServerMessage_AuthRequest_{
			AuthRequest: &pb.ServerMessage_AuthRequest{
				Token: token,
			},
		},
	}
	return n.sendProto(msg)
}

func (n *Notifier) subscribe() error {
	msg := &pb.ServerMessage{
		Content: &pb.ServerMessage_SubscribeRequest_{
			SubscribeRequest: &pb.ServerMessage_SubscribeRequest{
				EventType: pb.ServerMessage_EVENT_TYPE_SERVER_NOTIFICATION,
			},
		},
	}
	return n.sendProto(msg)
}

func (n *Notifier) sendProto(msg *pb.ServerMessage) error {
	data, err := proto.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal proto: %w", err)
	}
	return n.conn.WriteMessage(websocket.BinaryMessage, data)
}

func (n *Notifier) listen() {
	defer close(n.done)

	for {
		_, data, err := n.conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure) {
				return
			}
			log.Printf("ws read error: %v", err)
			return
		}

		var msg pb.ServerMessage
		if err := proto.Unmarshal(data, &msg); err != nil {
			log.Printf("unmarshal ws message: %v", err)
			continue
		}

		n.dispatch(&msg)
	}
}

func (n *Notifier) dispatch(msg *pb.ServerMessage) {
	switch content := msg.Content.(type) {
	case *pb.ServerMessage_Authenticated_:
		log.Println("fishjam: authenticated")
	case *pb.ServerMessage_SubscribeResponse_:
		log.Println("fishjam: subscribed to notifications")
	case *pb.ServerMessage_TrackForwarding_:
		tf := content.TrackForwarding
		log.Printf("fishjam: track forwarding - room=%s peer=%s input=%s", tf.RoomId, tf.PeerId, tf.InputId)
		if n.callbacks.OnTrackForwarding != nil {
			n.callbacks.OnTrackForwarding(TrackForwardingEvent{
				RoomID:         tf.RoomId,
				PeerID:         tf.PeerId,
				CompositionURL: tf.CompositionUrl,
				InputID:        tf.InputId,
			})
		}
	case *pb.ServerMessage_TrackForwardingRemoved_:
		tf := content.TrackForwardingRemoved
		log.Printf("fishjam: track forwarding removed - room=%s peer=%s input=%s", tf.RoomId, tf.PeerId, tf.InputId)
		if n.callbacks.OnTrackForwardingRemoved != nil {
			n.callbacks.OnTrackForwardingRemoved(TrackForwardingEvent{
				RoomID:         tf.RoomId,
				PeerID:         tf.PeerId,
				CompositionURL: tf.CompositionUrl,
				InputID:        tf.InputId,
			})
		}
	case *pb.ServerMessage_PeerConnected_:
		log.Printf("fishjam: peer connected - room=%s peer=%s",
			content.PeerConnected.RoomId, content.PeerConnected.PeerId)
		if n.callbacks.OnPeerConnected != nil {
			n.callbacks.OnPeerConnected(PeerEvent{
				RoomID: content.PeerConnected.RoomId,
				PeerID: content.PeerConnected.PeerId,
			})
		}
	case *pb.ServerMessage_PeerDisconnected_:
		log.Printf("fishjam: peer disconnected - room=%s peer=%s",
			content.PeerDisconnected.RoomId, content.PeerDisconnected.PeerId)
		if n.callbacks.OnPeerDisconnected != nil {
			n.callbacks.OnPeerDisconnected(PeerEvent{
				RoomID: content.PeerDisconnected.RoomId,
				PeerID: content.PeerDisconnected.PeerId,
			})
		}
	default:
		// Ignore other notification types
	}
}

func httpToWebsocket(httpURL string) string {
	u, err := url.Parse(httpURL)
	if err != nil {
		return strings.Replace(strings.Replace(httpURL, "https://", "wss://", 1), "http://", "ws://", 1)
	}
	switch u.Scheme {
	case "https":
		u.Scheme = "wss"
	case "http":
		u.Scheme = "ws"
	}
	return u.String()
}
