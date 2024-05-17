import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Button,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';

const signalingServerUrl = 'ws://p2p2p-fe97d4f7eca7.herokuapp.com:8080'; // シグナリングサーバーのURL

const App = () => {
  const ws = useRef(new WebSocket(signalingServerUrl));
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isOfferCreated, setIsOfferCreated] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [myId, setMyId] = useState('');
  const [targetId, setTargetId] = useState('');
  const dataChannel = useRef(null);
  const pc = useRef(
    new RTCPeerConnection({
      iceServers: [
        {urls: 'stun:stun.l.google.com:19302'}, // STUNサーバー
      ],
    }),
  );

  useEffect(() => {
    ws.current.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'offer') {
          handleOffer(data.offer, data.id);
        } else if (data.type === 'answer') {
          pc.current.setRemoteDescription(
            new RTCSessionDescription(data.answer),
          );
        } else if (data.type === 'candidate') {
          pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (e) {
        console.error('Error parsing JSON', e);
      }
    };

    pc.current.onicecandidate = event => {
      if (event.candidate) {
        sendMessage({
          type: 'candidate',
          candidate: event.candidate,
          target: targetId,
        });
      }
    };

    pc.current.onaddstream = event => {
      setRemoteStream(event.stream);
    };

    pc.current.ondatachannel = event => {
      dataChannel.current = event.channel;
      setupDataChannel();
    };

    return () => {
      endCall();
    };
  }, [targetId]);

  const startLocalStream = async () => {
    const stream = await mediaDevices.getUserMedia({video: true, audio: true});
    setLocalStream(stream);
    pc.current.addStream(stream);

    if (!dataChannel.current) {
      dataChannel.current = pc.current.createDataChannel('chat');
      setupDataChannel();
    }
  };

  const setupDataChannel = () => {
    dataChannel.current.onmessage = event => {
      setChat(prevChat => [
        ...prevChat,
        {sender: 'remote', message: event.data},
      ]);
    };
    dataChannel.current.onopen = () => {
      console.log('Data channel is open');
    };
    dataChannel.current.onclose = () => {
      console.log('Data channel is closed');
    };
  };

  const createOffer = async () => {
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    sendMessage({type: 'offer', offer, target: targetId});
    setIsOfferCreated(true);
  };

  const handleOffer = async (offer, id) => {
    setTargetId(id); // offerを受け取った時にターゲットIDを設定
    await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);
    sendMessage({type: 'answer', answer, target: id});
  };

  const sendMessage = message => {
    ws.current.send(JSON.stringify({...message, id: myId}));
  };

  const sendChatMessage = () => {
    if (dataChannel.current && dataChannel.current.readyState === 'open') {
      dataChannel.current.send(message);
      setChat(prevChat => [...prevChat, {sender: 'local', message}]);
      setMessage('');
    }
  };

  const register = () => {
    sendMessage({type: 'register'});
  };

  const endCall = () => {
    if (pc.current) {
      pc.current.close();
      pc.current.onicecandidate = null;
      pc.current.onaddstream = null;
      pc.current.ondatachannel = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
    setIsOfferCreated(false);
    setChat([]);
    dataChannel.current = null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        placeholder="Your ID"
        value={myId}
        onChangeText={setMyId}
        style={styles.input}
      />
      <Button title="Register" onPress={register} />
      <TextInput
        placeholder="Target ID"
        value={targetId}
        onChangeText={setTargetId}
        style={styles.input}
      />
      <Button title="Start Local Stream" onPress={startLocalStream} />
      <Button
        title="Create Offer"
        onPress={createOffer}
        disabled={isOfferCreated}
      />
      <Button title="End Call" onPress={endCall} />
      <Text>Local Stream: {localStream ? 'Started' : 'Not started'}</Text>
      <Text>Remote Stream: {remoteStream ? 'Received' : 'Not received'}</Text>

      <View style={styles.chatContainer}>
        <ScrollView style={styles.chatScroll}>
          {chat.map((msg, index) => (
            <Text
              key={index}
              style={
                msg.sender === 'local'
                  ? styles.localMessage
                  : styles.remoteMessage
              }>
              {msg.message}
            </Text>
          ))}
        </ScrollView>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
        />
        <Button title="Send Message" onPress={sendChatMessage} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  chatContainer: {
    flex: 1,
    marginTop: 20,
  },
  chatScroll: {
    flex: 1,
    marginBottom: 10,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  localMessage: {
    textAlign: 'right',
    color: 'blue',
    marginBottom: 5,
  },
  remoteMessage: {
    textAlign: 'left',
    color: 'green',
    marginBottom: 5,
  },
});

export default App;
