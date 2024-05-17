import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Button,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  SafeAreaView,
} from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';

const signalingServerUrl =
  Platform.OS === 'ios' ? 'ws://localhost:8080' : 'ws://10.0.2.2:8080';
const ws = new WebSocket(signalingServerUrl);

const App = () => {
  const [isOfferCreated, setIsOfferCreated] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [myId, setMyId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const dataChannel = useRef(null);
  const pc = useRef(
    new RTCPeerConnection({
      iceServers: [
        {urls: 'stun:stun.l.google.com:19302'}, // STUNサーバー
      ],
    }),
  );

  useEffect(() => {
    ws.onmessage = event => {
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

    pc.current.ondatachannel = event => {
      dataChannel.current = event.channel;
      setupDataChannel();
    };

    pc.current.onconnectionstatechange = () => {
      setConnectionStatus(pc.current.connectionState);
    };

    return () => {
      endCall();
    };
  }, [targetId]);

  const setupDataChannel = () => {
    dataChannel.current.onmessage = event => {
      setChat(prevChat => [
        ...prevChat,
        {sender: 'remote', message: event.data},
      ]);
    };
    dataChannel.current.onopen = () => {
      setConnectionStatus('Connected');
      console.log('Data channel is open');
    };
    dataChannel.current.onclose = () => {
      setConnectionStatus('Disconnected');
      console.log('Data channel is closed');
    };
  };

  const createOffer = async () => {
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    sendMessage({type: 'offer', offer, target: targetId});
    setIsOfferCreated(true);
    setConnectionStatus('Connecting');
  };

  const handleOffer = async (offer, id) => {
    setTargetId(id); // offerを受け取った時にターゲットIDを設定
    await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);
    sendMessage({type: 'answer', answer, target: id});
    setConnectionStatus('Connecting');
  };

  const sendMessage = message => {
    ws.send(JSON.stringify({...message, id: myId}));
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
      pc.current.ondatachannel = null;
      pc.current.onconnectionstatechange = null;
    }
    setIsOfferCreated(false);
    setChat([]);
    setConnectionStatus('Disconnected');
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
      <Button
        title="Create Offer"
        onPress={createOffer}
        disabled={isOfferCreated}
      />
      <Button title="End Call" onPress={endCall} />
      <Text>Connection Status: {connectionStatus}</Text>
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
